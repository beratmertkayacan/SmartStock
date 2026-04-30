import pandas as pd
from sqlalchemy import create_engine
from dotenv import load_dotenv
import os

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

def import_csv(dosya, tablo, index=False):
    path = os.path.join(DATA_DIR, dosya)
    df = pd.read_csv(path)
    df.to_sql(tablo, engine, if_exists="replace", index=index)
    print(f"   {tablo}: {len(df)} satır yüklendi")


import_csv("tedarikciler.csv",    "tedarikciler")
import_csv("urunler.csv",         "urunler")
import_csv("stok_hareketleri.csv","stok_hareketleri")
import_csv("siparisler.csv",      "siparisler")
print("Tüm 4 Dosya verisi yüklendi!")
