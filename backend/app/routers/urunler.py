from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.urun import Urun
from app.schemas.urun import UrunCreate, UrunUpdate, UrunResponse

router = APIRouter(prefix="/urunler", tags=["Ürünler"])

@router.get("/", response_model=List[UrunResponse])
def urun_listesi(db: Session = Depends(get_db)):
    return db.query(Urun).order_by(Urun.urun_adi).all()

@router.get("/kritik", response_model=List[UrunResponse])
def kritik_stok(db: Session = Depends(get_db)):
    return db.query(Urun).filter(
        Urun.mevcut_stok <= Urun.min_stok_seviyesi
    ).all()

@router.post("/", status_code=201)
def urun_ekle(urun: UrunCreate, db: Session = Depends(get_db)):
    import traceback
    try:
        yeni = Urun(**urun.model_dump())
        db.add(yeni)
        db.commit()
        db.refresh(yeni)
        return {
            "urun_id":                    yeni.urun_id,
            "urun_adi":                   yeni.urun_adi,
            "kategori":                   yeni.kategori,
            "birim":                      yeni.birim,
            "maliyet_fiyati":             yeni.maliyet_fiyati,
            "satis_fiyati":               yeni.satis_fiyati,
            "min_stok_seviyesi":          yeni.min_stok_seviyesi,
            "max_stok_seviyesi":          yeni.max_stok_seviyesi,
            "mevcut_stok":                yeni.mevcut_stok,
            "tedarikci_id":               yeni.tedarikci_id,
            "sezon_paterni":              getattr(yeni, "sezon_paterni", None),
            "siparis_maliyeti_tl":        getattr(yeni, "siparis_maliyeti_tl", None),
            "yillik_tutma_maliyeti_oran": getattr(yeni, "yillik_tutma_maliyeti_oran", None),
        }
    except Exception as e:
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{urun_id}", response_model=UrunResponse)
def urun_guncelle(urun_id: int, guncel: UrunUpdate, db: Session = Depends(get_db)):
    urun = db.query(Urun).filter(Urun.urun_id == urun_id).first()
    if not urun:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    for key, value in guncel.model_dump(exclude_unset=True).items():
        setattr(urun, key, value)
    db.commit()
    db.refresh(urun)
    return urun

@router.delete("/{urun_id}")
def urun_sil(urun_id: int, db: Session = Depends(get_db)):
    urun = db.query(Urun).filter(Urun.urun_id == urun_id).first()
    if not urun:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    db.delete(urun)
    db.commit()
    return {"ok": True}

@router.get("/{urun_id}", response_model=UrunResponse)
def urun_detay(urun_id: int, db: Session = Depends(get_db)):
    urun = db.query(Urun).filter(Urun.urun_id == urun_id).first()
    if not urun:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    return urun
