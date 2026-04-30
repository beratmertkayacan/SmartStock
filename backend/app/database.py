from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:sifre@localhost:5432/yapi_stok")

engine = create_engine(
    DATABASE_URL,
    connect_args={"connect_timeout": 5},   # 5 sn'de bağlanamazsa → hata ver
    pool_pre_ping=True,                     # Her istekte bağlantıyı kontrol et
    pool_recycle=300,                       # 5 dakikada bir bağlantıyı yenile
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
