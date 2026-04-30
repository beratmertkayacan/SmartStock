#EOQ Modeli ----> S:Sipariş Maliyet, H:Tutma Maliyeti

#optimal sipariş miktarı(Q*) = her siparişte bu kadar alırsan maliyet minimum olur.
#sipariş noktası = stok bu seviyeyi görürse sipaeriş ver (günlük talep x teslim süresi)
#güvenllik stoğu = uç durum beklenmeyen olaylarda tampon; talep artışı, teslimat gecikmesi
#sipariş gerekli mi = mevcut stok sipariş noktasının altında mı (true, false döndür) dashboarda uyarı ver 


import math
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.urun import Urun
from app.models.stok_hareketi import StokHareketi

def eoq_hesapla(urun_id: int, db: Session) -> dict:
    urun = db.query(Urun).filter(Urun.urun_id == urun_id).first()
    if not urun:
        return {"hata": "Ürün bulunamadı"}

    # Yıllık talep — stok hareketlerinden hesapla
    yillik_talep = db.query(
        func.sum(StokHareketi.miktar)
    ).filter(
        StokHareketi.urun_id == urun_id,
        StokHareketi.hareket_tipi == "cikis"
    ).scalar() or 0

    # 1.5 yıllık veri var, yıllığa çevir
    yillik_talep = yillik_talep / 1.5

    if yillik_talep == 0:
        return {"hata": "Yeterli satış verisi yok"}

    S = urun.siparis_maliyeti_tl          # Sipariş maliyeti
    H = urun.maliyet_fiyati * urun.yillik_tutma_maliyeti_oran  # Birim tutma maliyeti

    # EOQ Formülü: Q* = sqrt(2DS/H)
    q_star = math.sqrt((2 * yillik_talep * S) / H)

    # Sipariş noktası — teslim süresi boyunca tüketim
    gunluk_talep = yillik_talep / 365
    tedarikci = urun.tedarikci
    teslim_suresi = tedarikci.teslim_suresi_gun if tedarikci else 5
    reorder_point = gunluk_talep * teslim_suresi

    # Güvenlik stoğu — günlük talebin 1.5 katı x teslim süresi
    guvenlik_stogu = gunluk_talep * 1.5 * teslim_suresi

    return {
        "urun_id": urun_id,
        "urun_adi": urun.urun_adi,
        "yillik_tahmini_talep": round(yillik_talep, 2),
        "optimal_siparis_miktari": round(q_star, 2),
        "siparis_noktasi": round(reorder_point, 2),
        "guvenlik_stogu": round(guvenlik_stogu, 2),
        "mevcut_stok": urun.mevcut_stok,
        "siparis_gerekli_mi": urun.mevcut_stok <= max(reorder_point, urun.min_stok_seviyesi),
        "aciklama": {
            "S_siparis_maliyeti": S,
            "H_tutma_maliyeti": round(H, 2),
            "D_yillik_talep": round(yillik_talep, 2)
        }
    }