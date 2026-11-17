import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const argumentoPorta = process.argv.indexOf('--port');
const porta = Number(process.env.PORT || (argumentoPorta >= 0 && process.argv[argumentoPorta + 1]) || 5173);
const tipos = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf'
};

createServer(async (pedido, resposta) => {
  if (!['GET', 'HEAD'].includes(pedido.method)) {
    resposta.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    const caminho = decodeURIComponent(new URL(pedido.url, 'http://localhost').pathname);
    let arquivo = resolve(raiz, '.' + caminho);
    if (arquivo !== resolve(raiz) && !arquivo.startsWith(resolve(raiz) + sep)) {
      resposta.writeHead(403).end('Acesso negado.');
      return;
    }
    if ((await stat(arquivo)).isDirectory()) arquivo = resolve(arquivo, 'index.html');
    const conteudo = await readFile(arquivo);
    resposta.writeHead(200, {
      'Content-Type': tipos[extname(arquivo)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    resposta.end(pedido.method === 'HEAD' ? undefined : conteudo);
  } catch {
    resposta.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Página não encontrada.');
  }
}).listen(porta, '0.0.0.0', () => console.log(`Theka: http://localhost:${porta}`));