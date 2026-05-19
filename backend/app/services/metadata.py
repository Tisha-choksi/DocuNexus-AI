from pathlib import Path


def build_common_metadata(path: Path, original_filename: str, extension: str) -> dict[str, str]:
    stat = path.stat()
    return {
        "original_filename": original_filename,
        "stored_filename": path.name,
        "extension": extension.lstrip("."),
        "file_size_bytes": str(stat.st_size),
    }


def text_stats(pages: list[dict]) -> tuple[int, int]:
    full_text = " ".join(page.get("text", "") for page in pages)
    words = [word for word in full_text.split() if word.strip()]
    return len(words), len(full_text)

def text_stats(pages: list[dict]) -> tuple[int, int]:
    full_text = " ".join(page.get("text","")for page in page)
    words = [word for word in full_text.split() if word.strip()]
    