"""Local launcher: python run.py. Close the terminal or press Ctrl+C to stop."""

import argparse
import threading
import webbrowser

import uvicorn

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Start Sound-Model on this computer")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error("Use a port from 1024 to 65535")
    if not args.no_browser:
        # Open only after the server's health endpoint responds.
        def open_when_ready():
            import time
            import urllib.request

            for _ in range(40):
                try:
                    with urllib.request.urlopen(f"http://127.0.0.1:{args.port}/api/health", timeout=0.5) as r:
                        if r.status == 200:
                            webbrowser.open(f"http://127.0.0.1:{args.port}")
                            return
                except OSError:
                    time.sleep(0.25)

        threading.Thread(target=open_when_ready, daemon=True).start()
    uvicorn.run("src.main:app", host="127.0.0.1", port=args.port)
