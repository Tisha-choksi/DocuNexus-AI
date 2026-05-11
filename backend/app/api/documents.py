from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ..config import ALLOWED_EXTENSIONS, MAX_UPLOAD_MB, UPLOAD_DIR
from ..database import get_connection, now_iso
from ..services.processor import process_document


router = APIRouter()


def row_to_dict(row):
    return dict(row) if row else None


@router.post("/upload")
async def upload_documents(files: Annotated[list[UploadFile], File(...)]):
    if not files:
        raise HTTPException(status_code=400, detail="Upload at least one file.")

    results = []
    for file in files:
        original_name = Path(file.filename or "document").name
        extension = Path(original_name).suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            results.append({"filename": original_name, "status": "rejected", "error": "Unsupported file type"})
            continue

        content = await file.read()
        size_limit = MAX_UPLOAD_MB * 1024 * 1024
        if len(content) > size_limit:
            results.append({"filename": original_name, "status": "rejected", "error": f"File exceeds {MAX_UPLOAD_MB} MB"})
            continue

        uploaded_at = now_iso()
        with get_connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO documents (
                    original_filename, stored_filename, file_type, file_size, status, uploaded_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (original_name, "", extension.lstrip("."), len(content), "processing", uploaded_at, uploaded_at),
            )
            document_id = cursor.lastrowid

        stored_filename = f"{document_id}_{original_name}"
        stored_path = UPLOAD_DIR / stored_filename
        stored_path.write_bytes(content)

        try:
            summary = process_document(document_id, stored_path, original_name, extension)
            results.append({"filename": original_name, "status": "processed", "document": summary})
        except Exception as exc:
            with get_connection() as conn:
                conn.execute(
                    "UPDATE documents SET status = ?, error_message = ?, updated_at = ? WHERE id = ?",
                    ("failed", str(exc), now_iso(), document_id),
                )
            results.append({"filename": original_name, "status": "failed", "error": str(exc)})

    return {"uploaded": results}


@router.get("")
def list_documents():
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, original_filename, file_type, file_size, page_count, word_count,
                   char_count, status, ocr_used, error_message, uploaded_at, updated_at
            FROM documents
            ORDER BY uploaded_at DESC
            """
        ).fetchall()
    return {"documents": [row_to_dict(row) for row in rows]}


@router.get("/{document_id}")
def get_document(document_id: int):
    with get_connection() as conn:
        document = conn.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        pages = conn.execute(
            "SELECT page_number, text FROM document_pages WHERE document_id = ? ORDER BY page_number",
            (document_id,),
        ).fetchall()
        metadata = conn.execute(
            "SELECT key, value FROM document_metadata WHERE document_id = ? ORDER BY key",
            (document_id,),
        ).fetchall()

    return {
        "document": row_to_dict(document),
        "pages": [row_to_dict(row) for row in pages],
        "metadata": {row["key"]: row["value"] for row in metadata},
    }


@router.get("/{document_id}/text")
def get_document_text(document_id: int):
    with get_connection() as conn:
        document = conn.execute("SELECT id FROM documents WHERE id = ?", (document_id,)).fetchone()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        pages = conn.execute(
            "SELECT page_number, text FROM document_pages WHERE document_id = ? ORDER BY page_number",
            (document_id,),
        ).fetchall()
    text = "\n\n".join(f"Page {row['page_number']}\n{row['text']}" for row in pages)
    return {"document_id": document_id, "text": text}


@router.get("/{document_id}/download")
def download_document(document_id: int):
    with get_connection() as conn:
        document = conn.execute("SELECT original_filename, stored_filename FROM documents WHERE id = ?", (document_id,)).fetchone()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

    path = UPLOAD_DIR / document["stored_filename"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="Stored file not found")
    return FileResponse(path, filename=document["original_filename"])


@router.delete("/{document_id}")
def delete_document(document_id: int):
    with get_connection() as conn:
        document = conn.execute("SELECT stored_filename FROM documents WHERE id = ?", (document_id,)).fetchone()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        conn.execute("DELETE FROM documents WHERE id = ?", (document_id,))

    path = UPLOAD_DIR / document["stored_filename"]
    if path.exists():
        path.unlink()
    return {"status": "deleted", "document_id": document_id}

