from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class StokHareketi(Base):
    __tablename__ = "stok_hareketleri"

    hareket_id   = Column(Integer, primary_key=True, index=True)
    urun_id      = Column(Integer, ForeignKey("urunler.urun_id"))
    tarih        = Column(Date, nullable=False)
    hareket_tipi = Column(String)   # "giris" | "cikis"
    miktar       = Column(Float)
    birim_fiyat  = Column(Float)
    aciklama     = Column(String)

    urun = relationship("Urun", back_populates="hareketler")
