# Talep Tahmin Modeli (Regresyon)
# Model eğitimi, kaydetme, tahmin fonksiyonları

import pandas as pd
import numpy as np
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
import joblib
import os
from sqlalchemy.orm import Session
from app.models.stok_hareketi import StokHareketi
from app.models.urun import Urun

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODEL_DIR, exist_ok=True)


# Ham satış verisini ML'e verebilmek için tarih, ay, mevsim sayısal özelliklere çevir
def veri_hazirla(urun_id: int, db: Session) -> pd.DataFrame:
    hareketler = db.query(StokHareketi).filter(
        StokHareketi.urun_id == urun_id,
        StokHareketi.hareket_tipi == "cikis"
    ).all()

    if not hareketler:
        return pd.DataFrame()

    df = pd.DataFrame([{
        "tarih": h.tarih,
        "miktar": h.miktar
    } for h in hareketler])

    df["tarih"] = pd.to_datetime(df["tarih"])
    df = df.groupby("tarih")["miktar"].sum().reset_index()
    df = df.sort_values("tarih")

    # Feature engineering kısmı hepsini çevir
    df["ay"]            = df["tarih"].dt.month
    df["gun_of_week"]   = df["tarih"].dt.dayofweek
    df["gun_of_year"]   = df["tarih"].dt.dayofyear
    df["ay_sin"]        = np.sin(2 * np.pi * df["ay"] / 12)
    df["ay_cos"]        = np.cos(2 * np.pi * df["ay"] / 12)
    df["gecmis_7_ort"]  = df["miktar"].rolling(7, min_periods=1).mean()
    df["gecmis_30_ort"] = df["miktar"].rolling(30, min_periods=1).mean()

    return df


def model_egit(urun_id: int, db: Session) -> dict:
    df = veri_hazirla(urun_id, db)
    if df.empty or len(df) < 30:
        return {"hata": "Yeterli veri yok", "veri_sayisi": len(df) if not df.empty else 0}

    # ay_sin ve ay_cos neden kullandık --> mevsimsellik 1(ocak) ile 12(aralık) birbirine yakın ama sayı olarak uzak görünür.
    # gun_of_week ---> haftanın günü etkisi
    # gun_of_year ---> yılın günü etkisi
    # kısa vadeli trend gecmis_7_ort / uzun vadeli trend gecmis_30_ort
    features = ["ay_sin", "ay_cos", "gun_of_week", "gun_of_year",
                "gecmis_7_ort", "gecmis_30_ort"]
    X = df[features].values
    y = df["miktar"].values

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = Ridge(alpha=1.0)
    model.fit(X_scaled, y)

    joblib.dump(model,  os.path.join(MODEL_DIR, f"model_{urun_id}.pkl"))
    joblib.dump(scaler, os.path.join(MODEL_DIR, f"scaler_{urun_id}.pkl"))

    return {"durum": "model eğitildi", "urun_id": urun_id, "veri_sayisi": len(df)}


def _fallback_tahmin(urun_id: int, gun: int, db: Session, veri_sayisi: int = 0) -> dict:
    """
    Yeterli veri yoksa veya ML modeli hata verirse basit hareketli ortalamaya
    dayalı bir tahmin döndürür. Hiçbir zaman exception fırlatmaz.
    """
    try:
        df = veri_hazirla(urun_id, db)
        if not df.empty and len(df) > 0:
            ort = float(df["miktar"].mean())
            gercek_veri_sayisi = len(df)
        else:
            ort = 1.0
            gercek_veri_sayisi = 0
    except Exception:
        ort = 1.0
        gercek_veri_sayisi = veri_sayisi

    try:
        urun = db.query(Urun).filter(Urun.urun_id == urun_id).first()
        urun_adi = urun.urun_adi if urun else ""
    except Exception:
        urun_adi = ""

    # Ortalama + küçük mevsimsel dalgalanma (~±10%)
    tahminler = []
    for i in range(1, gun + 1):
        varyasyon = 1 + 0.08 * np.sin(2 * np.pi * i / 30)
        tahmin = max(0.0, round(float(ort * varyasyon), 2))
        tahminler.append(tahmin)

    toplam = round(sum(tahminler), 2)
    return {
        "urun_id":             urun_id,
        "urun_adi":            urun_adi,
        "tahmin_gun_sayisi":   gun,
        "gunluk_tahminler":    tahminler,
        "toplam_tahmini_talep": toplam,
        "gunluk_ortalama":     round(toplam / gun, 2),
        "fallback":            True,
        "uyari": (
            f"Bu ürüne ait yalnızca {gercek_veri_sayisi} günlük satış kaydı bulunuyor. "
            "Tahminler mevcut verinin ortalamasına dayalı olarak gösterilmektedir; "
            "daha doğru sonuçlar için en az 30 günlük satış verisi gereklidir."
        ) if gercek_veri_sayisi < 30 else
        "Tahmin modeli geçici olarak kullanılamıyor. Ortalamaya dayalı tahminler gösteriliyor."
    }


def tahmin_yap(urun_id: int, gun: int, db: Session) -> dict:
    """
    Her zaman geçerli bir tahmin dict'i döndürür — asla exception fırlatmaz.
    Yeterli veri yoksa veya ML başarısız olursa fallback tahmin kullanılır.
    """
    try:
        model_path  = os.path.join(MODEL_DIR, f"model_{urun_id}.pkl")
        scaler_path = os.path.join(MODEL_DIR, f"scaler_{urun_id}.pkl")

        # Model henüz eğitilmemişse eğit
        if not os.path.exists(model_path):
            egitim = model_egit(urun_id, db)
            if "hata" in egitim:
                return _fallback_tahmin(urun_id, gun, db, egitim.get("veri_sayisi", 0))

        df = veri_hazirla(urun_id, db)

        # Veri boşsa fallback
        if df.empty or len(df) == 0:
            return _fallback_tahmin(urun_id, gun, db, 0)

        model  = joblib.load(model_path)
        scaler = joblib.load(scaler_path)

        bugun = pd.Timestamp.today()
        tahminler = []

        # NaN'ı önle
        son_7_ort  = float(df["miktar"].tail(7).mean())
        son_30_ort = float(df["miktar"].tail(30).mean())
        if np.isnan(son_7_ort):  son_7_ort  = float(df["miktar"].mean()) or 1.0
        if np.isnan(son_30_ort): son_30_ort = float(df["miktar"].mean()) or 1.0

        for i in range(1, gun + 1):
            tarih = bugun + pd.Timedelta(days=i)
            ay = tarih.month
            X = np.array([[
                np.sin(2 * np.pi * ay / 12),
                np.cos(2 * np.pi * ay / 12),
                tarih.dayofweek,
                tarih.dayofyear,
                son_7_ort,
                son_30_ort
            ]])
            X_scaled = scaler.transform(X)
            deger = max(0.0, float(model.predict(X_scaled)[0]))
            tahminler.append(round(deger, 2))

        urun = db.query(Urun).filter(Urun.urun_id == urun_id).first()

        return {
            "urun_id":              urun_id,
            "urun_adi":             urun.urun_adi if urun else "",
            "tahmin_gun_sayisi":    gun,
            "gunluk_tahminler":     tahminler,
            "toplam_tahmini_talep": round(sum(tahminler), 2),
            "gunluk_ortalama":      round(sum(tahminler) / gun, 2),
        }

    except Exception:
        # Herhangi beklenmedik hata → fallback, asla 500 dönme
        return _fallback_tahmin(urun_id, gun, db)