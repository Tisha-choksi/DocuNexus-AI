# DocuNexus AI

Phase 1 of an Enterprise Document Intelligence Platform.

## What Phase 1 Includes

- Multi-file upload
- PDF, DOCX, and PPTX parsing
- Normalized document pages
- Metadata extraction
- Optional OCR fallback for scanned PDFs
- SQLite storage
- FastAPI REST API
- Browser frontend for upload, library browsing, extracted text, metadata, download, and delete

## Project Structure

```text
backend/
  app/
    api/
    services/
    main.py
    database.py
    config.py
  requirements.txt
frontend/
  index.html
  styles.css
  app.js
uploads/
docunexus.db
```

## Run Locally

```powershell
cd "D:\claude code\DocuNexus AI\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Then open:

```text
http://127.0.0.1:8000
```

## API Endpoints

- `POST /api/documents/upload`
- `GET /api/documents`
- `GET /api/documents/{document_id}`
- `GET /api/documents/{document_id}/text`
- `GET /api/documents/{document_id}/download`
- `DELETE /api/documents/{document_id}`

## Free Tools Used

- FastAPI
- SQLite
- PyMuPDF
- python-docx
- python-pptx
- Tesseract OCR through pytesseract

