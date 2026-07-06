"""Static preview server that never touches the process cwd
(the launcher sandbox may deny getcwd), serving the site root."""
import os
import socketserver
from http.server import SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)


port = int(os.environ.get("PORT", "4173"))
socketserver.ThreadingTCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(("", port), Handler) as srv:
    print(f"serving {ROOT} on port {port}", flush=True)
    srv.serve_forever()
