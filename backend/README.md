# DocuNexus AI Backend

Phase 1 backend for document upload, extraction, metadata storage, and optional OCR.

## Run

```powershell
cd "D:\claude code\DocuNexus AI\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000`.

## OCR Notes

OCR requires system installs in addition to Python packages:

- Tesseract OCR
- Poppler

The app still works without OCR system tools; scanned PDFs will show an OCR dependency message in metadata.

