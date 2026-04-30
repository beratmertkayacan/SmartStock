import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.stok_hareketi import StokHareketi
from app.models.urun import Urun
from pydantic import BaseModel
from datetime import date
from typing import Optional

router = APIRouter(prefix="/hareketler", tags=["Stok Hareketleri"])


class HareketiOlustur(BaseModel):
    urun_id: int
    hareket_tipi: str           # "giris" | "cikis"
    miktar: float
    birim_fiyat: Optional[float] = None
    tarih: Optional[str] = None # "YYYY-MM-DD"
    fatura_no: Optional[str] = ""
    tedarikci_musteri: Optional[str] = ""
    aciklama: Optional[str] = ""


class HareketiGuncelle(BaseModel):
    hareket_tipi: Optional[str] = None
    miktar: Optional[float] = None
    birim_fiyat: Optional[float] = None
    tarih: Optional[str] = None
    fatura_no: Optional[str] = None
    tedarikci_musteri: Optional[str] = None
    aciklama: Optional[str] = None


def meta_encode(fatura_no: str, tedarikci_musteri: str, aciklama: str) -> str:
    """Ekstra alanları JSON olarak aciklama'ya göm."""
    return json.dumps({
        "fatura_no": fatura_no or "",
        "tedarikci_musteri": tedarikci_musteri or "",
        "aciklama": aciklama or ""
    }, ensure_ascii=False)


def meta_decode(aciklama_str: str) -> dict:
    """aciklama alanından ekstra alanları çıkar."""
    try:
        d = json.loads(aciklama_str or "{}")
        return {
            "fatura_no": d.get("fatura_no", ""),
            "tedarikci_musteri": d.get("tedarikci_musteri", ""),
            "aciklama": d.get("aciklama", "")
        }
    except Exception:
        # Eski plain-text değerler (Satış, giris vb.) kullanıcı notu değil — boş döndür
        return {"fatura_no": "", "tedarikci_musteri": "", "aciklama": ""}


def hareket_to_dict(h: StokHareketi) -> dict:
    meta = meta_decode(h.aciklama)
    return {
        "hareket_id": h.hareket_id,
        "urun_id": h.urun_id,
        "urun_adi": h.urun.urun_adi if h.urun else "",
        "kategori": h.urun.kategori if h.urun else "",
        "birim": h.urun.birim if h.urun else "",
        "tarih": str(h.tarih),
        "hareket_tipi": h.hareket_tipi,
        "miktar": h.miktar,
        "birim_fiyat": h.birim_fiyat,
        "fatura_no": meta["fatura_no"],
        "tedarikci_musteri": meta["tedarikci_musteri"],
        "aciklama": meta["aciklama"],
    }


@router.get("/toplam")
def hareket_toplam(db: Session = Depends(get_db)):
    """Gerçek toplam kayıt sayısı ve giriş/çıkış istatistikleri."""
    from sqlalchemy import func
    toplam   = db.query(func.count(StokHareketi.hareket_id)).scalar() or 0
    giris_s  = db.query(func.count(StokHareketi.hareket_id)).filter(StokHareketi.hareket_tipi == "giris").scalar() or 0
    cikis_s  = db.query(func.count(StokHareketi.hareket_id)).filter(StokHareketi.hareket_tipi == "cikis").scalar() or 0
    giris_m  = db.query(func.sum(StokHareketi.miktar)).filter(StokHareketi.hareket_tipi == "giris").scalar() or 0
    cikis_m  = db.query(func.sum(StokHareketi.miktar)).filter(StokHareketi.hareket_tipi == "cikis").scalar() or 0
    return {
        "toplam": toplam,
        "giris_sayisi": giris_s,
        "cikis_sayisi": cikis_s,
        "giris_miktar": float(giris_m),
        "cikis_miktar": float(cikis_m),
    }


@router.get("/")
def hareket_listesi(limit: int = 200, db: Session = Depends(get_db)):
    hareketler = db.query(StokHareketi)\
        .options(joinedload(StokHareketi.urun))\
        .order_by(StokHareketi.hareket_id.desc())\
        .limit(limit).all()
    return [hareket_to_dict(h) for h in hareketler]


