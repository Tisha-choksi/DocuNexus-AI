from pathlib import Path


def should_run_ocr(pages: list[dict], min_chars: int = 80) -> bool:
    total_chars = sum(len(page.get("text", "").strip()) for page in pages)
    return total_chars < min_chars


def ocr_pdf(path: Path) -> list[dict]:
    try:
        from pdf2image import convert_from_path
        import pytesseract
    except ImportError as exc:
        raise RuntimeError("OCR dependencies are not installed. Install pdf2image, pytesseract, Tesseract OCR, and Poppler.") from exc

    images = convert_from_path(str(path))
    pages = []
    for index, image in enumerate(images, start=1):
        text = pytesseract.image_to_string(image)
        pages.append({"page_number": index, "text": text.strip()})
    return pages

