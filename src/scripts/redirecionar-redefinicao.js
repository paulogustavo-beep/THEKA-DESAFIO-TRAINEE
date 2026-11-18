// A API envia este caminho no e-mail. Encaminhe apenas os dados da redefinição.
const parametros = new URLSearchParams(window.location.search);
const destino = new URL('../pages/redefinir-senha.html', document.currentScript.src);

for (const campo of ['uid', 'token']) {
    if (parametros.getAll(campo).length === 1) {
        destino.searchParams.set(campo, parametros.get(campo));
    }
}

window.location.replace(destino.href);