from pathlib import Path

import fitz


def extract_pdf(path: Path) -> tuple[list[dict], dict[str, str]]:
    doc = fitz.open(path)
    pages = []
    metadata = {key: str(value) for key, value in (doc.metadata or {}).items() if value}
    metadata["page_count"] = str(doc.page_count)

    for index, page in enumerate(doc, start=1):
        pages.append({"page_number": index, "text": page.get_text("text").strip()})

    doc.close()
    return pages, metadata

