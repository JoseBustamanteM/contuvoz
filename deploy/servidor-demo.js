// Servidor para mostrar la app desde tu PC con un túnel de Cloudflare.
// Hace lo mismo que Nginx en la VPS, sin instalar nada:
//
//   /       → frontend compilado (dist/contuvoz/browser)
//   /api/   → backend NestJS (http://127.0.0.1:4000)
//
// Uso (desde la raíz del proyecto, con el backend ya corriendo):
//   npm run demo                       (compila el frontend y arranca esto)
//   cloudflared tunnel --url http://localhost:8080
//
// Variables opcionales: PUERTO_DEMO (8080), BACKEND_DEMO (http://127.0.0.1:4000).

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PUERTO = Number(process.env.PUERTO_DEMO ?? 8080);
const BACKEND = new URL(process.env.BACKEND_DEMO ?? 'http://127.0.0.1:4000');
const RAIZ = path.resolve(__dirname, '..', 'dist', 'contuvoz', 'browser');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
};

if (!fs.existsSync(path.join(RAIZ, 'index.html'))) {
  console.error(`✗ No encuentro el frontend compilado en ${RAIZ}\n  Ejecuta primero: npm run build`);
  process.exit(1);
}

function proxyApi(req, res) {
  const peticion = http.request(
    {
      hostname: BACKEND.hostname,
      port: BACKEND.port,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        // El backend registra la IP del visitante en cada inicio de sesión.
        'x-forwarded-for': [req.headers['x-forwarded-for'], req.socket.remoteAddress].filter(Boolean).join(', '),
      },
    },
    (respuesta) => {
      res.writeHead(respuesta.statusCode ?? 502, respuesta.headers);
      respuesta.pipe(res);
    },
  );
  peticion.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('El backend no responde. ¿Está corriendo en ' + BACKEND.origin + '?');
  });
  req.pipe(peticion);
}

function servirArchivo(req, res) {
  const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let archivo = path.resolve(RAIZ, '.' + ruta);

  // Nada fuera de la carpeta del frontend (p. ej. /../../.env).
  if (archivo !== RAIZ && !archivo.startsWith(RAIZ + path.sep)) {
    res.writeHead(403);
    return res.end();
  }

  const existe = fs.existsSync(archivo) && fs.statSync(archivo).isFile();
  if (!existe) {
    // Un archivo con extensión que no existe es un 404 de verdad; una ruta
    // sin extensión (/login, /mis-logros) es de Angular: index.html.
    if (path.extname(ruta)) {
      res.writeHead(404);
      return res.end();
    }
    archivo = path.join(RAIZ, 'index.html');
  }

  res.writeHead(200, {
    'Content-Type': TIPOS[path.extname(archivo).toLowerCase()] ?? 'application/octet-stream',
    'Cache-Control': archivo.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(archivo).pipe(res);
}

http
  .createServer((req, res) => (req.url.startsWith('/api/') ? proxyApi(req, res) : servirArchivo(req, res)))
  .listen(PUERTO, () => {
    console.log(`✔ ContuVoz en http://localhost:${PUERTO}  (backend: ${BACKEND.origin})`);
    console.log(`  Para mostrarla: cloudflared tunnel --url http://localhost:${PUERTO}`);
  });
