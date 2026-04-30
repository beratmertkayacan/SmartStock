"""
Son 365 güne ait sezonsal ağırlıklı demo verisi ekler.
Çalıştır (backend/ klasöründen):  python demo_14gun.py

Sezon profili (yapı marketi):
  Ocak-Şubat   → düşük (0.4)
  Mart-Nisan   → yükseliş (0.9)
  Mayıs-Ağustos → pik (1.3)
  Eylül-Ekim   → orta (1.0)
  Kasım-Aralık → düşüş (0.6)
"""
import sys, os, json, random
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(__file__))
from app.database import SessionLocal
from app.models.stok_hareketi import StokHareketi
from app.models.urun import Urun

# ── Sabitler ────────────────────────────────────────────────────────────────
TEDARIKCILER = [
    "Çelik Yapı Malzemeleri A.Ş.", "Özgür İnşaat Ürünleri Ltd. Şti.",
    "Yılmaz Boya & Kimya San. Tic. A.Ş.", "Anadolu Seramik Dağıtım A.Ş.",
    "Türk Demir Çelik Pazarlama Ltd.", "Güneş Boru Sistemleri San. Tic.",
    "Akdeniz İzolasyon & Yalıtım A.Ş.", "Atlas Alet & Ekipman Dağıtım A.Ş.",
    "Marmara Yapı Kimyasalları Ltd.", "Ege Yapı Malzemeleri Toptan A.Ş.",
]
MUSTERILER = [
    "Kartal İnşaat Taahhüt A.Ş.", "Şahin Yapı Kooperatifi",
    "Öztürk Müteahhitlik Ltd. Şti.", "Demirci İnşaat San. ve Tic. A.Ş.",
    "Güven Yapı Grubu A.Ş.", "Aras Konut Projeleri Ltd.",
    "Baran İnşaat Taahhüt ve Yapı", "Yücel Yapı Market Zinciri",
    "Korkmaz Tadilat & Dekorasyon", "Kaya Yapı Taahhüt A.Ş.",
]
GIRIS_ACK = [
    "Sezonluk stok yenilemesi", "Yıllık sözleşme kapsamında alım",
    "Toplu alım indirimi kapsamında", "Acil stok takviyesi",
    "Çeyrek dönem mal girişi", "Tedarikçi promosyon alımı",
    "Depo doluluk planlaması gereği", "Yeni sezon ürün girişi",
]
CIKIS_ACK = [
    "Şantiye teslimatı — malzeme çıkışı", "Proje bazlı satış",
    "Toplu sipariş — fatura kesimli", "Kurumsal müşteri teslimatı",
    "Müşteri talebi üzerine peşin satış", "Özel proje malzeme tedariki",
    "Sezonluk müşteri siparişi", "Perakende satış — nakit",
]

# Ay bazlı sezonsal çarpan (1=Ocak … 12=Aralık)
SEZON = {1:0.35, 2:0.40, 3:0.85, 4:0.95, 5:1.25, 6:1.35,
         7:1.30, 8:1.20, 9:1.00, 10:0.90, 11:0.55, 12:0.40}

# Haftanın günü yoğunluk (0=Pzt … 6=Paz)
GUN_YOGUNLUK = {0:1.2, 1:1.3, 2:1.2, 3:1.1, 4:1.4, 5:0.7, 6:0.3}

def meta_encode(fatura_no, tedarikci_musteri, aciklama):
    return json.dumps({
        "fatura_no": fatura_no,
        "tedarikci_musteri": tedarikci_musteri,
        "aciklama": aciklama
    }, ensure_ascii=False)

def rastgele_miktar(urun, tip):
    birim = (urun.birim or "adet").lower()
    if birim in ("ton",):
        base = random.uniform(0.5, 6)
    elif birim == "kg":
        base = random.uniform(50, 400)
    elif birim in ("m", "m2", "m3"):
        base = random.uniform(10, 150)
    elif birim == "lt":
        base = random.uniform(20, 250)
    else:
        base = random.uniform(5, 60)
    if tip == "giris":
        base *= random.uniform(1.5, 3.0)
    return round(base, 1)


def main():
    db = SessionLocal()
    urunler = db.query(Urun).all()
    if not urunler:
        print("Ürün bulunamadı!"); db.close(); return

    bugun = date.today()
    GUN_SAYISI = 365          # son 1 yıl
    TOPLU_COMMIT = 500        # her X kayıtta commit

    print(f"Son {GUN_SAYISI} gün için demo verisi oluşturuluyor…")
    print(f"  {len(urunler)} ürün mevcut\n")

    toplam = 0
    fatura_sayac = 200000

    for gun_geri in range(GUN_SAYISI - 1, -1, -1):
        hedef = bugun - timedelta(days=gun_geri)
        sezon     = SEZON[hedef.month]
        haftaici  = hedef.weekday()
        yogunluk  = GUN_YOGUNLUK[haftaici] * sezon

        # Bazı günler işlem yok (özellikle pazar + düşük sezon)
        if yogunluk < 0.15 or (haftaici == 6 and random.random() < 0.6):
            continue

        giris_sayisi = max(1, int(random.uniform(2, 6) * yogunluk))
        cikis_sayisi = max(1, int(random.uniform(4, 10) * yogunluk))

        secilen = random.sample(urunler, min(len(urunler), giris_sayisi + cikis_sayisi))

        # Girişler
        for urun in secilen[:giris_sayisi]:
            miktar = rastgele_miktar(urun, "giris")
            fiyat  = (urun.maliyet_fiyati or 0) * random.uniform(0.92, 1.05)
            fatura_sayac += 1
            h = StokHareketi(
                urun_id      = urun.urun_id,
                tarih        = hedef,
                hareket_tipi = "giris",
                miktar       = miktar,
                birim_fiyat  = round(fiyat, 2),
                aciklama     = meta_encode(
                    f"FAT-{hedef.year}-{str(fatura_sayac).zfill(6)}",
                    random.choice(TEDARIKCILER),
                    random.choice(GIRIS_ACK)
                )
            )
            urun.mevcut_stok = (urun.mevcut_stok or 0) + miktar
            db.add(h); toplam += 1

        # Çıkışlar
        for urun in secilen[giris_sayisi:giris_sayisi + cikis_sayisi]:
            miktar = rastgele_miktar(urun, "cikis")
            if (urun.mevcut_stok or 0) < miktar:
                miktar = max(1, round((urun.mevcut_stok or 5) * 0.3, 1))
            fiyat = (urun.satis_fiyati or 0) * random.uniform(0.97, 1.08)
            fatura_sayac += 1
            h = StokHareketi(
                urun_id      = urun.urun_id,
                tarih        = hedef,
                hareket_tipi = "cikis",
                miktar       = miktar,
                birim_fiyat  = round(fiyat, 2),
                aciklama     = meta_encode(
                    f"FAT-{hedef.year}-{str(fatura_sayac).zfill(6)}",
                    random.choice(MUSTERILER),
                    random.choice(CIKIS_ACK)
                )
            )
            urun.mevcut_stok = max(0, (urun.mevcut_stok or 0) - miktar)
            db.add(h); toplam += 1

        if toplam % TOPLU_COMMIT == 0:
            db.commit()
            print(f"  {toplam:>6} kayıt yazıldı… ({hedef})")

    db.commit()
    db.close()
    print(f"\n✓ Tamamlandı — {toplam} hareket eklendi.")


if __name__ == "__main__":
    main()
