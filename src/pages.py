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


def machine_estimates_page() -> HTMLResponse:
    """Expose the origin and limitations of the provisional catalogue in the app.

    Returns:
        Static source notes describing guesses, blocked research and acoustic units.
    """
    return HTMLResponse((TEMPLATES / "machine-estimates.html").read_text(encoding="utf-8"))


def about_page() -> HTMLResponse:
    """Explain reference levels, geometric spreading and model scope in plain language.

    Returns:
        Standalone About page, opened separately to preserve unsaved scenario work.
    """
    return HTMLResponse((TEMPLATES / "about.html").read_text(encoding="utf-8"))
