# DocuNexus AI — Infrastructure Document

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Browser (SPA)                         │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ index.html  │  │  styles.css  │  │      app.js        │  │
│  │  (HTML shell)│  │  (all styles) │  │ (fetch, DOM,      │  │
│  │             │  │              │  │  drag-drop, search,│  │
│  │             │  │              │  │  summary, chat,    │  │
│  │             │  │              │  │  export)           │  │
│  └──────┬──────┘  └──────────────┘  └──────────┬─────────┘  │
│         │                                       │            │
└─────────┼───────────────────────────────────────┼────────────┘
          │ Static files served by FastAPI        │ HTTP (fetch)
          ▼                                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    FastAPI / Uvicorn Server                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ main.py ──► mounts frontend/ as static files           │  │
│  │            includes documents router at /api/documents │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                   │
│  ┌────────────────────────▼───────────────────────────────┐  │
│  │              api/documents.py (10 REST endpoints)      │  │
│  │  POST /upload   │  GET/{id}/summary  │  GET/{id}/export│  │
│  │  GET /          │  POST/{id}/chat    │  GET/{id}/dl    │  │
│  │  GET /search    │  GET/{id}          │  DELETE/{id}    │  │
│  │  GET/{id}/text  │                                      │  │
│  └─────────┬───────┼────────────┬─────────────────────────┘  │
│            │       │            │                             │
│  ┌─────────▼──┐ ┌──▼─────────┐ ┌▼────────────┐             │
│  │pdf_service │ │docx_service│ │pptx_service │             │
│  │ (PyMuPDF)  │ │(python-docx)│ │(python-pptx)│             │
│  └──────┬─────┘ └────────────┘ └─────────────┘             │
│         │                                                    │
│         ▼ (fallback for scanned PDFs)                       │
│  ┌──────────────┐                                           │
│  │ ocr_service  │ ──► Tesseract OCR (system)                │
│  │ (pdf2image + │                                           │
│  │  pytesseract)│                                           │
│  └──────────────┘                                           │
│                                                              │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │spreadsheet_service│  │export_service │  │ insights.py  │  │
│  │ (openpyxl/xlrd/  │  │(txt/csv/pdf)  │  │(summary,     │  │
│  │  csv reader)     │  │ (reportlab)   │  │ search, chat)│  │
│  └──────────────────┘  └──────────────┘  └──────────────┘  │
│                                                              │
│  ┌────────────────────────▼───────────────────────────────┐  │
│  │                      SQLite DB                          │  │
│  │  documents │ document_pages │ document_metadata        │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend framework | FastAPI 0.115.6 (Python) |
| ASGI server | Uvicorn 0.34.0 |
| Database | SQLite 3 (single file: `docunexus.db`) |
| PDF extraction | PyMuPDF (fitz) 1.25.1 |
| DOCX extraction | python-docx 1.1.2 |
| PPTX extraction | python-pptx 1.0.2 |
| XLSX reading | openpyxl 3.1.5 |
| XLS reading | xlrd 2.0.1 |
| CSV reading | Built-in `csv` module |
| PDF generation | reportlab 4.2.5 |
| OCR (optional) | pytesseract + pdf2image + Pillow (requires Tesseract system install) |
| Frontend | Vanilla HTML5 / CSS3 / ES6+ (no framework) |
| File uploads | python-multipart 0.0.20 |

---

## File Structure

```
DocuNexus AI/
├── .gitignore                          # Git ignore rules
├── README.md                           # Project overview & API reference
├── infra.md                            # THIS FILE
├── docunexus.db                        # SQLite database (created at runtime)
├── uploads/                            # Uploaded files stored on disk
│   └── .gitkeep                        # Placeholder to keep dir in git
│
├── backend/
│   ├── README.md                       # Backend run instructions
│   ├── requirements.txt                # Python dependencies (pip)
│   │
│   └── app/
│       ├── __init__.py                 # Package marker (empty)
│       ├── main.py                     # FastAPI app entry point
│       ├── config.py                   # Paths, upload limits, allowed extensions
│       ├── database.py                 # SQLite schema + connection helpers
│       │
│       ├── api/
│       │   ├── __init__.py             # Package marker (empty)
│       │   └── documents.py            # All 10 REST API routes
│       │
│       └── services/
│           ├── __init__.py             # Package marker (empty)
│           ├── processor.py            # Orchestrator: dispatch, OCR fallback, DB write
│           ├── metadata.py             # Common metadata builder + text stats
│           ├── pdf_service.py          # PyMuPDF text extraction
│           ├── docx_service.py         # python-docx extraction (single "page")
│           ├── pptx_service.py         # python-pptx extraction (per-slide pages)
│           ├── ocr_service.py          # Tesseract-based OCR for scanned PDFs
│           ├── spreadsheet_service.py  # XLSX / XLS / CSV reading + CSV/PDF conversion
│           ├── export_service.py       # Export extracted pages to TXT / CSV / PDF
│           └── insights.py             # Summary, key points, search, question-answering
│
└── frontend/
    ├── index.html                      # SPA shell (upload, library, detail, summary, chat)
    ├── styles.css                      # All styling (~530 lines, responsive)
    └── app.js                          # All frontend logic (~470 lines, vanilla JS)
```

