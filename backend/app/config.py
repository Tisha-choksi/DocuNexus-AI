import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
UPLOAD_DIR = BASE_DIR / "uploads"
DATABASE_PATH = BASE_DIR / "docunexus.db"
MAX_UPLOAD_MB = 50

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".pptx", ".xlsx", ".xls", ".csv"}

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

_raw = os.environ.get("CORS_ORIGINS", "http://localhost:5500,http://127.0.0.1:5500")
CORS_ORIGINS: list[str] = [o.strip() for o in _raw.split(",") if o.strip()]
