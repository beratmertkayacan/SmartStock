from sqlalchemy import Column, Integer, Float, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class Siparis(Base):
    __tablename__ = "siparisler"

    siparis_id        = Column(Integer, primary_key=True, index=True)
    urun_id           = Column(Integer, ForeignKey("urunler.urun_id"))
    tedarikci_id      = Column(Integer, ForeignKey("tedarikciler.tedarikci_id"))
    tarih             = Column(Date)
    miktar            = Column(Float)
    birim_fiyat       = Column(Float)
    siparis_maliyeti_tl = Column(Float)
    toplam_tutar      = Column(Float)

    urun      = relationship("Urun", back_populates="siparisler")
    tedarikci = relationship("Tedarikci", back_populates="siparisler")