---

## What Each File Does

### Root

| File | Purpose |
|------|---------|
| `.gitignore` | Excludes `.venv/`, `__pycache__/`, `*.pyc`, `docunexus.db`, and `uploads/*` from git (except `.gitkeep`) |
| `README.md` | Project overview, setup steps, API endpoint reference |
| `uploads/` | Directory where uploaded files are stored on disk (named `{id}_{original_filename}`) |

### Backend — Entry & Config

| File | Purpose |
|------|---------|
| `backend/requirements.txt` | Lists all Python dependencies for `pip install` (10 packages) |
| `backend/app/__init__.py` | Package marker |
| `backend/app/main.py` | Creates FastAPI `app` instance, enables CORS (all origins), initializes DB on startup, mounts the `frontend/` directory as static files at `/`, and registers the documents router at `/api/documents` |
| `backend/app/config.py` | Defines `BASE_DIR` (project root), `UPLOAD_DIR`, `DATABASE_PATH`, `MAX_UPLOAD_MB` (50), and `ALLOWED_EXTENSIONS` (`.pdf`, `.docx`, `.pptx`, `.xlsx`, `.xls`, `.csv`). Ensures `UPLOAD_DIR` exists. |
| `backend/app/database.py` | Defines SQLite schema (3 tables), provides `get_connection()` context manager (auto-commits, enforces foreign keys), `init_db()` to create tables, and `now_iso()` helper for UTC timestamps |

### Backend — API Layer

| File | Purpose |
|------|---------|
| `backend/app/api/__init__.py` | Package marker |
| `backend/app/api/documents.py` | **All 10 REST endpoints** on an `APIRouter`; validates file types/sizes, delegates processing to `processor.py`, handles cross-document search (`/search`), document-level summarization (`/{id}/summary`), question-answering chat (`/{id}/chat`), content export (`/{id}/export`) to TXT/CSV/PDF, serves file downloads, and handles deletion of DB records + disk files |

### Backend — Services Layer

| File | Purpose |
|------|---------|
| `backend/app/services/__init__.py` | Package marker |
| `backend/app/services/processor.py` | **Central orchestrator** called by the API after file upload; dispatches to the correct format extractor (PDF/DOCX/PPTX/XLSX/XLS/CSV), runs OCR fallback for scanned PDFs (text < 80 chars), writes pages + metadata to the database, updates document status to `"processed"`, and returns a summary dict |
| `backend/app/services/metadata.py` | `build_common_metadata()` — produces filename, extension, size metadata; `text_stats()` — counts words and characters from extracted pages |
| `backend/app/services/pdf_service.py` | `extract_pdf()` — opens PDF with PyMuPDF (`fitz`), extracts text page by page, extracts document metadata (title, author, subject, etc.) |
| `backend/app/services/docx_service.py` | `extract_docx()` — reads DOCX with `python-docx`, extracts all paragraph text + table cell text (pipe-joined), extracts core properties; DOCX has no page concept, so all text is stored as a single "page" with `page_number=1` |
| `backend/app/services/pptx_service.py` | `extract_pptx()` — iterates all slides and shapes via `python-pptx`, extracts text per slide, extracts core properties; each slide becomes one "page" entry |
| `backend/app/services/ocr_service.py` | `should_run_ocr()` — returns `True` if total extracted text < 80 chars; `ocr_pdf()` — converts PDF pages to images via `pdf2image`, runs Tesseract via `pytesseract`, returns per-page OCR text (lazy imports; raises `RuntimeError` if system tools missing) |
| `backend/app/services/spreadsheet_service.py` | `read_spreadsheet()` — reads CSV (built-in), XLSX (openpyxl), XLS (xlrd) into sheet/page format. `extract_spreadsheet()` — converts spreadsheet rows to page text with sheet names. `spreadsheet_to_csv()` and `spreadsheet_to_pdf()` — convert the first sheet to CSV file or styled PDF table using reportlab |
| `backend/app/services/export_service.py` | `export_pages_to_txt()` — writes extracted pages to a plain-text file with page headers. `export_pages_to_csv()` — writes page number + text pairs to CSV. `export_pages_to_pdf()` — renders pages as a styled PDF document using reportlab |
| `backend/app/services/insights.py` | **NLP-free insights engine** using TF-like frequency scoring. `summarize_pages()` — extracts top-ranked sentences as summary + key points (up to 5). `search_pages()` — finds query terms in page text with snippet extraction. `answer_question()` — ranks sentences by query term relevance, returns top 4 as answer with source page numbers |

