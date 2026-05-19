from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
UPLOAD_DIR = BASE_DIR / "uploads"
DATABASE_PATH = BASE_DIR / "docunexus.db"
MAX_UPLOAD_MB = 50

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".pptx", ".xlsx", ".xls", ".csv"}

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
