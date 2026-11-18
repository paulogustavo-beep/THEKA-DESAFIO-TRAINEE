import { readdir, readFile } from 'node:fs/promises';
import { resolve, dirname, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const erros = [];
let quantidade = 0;

async function existeComNomeExato(caminho) {
    let pasta = raiz;
    const partes = relative(raiz, caminho).split(sep).filter(Boolean);

    if (partes.includes('..')) {
        return false;
    }

    for (const parte of partes) {
        const nomes = await readdir(pasta);

        if (!nomes.includes(parte)) {
            return false;
        }

        pasta = resolve(pasta, parte);
    }

    return true;
}

async function verificar(pasta) {
    const itens = await readdir(pasta, { withFileTypes: true });

    for (const item of itens) {
        if (item.name.startsWith('.') || item.name === 'node_modules') {
            continue;
        }

        const arquivo = resolve(pasta, item.name);

        if (item.isDirectory()) {
            await verificar(arquivo);
            continue;
        }

        const extensao = extname(arquivo);

        if (!['.html', '.css', '.js', '.mjs'].includes(extensao)) {
            continue;
        }

        quantidade++;

        const texto = await readFile(arquivo, 'utf8');

        if (['.js', '.mjs'].includes(extensao)) {
            const resultado = spawnSync(
                process.execPath,
                ['--check', arquivo],
                { encoding: 'utf8' }
            );

            if (resultado.status !== 0) {
                erros.push(resultado.stderr.trim());
            }
        }

        let referencias = [];

        if (extensao === '.html') {
            referencias = [
                ...texto.matchAll(/(?:src|href)=["']([^"']+)["']/g)
            ].map(item => item[1]);
        } else if (extensao === '.css') {
            referencias = [
                ...texto.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)
            ].map(item => item[1]);
        } else {
            referencias = [
                ...texto.matchAll(
                    /\b(?:import|export)\s+(?:[\w*{},\s]+?\s+from\s*)?["']([^"']+)["']/g
                ),
                ...texto.matchAll(
                    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g
                )
            ]
                .map(item => item[1])
                .filter(item => item.startsWith('.') || item.startsWith('/'));
        }

        for (const referencia of referencias) {
            if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(referencia)) {
                continue;
            }

            const destino = decodeURIComponent(
                referencia.split(/[?#]/)[0]
            );

            const caminho = destino.startsWith('/')
                ? resolve(raiz, '.' + destino)
                : resolve(dirname(arquivo), destino);

            try {
                if (!await existeComNomeExato(caminho)) {
                    throw new Error('Arquivo ausente');
                }
            } catch {
                erros.push(
                    `${relative(raiz, arquivo)}: referência inexistente ou nome com maiúsculas/minúsculas diferentes: ${referencia}`
                );
            }
        }
    }
}

await verificar(raiz);

if (erros.length) {
    console.error(erros.join('\n'));
    process.exitCode = 1;
} else {
    console.log(
        `${quantidade} arquivos verificados: sintaxe JavaScript e referências locais válidas.`
    );
}