### Frontend

| File | Purpose |
|------|---------|
| `frontend/index.html` | SPA shell with 4 sections: (1) top bar with title + Refresh button, (2) upload panel with drag-and-drop zone (accepts `.pdf`, `.docx`, `.pptx`, `.xlsx`, `.xls`, `.csv`, ≤ 50 MB each), (3) stats grid (docs/pages/words/OCR count), (4) workspace with library sidebar (search + document list + error display) and detail panel (export control, content search, Text/Summary/Chat/Metadata tabs, download, delete) |
| `frontend/styles.css` | ~530 lines of responsive CSS using custom properties for theming; CSS Grid layout; status pills, tabs (4-panel), drag-and-drop states, chat messages, search results, metadata table, detail stats, export control; responsive breakpoints at 920px and 560px |
| `frontend/app.js` | ~470 lines of vanilla JavaScript; fetches from `/api/documents/*` REST endpoints; handles: file upload with drag-and-drop (per-file success/failure reporting), document listing with real-time search filtering, 4-tab view (Text / Summary / Chat / Metadata), content search within extracted text, summarization (lazy-load), chat (question-answer with source page numbers), export to TXT/CSV/PDF via blob download, download original file, delete, stats calculation; HTML escaping for XSS prevention |

---

## Database Schema

Three tables in `docunexus.db` (SQLite):

```sql
documents (
    id, original_filename, stored_filename, file_type, file_size,
    page_count, word_count, char_count, status, ocr_used,
    error_message, uploaded_at, updated_at
)

document_pages (
    id, document_id (FK → documents.id CASCADE),
    page_number, text
)

document_metadata (
    id, document_id (FK → documents.id CASCADE),
    key, value
)
```

- **`documents.status`**: `"processing"` → `"processed"` or `"failed"`
- **`documents.ocr_used`**: `0` or `1` (boolean)
- `document_pages` and `document_metadata` are deleted and rebuilt on each reprocess
- For spreadsheets, each sheet becomes a page with `"Sheet: {name}\n{row data}"` text

---

## API Endpoints

All routes are prefixed with `/api/documents`:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/upload` | Upload 1+ files (multipart). Validates extension & size. Inserts DB row, writes file, extracts text. Returns per-file `processed` / `rejected` / `failed` |
| `GET` | `/` | List all documents (summary fields) ordered by upload date DESC |
| `GET` | `/search?query=` | Cross-document full-text search. Searches all processed documents for matching terms, returns matched documents with page numbers and snippets |
| `GET` | `/{id}` | Full document detail: row + pages array + metadata key-value dict |
| `GET` | `/{id}/text` | Concatenated page text (`"Page N\n...\n\nPage M\n..."`) |
| `GET` | `/{id}/summary` | Extractive summary: returns `summary` (top 3 sentences) and `key_points` (top 5 sentences) using TF-frequency sentence ranking |
| `POST` | `/{id}/chat` | Question-answering: accepts `{"question": "..."}`, returns `answer` (top 4 relevant sentences) and `sources` (page numbers) |
| `GET` | `/{id}/export?format=txt\|csv\|pdf` | Export extracted content. TXT: plain-text pages. CSV: page_number/text rows. PDF: styled document via reportlab. Spreadsheet files automatically use their row data for CSV/PDF exports |
| `GET` | `/{id}/download` | Download the original uploaded file |
| `DELETE` | `/{id}` | Delete document, its pages, metadata, and stored file from disk |

---

## User Interaction Flow

```
1. USER OPENS BROWSER  ──►  http://127.0.0.1:8000
                             │
                             ▼
