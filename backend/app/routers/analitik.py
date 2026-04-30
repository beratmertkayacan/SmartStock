from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from collections import defaultdict
from app.database import get_db
from app.models.urun import Urun
from app.models.stok_hareketi import StokHareketi
from app.ml.eoq import eoq_hesapla as eoq_fonksiyon
from app.ml.tahmin import tahmin_yap

router = APIRouter(prefix="/analitik", tags=["Analitik & ML"])

AY_KISA = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"]

@router.get("/dashboard")
def dashboard_ozet(db: Session = Depends(get_db)):  # noqa: C901
    import traceback

    bugun      = date.today()

    # Son 30 günü bugünden değil, veritabanındaki en son hareket tarihinden geriye say.
    # Bu sayede eski tarihli test/gerçek verileri de grafiklerde doğru görünür.
    try:
        son_tarih_raw = db.query(func.max(StokHareketi.tarih)).scalar()
        if isinstance(son_tarih_raw, date):
            son_tarih = son_tarih_raw
        elif isinstance(son_tarih_raw, str):
            son_tarih = date.fromisoformat(son_tarih_raw[:10])
        else:
            son_tarih = None
    except Exception:
        son_tarih = None
    referans_tarih = son_tarih if son_tarih else bugun
    ay_basi    = date(referans_tarih.year, referans_tarih.month, 1)
    gun30_once = referans_tarih - timedelta(days=29)

    # ── Ürün istatistikleri (sadece urunler tablosu, güvenli) ────────────────
    try:
        toplam_urun = db.query(func.count(Urun.urun_id)).scalar() or 0
        kritik_urun = db.query(func.count(Urun.urun_id)).filter(
            Urun.mevcut_stok <= Urun.min_stok_seviyesi
        ).scalar() or 0
        stok_degeri = db.query(
            func.sum(Urun.mevcut_stok * Urun.maliyet_fiyati)
        ).scalar() or 0
        fiyatlar = db.query(Urun.maliyet_fiyati, Urun.satis_fiyati).filter(
            Urun.maliyet_fiyati != None,
            Urun.satis_fiyati   != None,
            Urun.satis_fiyati   > 0
        ).all()
        marjlar = [((s - m) / s * 100) for m, s in fiyatlar if s and s > 0]
        ort_marj = round(sum(marjlar) / len(marjlar), 1) if marjlar else 0
    except Exception:
        traceback.print_exc()
        toplam_urun, kritik_urun, stok_degeri, ort_marj = 0, 0, 0, 0

    # ── Kategori dağılımı ────────────────────────────────────────────────────
    try:
        kat_rows = db.query(
            Urun.kategori,
            func.count(Urun.urun_id).label("urun_sayisi"),
            func.sum(Urun.mevcut_stok * Urun.maliyet_fiyati).label("stok_degeri")
        ).group_by(Urun.kategori).order_by(
            func.sum(Urun.mevcut_stok * Urun.maliyet_fiyati).desc()
        ).limit(6).all()
        max_deger = max((r.stok_degeri or 0 for r in kat_rows), default=1)
        kategori_dagilimi = [
            {
                "kategori":    r.kategori or "Diğer",
                "urun_sayisi": r.urun_sayisi,
                "stok_degeri": round(r.stok_degeri or 0, 2),
                "yuzde":       round((r.stok_degeri or 0) / max_deger * 100, 1),
            }
            for r in kat_rows
        ]
    except Exception:
        traceback.print_exc()
        kategori_dagilimi = []

    # ── Stok hareketleri (tablo yoksa/kolonlar eksikse güvenle atla) ──────────
    bugun_giris = bugun_cikis = 0
    bu_ay_alim = bu_ay_satis = 0.0
    son_30_gun_grafik = []
    son_hareketler = []

    try:
        # tarih kolonu DB'de TEXT olarak saklandığından str() ile karşılaştırıyoruz
        bugun_h = db.query(StokHareketi).filter(StokHareketi.tarih == str(referans_tarih)).all()
        bugun_giris = sum(1 for h in bugun_h if h.hareket_tipi == "giris")
        bugun_cikis = sum(1 for h in bugun_h if h.hareket_tipi == "cikis")
    except Exception:
        traceback.print_exc()

    try:
        ay_h = db.query(StokHareketi).filter(StokHareketi.tarih >= str(ay_basi)).all()
        bu_ay_alim  = sum(h.miktar * (h.birim_fiyat or 0) for h in ay_h if h.hareket_tipi == "giris")
        bu_ay_satis = sum(h.miktar * (h.birim_fiyat or 0) for h in ay_h if h.hareket_tipi == "cikis")
    except Exception:
        traceback.print_exc()

    try:
        son30_h = db.query(StokHareketi).filter(StokHareketi.tarih >= str(gun30_once)).all()
        gunluk  = defaultdict(lambda: {"alim": 0.0, "satis": 0.0})
        for h in son30_h:
            k = str(h.tarih)
            if h.hareket_tipi == "giris":
                gunluk[k]["alim"]  += h.miktar * (h.birim_fiyat or 0)
            else:
                gunluk[k]["satis"] += h.miktar * (h.birim_fiyat or 0)
        for i in range(30):
            d      = gun30_once + timedelta(days=i)
            tarih  = d.strftime("%Y-%m-%d")
            etiket = f"{d.day} {AY_KISA[d.month - 1]}"
            son_30_gun_grafik.append({
                "tarih": etiket,
                "Alım":  round(gunluk[tarih]["alim"]),
                "Satış": round(gunluk[tarih]["satis"]),
            })
    except Exception:
        traceback.print_exc()
        son_30_gun_grafik = [{"tarih": f"{i+1}", "Alım": 0, "Satış": 0} for i in range(30)]

    try:
        import json
        def parse_meta(aciklama):
            try:
                m = json.loads(aciklama or "{}")
                return m.get("tedarikci_musteri", ""), m.get("fatura_no", "")
            except Exception:
                return "", ""

        son_rows = db.query(
            StokHareketi.hareket_id,
            StokHareketi.tarih,
            StokHareketi.hareket_tipi,
            StokHareketi.miktar,
            StokHareketi.birim_fiyat,
            StokHareketi.aciklama,
            Urun.urun_adi,
            Urun.birim,
            Urun.kategori,
        ).join(Urun, StokHareketi.urun_id == Urun.urun_id)\
         .order_by(StokHareketi.hareket_id.desc())\
         .limit(8).all()

        for r in son_rows:
            td_m, fat = parse_meta(r.aciklama)
            son_hareketler.append({
                "hareket_id":        r.hareket_id,
                "tarih":             str(r.tarih),
                "hareket_tipi":      r.hareket_tipi,
                "urun_adi":          r.urun_adi,
                "kategori":          r.kategori or "",
                "birim":             r.birim or "",
                "miktar":            r.miktar,
                "birim_fiyat":       r.birim_fiyat,
                "tedarikci_musteri": td_m,
                "fatura_no":         fat,
            })
    except Exception:
        traceback.print_exc()

    return {
        "toplam_urun":           toplam_urun,
        "kritik_stok_sayisi":    kritik_urun,
        "toplam_stok_degeri_tl": round(float(stok_degeri), 2),
        "ortalama_kar_marji":    ort_marj,
        "bugun_giris":           bugun_giris,
        "bugun_cikis":           bugun_cikis,
        "bugun_toplam":          bugun_giris + bugun_cikis,
        "bu_ay_alim":            round(bu_ay_alim, 2),
        "bu_ay_satis":           round(bu_ay_satis, 2),
        "bu_ay_kar":             round(bu_ay_satis - bu_ay_alim, 2),
        "son_30_gun_grafik":     son_30_gun_grafik,
        "kategori_dagilimi":     kategori_dagilimi,
        "son_hareketler":        son_hareketler,
    }


