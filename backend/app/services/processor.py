from pathlib import Path

from ..database import get_connection, now_iso
from .docx_service import extract_docx
from .metadata import build_common_metadata, text_stats
from .ocr_service import ocr_pdf, should_run_ocr
from .pdf_service import extract_pdf
from .pptx_service import extract_pptx
from .spreadsheet_service import extract_spreadsheet


def process_document(document_id: int, path: Path, original_filename: str, extension: str) -> dict:
    if extension == ".pdf":
        pages, metadata = extract_pdf(path)
        ocr_used = 0
        if should_run_ocr(pages):
            try:
                pages = ocr_pdf(path)
                ocr_used = 1
                metadata["ocr_status"] = "completed"
            except RuntimeError as exc:
                metadata["ocr_status"] = str(exc)
    elif extension == ".docx":
        pages, metadata = extract_docx(path)
        ocr_used = 0
    elif extension == ".pptx":
        pages, metadata = extract_pptx(path)
        ocr_used = 0
    elif extension in {".xlsx", ".xls", ".csv"}:
        pages, metadata = extract_spreadsheet(path, extension)
        ocr_used = 0
    else:
        raise ValueError("Unsupported document type")

    metadata.update(build_common_metadata(path, original_filename, extension))
    word_count, char_count = text_stats(pages)
    page_count = len(pages)

    with get_connection() as conn:
        conn.execute("DELETE FROM document_pages WHERE document_id = ?", (document_id,))
        conn.execute("DELETE FROM document_metadata WHERE document_id = ?", (document_id,))

        for page in pages:
            conn.execute(
                "INSERT INTO document_pages (document_id, page_number, text) VALUES (?, ?, ?)",
                (document_id, page["page_number"], page["text"]),
            )

        for key, value in metadata.items():
            conn.execute(
                "INSERT INTO document_metadata (document_id, key, value) VALUES (?, ?, ?)",
                (document_id, key, str(value)),
            )

        conn.execute(
            """
            UPDATE documents
            SET stored_filename = ?, page_count = ?, word_count = ?, char_count = ?,
                status = ?, ocr_used = ?, updated_at = ?
            WHERE id = ?
            """,
            (path.name, page_count, word_count, char_count, "processed", ocr_used, now_iso(), document_id),
        )

    return {
        "id": document_id,
        "original_filename": original_filename,
        "file_type": extension.lstrip("."),
        "page_count": page_count,
        "word_count": word_count,
        "char_count": char_count,
        "ocr_used": bool(ocr_used),
    }
