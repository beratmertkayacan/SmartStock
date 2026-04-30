import traceback
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.database import engine, Base
from app.routers import urunler, hareketler, analitik, auth

# Tablolar yoksa oluştur
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Yapı Stok API",
    description="Akıllı Stok Takip Sistemi — Yapı Market",
    version="1.0.0"
)

# CORS — geliştirme ortamı için tamamen açık
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global hata yakalayıcı — 500 yerine JSON hata döndürür + terminale basar
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    hata_detay = traceback.format_exc()
    print(f"\n[HATA] {request.method} {request.url}\n{hata_detay}")
    return JSONResponse(
        status_code=500,
        content={"hata": str(exc), "tip": type(exc).__name__}
    )

# Router'ları bağla
app.include_router(auth.router)
app.include_router(urunler.router)
app.include_router(hareketler.router)
app.include_router(analitik.router)

@app.get("/")
def root():
    return {"durum": "çalışıyor", "versiyon": "1.0.0"}