@router.post("/")
def hareket_ekle(hareket: HareketiOlustur, db: Session = Depends(get_db)):
    urun = db.query(Urun).filter(Urun.urun_id == hareket.urun_id).first()
    if not urun:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")

    if hareket.hareket_tipi == "cikis" and urun.mevcut_stok < hareket.miktar:
        raise HTTPException(status_code=400, detail="Yetersiz stok")

    if hareket.hareket_tipi == "giris":
        urun.mevcut_stok += hareket.miktar
    elif hareket.hareket_tipi == "cikis":
        urun.mevcut_stok -= hareket.miktar

    tarih_obj = date.fromisoformat(hareket.tarih) if hareket.tarih else date.today()
    birim_fiyat = hareket.birim_fiyat if hareket.birim_fiyat is not None else (
        urun.satis_fiyati if hareket.hareket_tipi == "cikis" else urun.maliyet_fiyati
    )

    yeni = StokHareketi(
        urun_id=hareket.urun_id,
        tarih=tarih_obj,
        hareket_tipi=hareket.hareket_tipi,
        miktar=hareket.miktar,
        birim_fiyat=birim_fiyat,
        aciklama=meta_encode(hareket.fatura_no, hareket.tedarikci_musteri, hareket.aciklama)
    )
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return {"durum": "başarılı", "yeni_stok": urun.mevcut_stok, "hareket_id": yeni.hareket_id}


@router.put("/{hareket_id}")
def hareket_guncelle(hareket_id: int, guncelleme: HareketiGuncelle, db: Session = Depends(get_db)):
    h = db.query(StokHareketi).filter(StokHareketi.hareket_id == hareket_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hareket bulunamadı")

    urun = db.query(Urun).filter(Urun.urun_id == h.urun_id).first()

    # Eski hareketi geri al
    if h.hareket_tipi == "giris":
        urun.mevcut_stok -= h.miktar
    else:
        urun.mevcut_stok += h.miktar

    # Güncellemeleri uygula
    if guncelleme.hareket_tipi is not None:
        h.hareket_tipi = guncelleme.hareket_tipi
    if guncelleme.miktar is not None:
        h.miktar = guncelleme.miktar
    if guncelleme.birim_fiyat is not None:
        h.birim_fiyat = guncelleme.birim_fiyat
    if guncelleme.tarih is not None:
        h.tarih = date.fromisoformat(guncelleme.tarih)

    meta = meta_decode(h.aciklama)
    if guncelleme.fatura_no is not None:
        meta["fatura_no"] = guncelleme.fatura_no
    if guncelleme.tedarikci_musteri is not None:
        meta["tedarikci_musteri"] = guncelleme.tedarikci_musteri
    if guncelleme.aciklama is not None:
        meta["aciklama"] = guncelleme.aciklama
    h.aciklama = json.dumps(meta, ensure_ascii=False)

    # Yeni hareketi stoka yansıt
    if h.hareket_tipi == "giris":
        urun.mevcut_stok += h.miktar
    else:
        if urun.mevcut_stok < h.miktar:
            raise HTTPException(status_code=400, detail="Yetersiz stok")
        urun.mevcut_stok -= h.miktar

    db.commit()
    return {"durum": "güncellendi", "yeni_stok": urun.mevcut_stok}


@router.delete("/{hareket_id}")
def hareket_sil(hareket_id: int, db: Session = Depends(get_db)):
    h = db.query(StokHareketi).filter(StokHareketi.hareket_id == hareket_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hareket bulunamadı")

    urun = db.query(Urun).filter(Urun.urun_id == h.urun_id).first()
    if urun:
        if h.hareket_tipi == "giris":
            urun.mevcut_stok -= h.miktar
        else:
            urun.mevcut_stok += h.miktar

    db.delete(h)
    db.commit()
    return {"durum": "silindi"}
