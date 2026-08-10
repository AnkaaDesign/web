# Servidor do Map Creator.
#
#   python serve.py            -> http://localhost:8765
#
# POR QUE NAO `python -m http.server`. No Windows, o SimpleHTTPRequestHandler
# descobre o MIME consultando o REGISTRO, e em muitas maquinas `.js` esta
# registrado como `text/plain`. O arquivo baixa normalmente — 200, bytes certos —
# mas o navegador RECUSA executar um modulo ES cujo Content-Type nao seja de
# JavaScript, e o erro que aparece e "Failed to fetch dynamically imported
# module", que parece um 404 e nao e. Foi exatamente assim que a primeira versao
# desta pagina abriu em branco com todos os arquivos respondendo 200.
#
# Aqui os tipos sao fixados no codigo, sem consultar o sistema.
import http.server
import socketserver
import os

PORT = 8765
TYPES = {
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".json": "application/json",
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".glb": "model/gltf-binary",
    ".png": "image/png",
    ".webp": "image/webp",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        return TYPES.get(ext) or super().guess_type(path)

    def end_headers(self):
        # sem cache, senao editar o layout e recarregar nao mostra nada
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *a):
        pass


os.chdir(os.path.dirname(os.path.abspath(__file__)))
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print("Map Creator em http://localhost:%d  (Ctrl+C para parar)" % PORT, flush=True)
    httpd.serve_forever()