2. SEES INTERFACE:      ┌─────────────────────────────────┐
                        │  Upload panel                   │
   ┌─────────────────┐  │  Stats grid (0/0/0/0)           │
   │  Drop files or  │  │  Library sidebar (empty)        │
   │  browse →       │  │  Detail panel (empty,           │
   │  PDF/DOCX/PPTX/ │  │    "Select a document")         │
   │  XLSX/XLS/CSV   │  └─────────────────────────────────┘
   └────────┬────────┘
            ▼
3. FILES DROPPED      ──►  Names & sizes shown
   "Upload & Process" ──►  POST /api/documents/upload
                            │
                            ▼
4. BACKEND PROCESSES:  ┌───────────────────────────────┐
                       │  File saved to disk           │
                       │  DB: status=processing        │
                       │  PDF  ─► PyMuPDF (+OCR)       │
                       │  DOCX ─► python-docx          │
                       │  PPTX ─► python-pptx          │
                       │  XLSX ─► openpyxl             │
                       │  XLS  ─► xlrd                 │
                       │  CSV  ─► csv module           │
                       │  DB: status=processed         │
                       └───────────────────────────────┘
                            │
                            ▼
5. FRONTEND REFRESH:   ──►  Stats updated
                            Library shows new doc
                            Auto-selects first processed doc
                            │
                            ▼
6. DOCUMENT DETAIL:    ┌────────────────────────────────┐
   ┌────────────────┐  │  Text tab: page-by-page text   │
   │ Text  │Summary │  │  Summary tab: extractive       │
   │───────│────────│  │    summary + key points        │
   │ Chat  │Metadata│  │  Chat tab: ask questions,      │
   └────────────────┘  │    get relevant excerpts       │
                       │  Metadata tab: author, title,   │
                       │    dates, OCR, sheets, etc.    │
                       │  Content search: find text     │
                       │    within the document          │
                       │  Export: download as TXT/CSV/  │
                       │    PDF (spreadsheets use rows) │
                       │  Original: download uploaded   │
                       │  Delete: remove everything     │
                       └────────────────────────────────┘

7. CONTENT SEARCH     ──►  Type in "Search inside extracted text"
                            Shows matching snippets per page
                            in real-time client-side

8. SUMMARY            ──►  Click Summary tab
                            Lazy-loads GET /{id}/summary
                            Shows extractive summary + bullet
                            key points (TF-frequency ranked)

9. CHAT               ──►  Type a question, click Ask
                            POST /{id}/chat { question }
                            Returns top 4 relevant sentences
                            with source page numbers

10. EXPORT            ──►  Select TXT / CSV / PDF
                            Click Export button
                            GET /{id}/export?format=...
                            Blob download with correct filename

11. SEARCH ACROSS     ──►  (Not exposed in UI yet — API only)
     ALL DOCUMENTS        GET /api/documents/search?query=...
                            Returns matching documents with
                            page numbers and snippets
```

### Key Behaviors

- **Upload**: User drops files or browses, clicks "Upload and Process". Multiple files are processed sequentially. Unsupported types or oversized files are reported per-file without failing the entire batch. After upload, the first successfully processed file is auto-selected.
- **Search (library)**: Typing in the Library search bar filters documents in real-time by filename (case-insensitive).
- **Content search**: Typing in "Search inside extracted text" finds matching snippets within the currently open document, rendered client-side from loaded page data.
- **Tabs**: The detail panel has 4 tabs — Text, Summary, Chat, Metadata. Summary is lazy-loaded on first click. Chat shows a greeting on first open.
- **Summary**: Extractive summarization using sentence ranking by word frequency (no AI/ML). Top 3 sentences as summary, top 5 as key points.
- **Chat**: Question-answering using the same frequency-based sentence ranking. Returns up to 4 relevant sentences with source page numbers.
- **Export**: Extracted content can be exported as TXT (plain text), CSV (page rows), or PDF (styled reportlab document). Spreadsheet files automatically use their row data for CSV/PDF exports.
- **Download**: Serves the original file from disk with its original filename.
- **Delete**: Removes the database record (cascading to pages and metadata) and the stored file from disk.
- **OCR fallback**: PDFs with negligible extracted text (< 80 chars) are automatically re-processed via Tesseract OCR. Requires system-installed Tesseract and Poppler.

---

## Known Issues

- `backend/app/services/metadata.py` defines `text_stats` twice (lines 15 and 19). The second definition references undefined variable `page` (should be `pages`). Python's first definition wins at runtime, so the bug is benign but should be cleaned up.
