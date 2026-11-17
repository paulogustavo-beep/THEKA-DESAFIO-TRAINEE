import { readdir, readFile, access } from 'node:fs/promises';
import { resolve, dirname, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const erros = [];
let quantidade = 0;

async function verificar(pasta) {
  for (const item of await readdir(pasta, { withFileTypes: true })) {
    if (item.name.startsWith('.') || item.name === 'node_modules') continue;
    const arquivo = resolve(pasta, item.name);
    if (item.isDirectory()) { await verificar(arquivo); continue; }
    const extensao = extname(arquivo);
    if (!['.html', '.css', '.js', '.mjs'].includes(extensao)) continue;
    quantidade++;
    const texto = await readFile(arquivo, 'utf8');
    if (['.js', '.mjs'].includes(extensao)) {
      const resultado = spawnSync(process.execPath, ['--check', arquivo], { encoding: 'utf8' });
      if (resultado.status !== 0) erros.push(resultado.stderr.trim());
    }
    const referencias = extensao === '.html'
      ? [...texto.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(item => item[1])
      : extensao === '.css'
        ? [...texto.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)].map(item => item[1]) : [];
    for (const referencia of referencias) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(referencia)) continue;
      const destino = decodeURIComponent(referencia.split(/[?#]/)[0]);
      const caminho = destino.startsWith('/') ? resolve(raiz, '.' + destino) : resolve(dirname(arquivo), destino);
      try { await access(caminho); }
      catch { erros.push(`${relative(raiz, arquivo)}: referência inexistente ${referencia}`); }
    }
  }
}

await verificar(raiz);
if (erros.length) {
  console.error(erros.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`${quantidade} arquivos verificados: sintaxe JavaScript e referências locais válidas.`);
}