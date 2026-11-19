"""Vercel Python serverless entry point. All /api/* routes are rewritten here."""

import json
import os
import sys
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlencode, urlparse

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))
from aquagrid.api import handle  # noqa: E402


class handler(BaseHTTPRequestHandler):  # noqa: N801 - name required by Vercel
    def _respond(self):
        length = int(self.headers.get("Content-Length") or 0)
        path = self.path
        url = urlparse(path)
        if url.path.rstrip("/") == "/api/index":
            # vercel.json rewrites /api/<route> -> /api/index?route=<route>
            query = parse_qs(url.query)
            route = (query.pop("route", [""])[0]).strip("/")
            path = "/api/" + route + ("?" + urlencode(query, doseq=True) if query else "")
        status, payload = handle(self.command, path, self.rfile.read(length) if length else b"")
        data = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    do_GET = do_POST = do_OPTIONS = _respond
