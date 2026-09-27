"""Turns an uploaded deviation document (PDF / DOCX / TXT / image) into plain text
that the LLM extraction node can read. This is the "PDF extraction tool" referenced
in the assignment deliverables - it is the first node of the LangGraph workflow.
"""
import io
from pypdf import PdfReader
from docx import Document as DocxDocument


class UnsupportedFileError(Exception):
    pass


def extract_text_from_file(filename: str, content: bytes) -> str:
    name = (filename or "").lower()

    if name.endswith(".pdf"):
        return _extract_pdf(content)
    if name.endswith(".docx"):
        return _extract_docx(content)
    if name.endswith((".txt", ".md", ".csv")):
        return content.decode("utf-8", errors="ignore")
    if name.endswith((".png", ".jpg", ".jpeg")):
        return _extract_image(content)
    if name.endswith((".xls", ".xlsx")):
        return _extract_xlsx(content)

    # Fall back: try to decode as text before giving up
    try:
        return content.decode("utf-8", errors="ignore")
    except Exception:
        raise UnsupportedFileError(f"Unsupported file type: {filename}")


def _extract_pdf(content: bytes) -> str:
    reader = PdfReader(io.BytesIO(content))
    pages = [page.extract_text() or "" for page in reader.pages]
    text = "\n".join(pages).strip()
    if not text:
        raise UnsupportedFileError(
            "Could not read any text from this PDF. It may be a scanned image - "
            "try pasting the text instead."
        )
    return text


def _extract_docx(content: bytes) -> str:
    doc = DocxDocument(io.BytesIO(content))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    for table in doc.tables:
        for row in table.rows:
            paragraphs.append(" | ".join(cell.text for cell in row.cells))
    return "\n".join(paragraphs)


def _extract_xlsx(content: bytes) -> str:
    from openpyxl import load_workbook

    wb = load_workbook(io.BytesIO(content), data_only=True)
    lines = []
    for sheet in wb.worksheets:
        for row in sheet.iter_rows(values_only=True):
            cells = [str(c) for c in row if c is not None]
            if cells:
                lines.append(" | ".join(cells))
    return "\n".join(lines)


def _extract_image(content: bytes) -> str:
    """OCR fallback for scanned notes / photos. Requires the tesseract binary
    to be installed on the host (apt-get install tesseract-ocr). If it isn't
    available, we raise a clear, actionable error instead of failing silently.
    """
    try:
        import pytesseract
        from PIL import Image

        img = Image.open(io.BytesIO(content))
        text = pytesseract.image_to_string(img).strip()
        if not text:
            raise UnsupportedFileError(
                "No text could be detected in this image. Try pasting the notes as text instead."
            )
        return text
    except ImportError as e:
        raise UnsupportedFileError(
            "Image OCR isn't available in this environment (pytesseract/tesseract-ocr not "
            "installed). Please paste the text instead, or upload a PDF/DOCX."
        ) from e
