# Quick start

You need Python 3.13 and uv.

```bash
git clone https://github.com/Jakespitteler/Sound-Model.git
cd Sound-Model
uv sync
python -m uvicorn src.main:app --reload
```

<http://127.0.0.1:8000>, reloads on every change