@router.get("/tahmin/{urun_id}")
def talep_tahmini(urun_id: int, gun: int = 30, db: Session = Depends(get_db)):
    try:
        return tahmin_yap(urun_id, gun, db)
    except Exception as e:
        import traceback; traceback.print_exc()
        return {"hata": str(e), "urun_id": urun_id, "gunluk_tahminler": [], "toplam_tahmini_talep": 0, "gunluk_ortalama": 0}

@router.get("/eoq/{urun_id}")
def eoq_hesapla(urun_id: int, db: Session = Depends(get_db)):
    try:
        return eoq_fonksiyon(urun_id, db)
    except Exception as e:
        import traceback; traceback.print_exc()
        return {"hata": str(e)}

@router.get("/gecmis/{urun_id}")
def gecmis_satislar(urun_id: int, gun: int = 365, db: Session = Depends(get_db)):
    """
    Ürünün geçmiş çıkış (satış) verilerini günlük toplamlar hâlinde döndürür.
    - gun: kaç gün geriye bakılacak (varsayılan 365). Referans tarih olarak
      veritabanındaki en son hareket tarihi kullanılır; bu sayede eski tarihli
      veriler de doğru görünür.
    """
    try:
        from datetime import date, timedelta
        from collections import defaultdict

        # En son hareket tarihini bul (bugün yerine)
        son_tarih_raw = db.query(func.max(StokHareketi.tarih)).scalar()
        if isinstance(son_tarih_raw, date):
            referans = son_tarih_raw
        elif isinstance(son_tarih_raw, str):
            referans = date.fromisoformat(son_tarih_raw[:10])
        else:
            referans = date.today()
        baslangic = referans - timedelta(days=gun)

        # tarih kolonu DB'de TEXT olarak saklandığından str() ile karşılaştırıyoruz
        hareketler = db.query(StokHareketi).filter(
            StokHareketi.urun_id      == urun_id,
            StokHareketi.hareket_tipi == "cikis",
            StokHareketi.tarih        >= str(baslangic)
        ).order_by(StokHareketi.tarih).all()

        # Aynı tarihteki hareketleri topla (günlük aggregate)
        gunluk: dict = defaultdict(float)
        for h in hareketler:
            gunluk[str(h.tarih)] += h.miktar

        return [
            {"tarih": tarih, "miktar": round(miktar, 2)}
            for tarih, miktar in sorted(gunluk.items())
        ]
    except Exception as e:
        import traceback; traceback.print_exc()
        return []  # boş dizi döndür, frontend gracefully handle eder
