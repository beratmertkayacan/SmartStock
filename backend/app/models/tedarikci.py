from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base

class Tedarikci(Base):
    __tablename__ = "tedarikciler"

    tedarikci_id      = Column(Integer, primary_key=True, index=True)
    tedarikci_adi     = Column(String, nullable=False)
    sehir             = Column(String)
    teslim_suresi_gun = Column(Integer)

    urunler   = relationship("Urun", back_populates="tedarikci")
    siparisler = relationship("Siparis", back_populates="tedarikci")
