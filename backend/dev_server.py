"""Local development server for the AquaGrid simulation API (stdlib only).

    python3 backend/dev_server.py            # http://127.0.0.1:8000/api/health
"""

import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aquagrid.api import handle  # noqa: E402


class Handler(BaseHTTPRequestHandler):
    def _respond(self):
        length = int(self.headers.get("Content-Length") or 0)
        status, payload = handle(self.command, self.path, self.rfile.read(length) if length else b"")
        data = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    do_GET = do_POST = do_OPTIONS = _respond

    def log_message(self, fmt, *args):
        sys.stderr.write("[api] " + fmt % args + "\n")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    print(f"AquaGrid simulation API on http://127.0.0.1:{port}")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
