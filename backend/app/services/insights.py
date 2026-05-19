import re
from collections import Counter


STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have",
    "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "was", "were",
    "with", "you", "your", "i", "we", "they", "their", "our", "can", "will", "not",
}


def _page_text(pages: list[dict]) -> str:
    return "\n\n".join(page.get("text", "") for page in pages)


def _sentences(text: str) -> list[str]:
    compact = re.sub(r"\s+", " ", text).strip()
    if not compact:
        return []
    pieces = re.split(r"(?<=[.!?])\s+|\n+", compact)
    return [piece.strip() for piece in pieces if len(piece.strip()) > 25]


def _tokens(text: str) -> list[str]:
    words = re.findall(r"[A-Za-z0-9][A-Za-z0-9+'-]*", text.lower())
    return [word for word in words if word not in STOPWORDS and len(word) > 2]


def _rank_sentences(sentences: list[str], terms: list[str] | None = None) -> list[tuple[float, str]]:
    if not sentences:
        return []

    all_tokens = _tokens(" ".join(sentences))
    frequencies = Counter(all_tokens)
    query_terms = set(terms or [])
    ranked = []

    for index, sentence in enumerate(sentences):
        sentence_tokens = _tokens(sentence)
        if not sentence_tokens:
            continue
        frequency_score = sum(frequencies[token] for token in sentence_tokens)
        query_score = sum(5 for token in sentence_tokens if token in query_terms)
        length_penalty = max(len(sentence_tokens), 12)
        early_bonus = max(0, 3 - index) * 0.5
        ranked.append(((frequency_score + query_score) / length_penalty + early_bonus, sentence))

    return sorted(ranked, key=lambda item: item[0], reverse=True)


def summarize_pages(pages: list[dict]) -> dict:
    text = _page_text(pages)
    sentences = _sentences(text)
    ranked = _rank_sentences(sentences)
    key_points = [sentence for _, sentence in ranked[:5]]
    summary = " ".join(key_points[:3])

    return {
        "summary": summary or "No extractable text was found for this document.",
        "key_points": key_points,
    }


def search_pages(pages: list[dict], query: str) -> list[dict]:
    terms = _tokens(query)
    if not terms:
        return []

    results = []
    for page in pages:
        text = page.get("text", "")
        text_lower = text.lower()
        if not any(term in text_lower for term in terms):
            continue

        snippets = []
        for term in terms:
            match = re.search(re.escape(term), text, re.IGNORECASE)
            if not match:
                continue
            start = max(0, match.start() - 90)
            end = min(len(text), match.end() + 160)
            snippet = text[start:end].strip()
            snippets.append(re.sub(r"\s+", " ", snippet))

        results.append({
            "page_number": page.get("page_number"),
            "snippets": snippets[:3],
        })

    return results


def answer_question(pages: list[dict], question: str) -> dict:
    terms = _tokens(question)
    if not terms:
        return {
            "answer": "Ask a more specific question about this document.",
            "sources": [],
        }

    sentences_by_page = []
    for page in pages:
        for sentence in _sentences(page.get("text", "")):
            sentences_by_page.append((page.get("page_number"), sentence))

    ranked = _rank_sentences([sentence for _, sentence in sentences_by_page], terms)
    selected = []
    sources = []

    for _, sentence in ranked:
        if len(selected) >= 4:
            break
        if not any(term in sentence.lower() for term in terms):
            continue
        selected.append(sentence)
        page_number = next((page for page, item in sentences_by_page if item == sentence), None)
        if page_number and page_number not in sources:
            sources.append(page_number)

    if not selected:
        return {
            "answer": "I could not find a clear answer in the extracted text.",
            "sources": [],
        }

    return {
        "answer": " ".join(selected),
        "sources": sources,
    }
