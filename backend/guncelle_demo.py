"""
Tüm hareketleri gerçekçi demo verisiyle günceller.
Çalıştır: python guncelle_demo.py
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models.stok_hareketi import StokHareketi

TEDARIKCILER = [
    "Çelik Yapı Malzemeleri A.Ş.",
    "Özgür İnşaat Ürünleri Ltd. Şti.",
    "Yılmaz Boya & Kimya San. Tic. A.Ş.",
    "Anadolu Seramik Dağıtım A.Ş.",
    "Türk Demir Çelik Pazarlama Ltd.",
    "Güneş Boru Sistemleri San. Tic.",
    "Akdeniz İzolasyon & Yalıtım A.Ş.",
    "Atlas Alet & Ekipman Dağıtım A.Ş.",
    "Marmara Yapı Kimyasalları Ltd.",
    "Ege Yapı Malzemeleri Toptan A.Ş.",
    "Boğaziçi İnşaat Tedarik A.Ş.",
    "Karadeniz Demir Çelik Dağıtım",
    "Başkent Yapı Market Toptan Ltd.",
    "Koç Elektrik & Tesisat Malzemeleri",
    "Metro Yapı Ürünleri San. A.Ş.",
]

MUSTERILER = [
    "Kartal İnşaat Taahhüt A.Ş.",
    "Şahin Yapı Kooperatifi",
    "Öztürk Müteahhitlik Ltd. Şti.",
    "Demirci İnşaat San. ve Tic. A.Ş.",
    "Güven Yapı Grubu A.Ş.",
    "Aras Konut Projeleri Ltd.",
    "Baran İnşaat Taahhüt ve Yapı",
    "Yücel Yapı Market Zinciri",
    "Korkmaz Tadilat & Dekorasyon",
    "Sarı İnşaat Malzemeleri Tic.",
    "Kaya Yapı Taahhüt A.Ş.",
    "Doğan Müteahhitlik Hizmetleri",
    "Aslan Yapı & Gayrimenkul Ltd.",
    "Demir Grup İnşaat San. A.Ş.",
    "Yıldız Konut Yapı Kooperatifi",
]

GIRIS_ACIKLAMALARI = [
    "Yıllık sözleşme kapsamında alım",
    "Sezonluk stok yenilemesi",
    "Kampanya dönemi ön stoklama",
    "Tedarikçi promosyon alımı",
    "Acil stok takviyesi",
    "Yeni sezon ürün girişi",
    "Toplu alım indirimi kapsamında",
    "Depo doluluk planlaması gereği",
    "Çeyrek dönem mal girişi",
    "İade ürün kabulü — hasar yok",
    "Sözleşmeli tedarik — 3 aylık",
    "Yıl sonu stok dengeleme alımı",
]

CIKIS_ACIKLAMALARI = [
    "Şantiye teslimatı — malzeme çıkışı",
    "Proje bazlı satış",
    "Toplu sipariş — fatura kesimli",
    "Kampanya dönemi satışı",
    "Müşteri talebi üzerine peşin satış",
    "Kurumsal müşteri teslimatı",
    "İhale kapsamı malzeme çıkışı",
    "Özel proje malzeme tedariki",
    "Sezonluk müşteri siparişi",
    "Perakende satış — nakit",
    "Çek karşılığı toplu satış",
    "Abonelik müşteri aylık çıkışı",
]

db = SessionLocal()

print("Tüm hareketler güncelleniyor...")
kayitlar = db.query(StokHareketi).all()
toplam = len(kayitlar)

for i, h in enumerate(kayitlar):
    fatura_no = f"FAT-2026-{str(10000 + (h.hareket_id % 89999)).zfill(5)}"

    if h.hareket_tipi == "giris":
        tedarikci = TEDARIKCILER[h.hareket_id % len(TEDARIKCILER)]
        aciklama  = GIRIS_ACIKLAMALARI[h.hareket_id % len(GIRIS_ACIKLAMALARI)]
    else:
        tedarikci = MUSTERILER[h.hareket_id % len(MUSTERILER)]
        aciklama  = CIKIS_ACIKLAMALARI[h.hareket_id % len(CIKIS_ACIKLAMALARI)]

    h.aciklama = json.dumps({
        "fatura_no": fatura_no,
        "tedarikci_musteri": tedarikci,
        "aciklama": aciklama
    }, ensure_ascii=False)

    if (i + 1) % 5000 == 0:
        db.commit()
        print(f"  {i+1}/{toplam} tamamlandı...")

db.commit()
db.close()
print(f"✓ {toplam} kayıt güncellendi.")
