from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class Urun(Base):
    __tablename__ = "urunler"

    urun_id                    = Column(Integer, primary_key=True, index=True)
    urun_adi                   = Column(String, nullable=False)
    kategori                   = Column(String)
    birim                      = Column(String)
    maliyet_fiyati             = Column(Float)
    satis_fiyati               = Column(Float)
    tedarikci_id               = Column(Integer, ForeignKey("tedarikciler.tedarikci_id"))
    min_stok_seviyesi          = Column(Integer)
    max_stok_seviyesi          = Column(Integer)
    mevcut_stok                = Column(Float)
    sezon_paterni              = Column(String)
    siparis_maliyeti_tl        = Column(Float)
    yillik_tutma_maliyeti_oran = Column(Float)

    tedarikci  = relationship("Tedarikci", back_populates="urunler")
    hareketler = relationship("StokHareketi", back_populates="urun")
    siparisler = relationship("Siparis", back_populates="urun")
