"""Assemble the small HTML shell and reusable fragments without a template dependency."""

from pathlib import Path

from fastapi.responses import HTMLResponse

TEMPLATES = Path(__file__).parent / "templates"


def index_page() -> HTMLResponse:
    """Serve the initial page with all structural HTML included server-side.

    Returns:
        Complete HTML document; JavaScript only supplies interactive state.
    """
    page = (TEMPLATES / "index.html").read_text(encoding="utf-8")
    for partial in (TEMPLATES / "partials").glob("*.html"):
        page = page.replace("{{" + partial.stem + "}}", partial.read_text(encoding="utf-8"))
    return HTMLResponse(page)
