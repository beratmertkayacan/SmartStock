from pydantic import BaseModel
from typing import Optional

class UrunBase(BaseModel):
    urun_adi: str
    kategori: Optional[str] = None
    birim: Optional[str] = None
    maliyet_fiyati: Optional[float] = None
    satis_fiyati: Optional[float] = None
    min_stok_seviyesi: Optional[int] = None
    max_stok_seviyesi: Optional[int] = None
    mevcut_stok: Optional[float] = None

class UrunCreate(UrunBase):
    pass

class UrunUpdate(BaseModel):
    urun_adi: Optional[str] = None
    kategori: Optional[str] = None
    birim: Optional[str] = None
    maliyet_fiyati: Optional[float] = None
    satis_fiyati: Optional[float] = None
    min_stok_seviyesi: Optional[int] = None
    max_stok_seviyesi: Optional[int] = None
    mevcut_stok: Optional[float] = None

class UrunResponse(UrunBase):
    urun_id: int
    tedarikci_id: Optional[int] = None
    sezon_paterni: Optional[str] = None
    siparis_maliyeti_tl: Optional[float] = None
    yillik_tutma_maliyeti_oran: Optional[float] = None

    class Config:
        from_attributes = True
