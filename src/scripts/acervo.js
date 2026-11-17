import { livrosIniciais } from "../data/livros.js";

const $ = id => document.getElementById(id);
const CHAVE = "theka:acervo:v2";
const mobile = window.matchMedia("(max-width: 767px)");
const normalizar = valor => String(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const criar = (tag, classe, conteudo) => {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (conteudo !== undefined) elemento.textContent = conteudo;
    return elemento;
};
let temporario = false;
let livros = carregar();
let pagina = 1;
let destaque = 0;
let livroAberto = null;
let livroEdicao = null;
let capaEdicao = "";
let lendoImagem = false;
let versaoImagem = 0;
let avisoTimer;
let acionadorModal;

function capaValida(valor) {
    return typeof valor === "string" && (valor === "" || /^[a-z0-9-]+\.(png|jpg|webp)$/i.test(valor) ||
        (valor.length < 700000 && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(valor)));
}
function livroValido(livro) {
    return livro && typeof livro.id === "string" && livro.id.length > 0 &&
        typeof livro.titulo === "string" && livro.titulo.trim().length > 0 && livro.titulo.length <= 120 &&
        ["autor", "editora", "categoria", "isbn", "resumo"].every(campo => typeof livro[campo] === "string" && livro[campo].length <= 2000) &&
        (livro.ano === null || Number.isInteger(livro.ano) && livro.ano > 0 && livro.ano <= 2100) &&
        (livro.paginas === null || Number.isInteger(livro.paginas) && livro.paginas > 0 && livro.paginas <= 50000) && capaValida(livro.capa);
}
function carregar() {
    try {
        let salvo = localStorage.getItem(CHAVE);
        let migrar = false;
        if (salvo === null) {
            // Preserva o acervo local de uma versão anterior, sem apagar os dados.
            const anteriores = Object.keys(localStorage).filter(chave =>
                chave !== CHAVE && chave.startsWith("theka:acervo:") && chave.endsWith(":v2"));
            if (anteriores.length === 1) {
                salvo = localStorage.getItem(anteriores[0]);
                migrar = salvo !== null;
            }
        }
        if (salvo === null) return livrosIniciais.map(livro => ({ ...livro }));
        const dados = JSON.parse(salvo);
        if (dados.versao !== 2 || !Array.isArray(dados.livros) || !dados.livros.every(livroValido) ||
            new Set(dados.livros.map(livro => livro.id)).size !== dados.livros.length) throw new Error("Dados inválidos");
        if (migrar) {
            try { localStorage.setItem(CHAVE, salvo); }
            catch { temporario = true; }
        }
        return dados.livros;
    } catch {
        temporario = true;
        return livrosIniciais.map(livro => ({ ...livro }));
    }
}
function gravar(proximos) {
    if (!temporario) {
        try { localStorage.setItem(CHAVE, JSON.stringify({ versao: 2, livros: proximos })); }
        catch { throw new Error("Não foi possível salvar neste navegador. Tente usar uma imagem menor ou libere espaço de armazenamento."); }
    }
    livros = proximos;
}
function notificar(acao) {
    $("notificacao").textContent = `${acao} ${temporario ? "Alteração mantida somente nesta sessão." : "Alteração salva neste navegador."}`;
    $("notificacao").hidden = false;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => { $("notificacao").hidden = true; }, 5500);
}
function erro(mensagem = "") {
    $("erro-formulario").textContent = mensagem;
    $("erro-formulario").hidden = !mensagem;
}
function criarCapa(livro) {
    const capa = criar("div", "capa");
    capa.setAttribute("aria-hidden", "true");
    if (livro.capa) {
        const imagem = criar("img");
        imagem.src = livro.capa.startsWith("data:") ? livro.capa : `../assets/acervo/${livro.capa}`;
        imagem.alt = "";
        imagem.loading = "lazy";
        imagem.addEventListener("error", () => { imagem.remove(); capa.append(criar("span", "capa-titulo", livro.titulo)); }, { once: true });
        capa.append(imagem);
    } else capa.append(criar("span", "capa-titulo", livro.titulo));
    return capa;
}
function preencherFiltros() {
    for (const campo of ["categoria", "editora"]) {
        const seletor = $(campo);
        const anterior = seletor.value;
        const opcoes = [...new Set(livros.map(livro => livro[campo]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
        seletor.replaceChildren(new Option(campo === "categoria" ? "Gênero" : "Editora", ""));
        opcoes.forEach(valor => seletor.add(new Option(valor, valor)));
        if (livros.some(livro => !livro[campo])) seletor.add(new Option("Não informado", "__nao_informado"));
        if ([...seletor.options].some(opcao => opcao.value === anterior)) seletor.value = anterior;
    }
}
function filtrados() {
    const termo = normalizar($("busca").value);
    return livros.filter(livro => (!termo || normalizar(`${livro.titulo} ${livro.autor}`).includes(termo)) &&
        ["categoria", "editora"].every(campo => !$(campo).value || ($(campo).value === "__nao_informado" ? !livro[campo] : livro[campo] === $(campo).value)));
}
function renderizarCatalogo() {
    const lista = filtrados();
    const porPagina = mobile.matches ? 8 : 15;
    const total = Math.max(1, Math.ceil(lista.length / porPagina));
    pagina = Math.min(Math.max(1, pagina), total);
    const inicio = (pagina - 1) * porPagina;
    $("grade-livros").replaceChildren(...lista.slice(inicio, inicio + porPagina).map(livro => {
        const artigo = criar("article", "livro");
        const botao = criar("button", "livro-capa");
        botao.type = "button";
        botao.setAttribute("aria-label", `Ver informações de ${livro.titulo}`);
        botao.append(criarCapa(livro));
        botao.addEventListener("click", () => abrirDetalhe(livro.id));
        artigo.append(botao);
        return artigo;
    }));
    $("resultados").textContent = lista.length ? `Exibindo ${inicio + 1}–${Math.min(inicio + porPagina, lista.length)} de ${lista.length} ${lista.length === 1 ? "livro" : "livros"}` : "Nenhum livro encontrado";
    $("vazio").hidden = lista.length > 0;
    $("grade-livros").hidden = lista.length === 0;
    $("adicionar").classList.toggle("sem-resultados", lista.length === 0);
    $("limpar-busca").hidden = !$("busca").value && !$("categoria").value && !$("editora").value;
    const nav = $("paginacao");
    nav.replaceChildren();
    nav.hidden = lista.length === 0;
    function adicionarPagina(numero, rotulo, classe, desativado = false) {
        const botao = criar("button", classe, rotulo);
        botao.type = "button";
        botao.disabled = desativado;
        botao.setAttribute("aria-label", classe === "pagina" ? `Página ${numero}` : rotulo === "‹" ? "Página anterior" : "Próxima página");
        if (classe === "pagina" && numero === pagina) botao.setAttribute("aria-current", "page");
        botao.addEventListener("click", () => {
            pagina = numero;
            renderizarCatalogo();
            $("catalogo").scrollIntoView({ block: "start" });
            nav.querySelector('[aria-current="page"]')?.focus({ preventScroll: true });
        });
        nav.append(botao);
    }
    adicionarPagina(pagina - 1, "‹", "seta", pagina === 1);
    const primeira = Math.max(1, Math.min(pagina - 1, total - 2));
    for (let numero = primeira; numero <= Math.min(total, primeira + 2); numero++) adicionarPagina(numero, String(numero), "pagina");
    adicionarPagina(pagina + 1, "›", "seta", pagina === total);
}
function livrosEmDestaque() {
    const ordem = ["figma-1", "figma-3", "figma-4", "figma-5", "figma-2"];
    const originais = ordem.map(id => livros.find(livro => livro.id === id)).filter(Boolean);
    return [...originais, ...livros.filter(livro => !ordem.includes(livro.id))].slice(0, 5);
}
function selecionarDestaque(indice) {
    const lista = livrosEmDestaque();
    destaque = indice;
    const livro = lista[indice];
    $("destaque-titulo").textContent = livro?.titulo || "";
    $("destaque-autor").textContent = livro ? [livro.autor, livro.anoDestaque || livro.ano].filter(Boolean).join(" - ") : "";
    $("destaque-livros").querySelectorAll("button").forEach((botao, i) => {
        botao.classList.toggle("ativo", i === indice);
        botao.setAttribute("aria-expanded", String(i === indice));
    });
}
function renderizarDestaques() {
    const lista = livrosEmDestaque();
    destaque = Math.min(destaque, Math.max(0, lista.length - 1));
    $("destaque-livros").replaceChildren(...lista.map((livro, i) => {
        const botao = criar("button", "destaque-livro");
        botao.type = "button";
        botao.setAttribute("aria-label", `Destacar e ver ${livro.titulo}`);
        botao.append(criarCapa(livro));
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const uso = document.createElementNS("http://www.w3.org/2000/svg", "use");
        svg.classList.add("icone", "destaque-abrir");
        svg.setAttribute("aria-hidden", "true");
        uso.setAttribute("href", "#icone-seta"); svg.append(uso); botao.append(svg);
        botao.addEventListener("click", () => { if (destaque === i) abrirDetalhe(livro.id); else selecionarDestaque(i); });
        botao.addEventListener("pointerenter", evento => { if (evento.pointerType === "mouse") selecionarDestaque(i); });
        return botao;
    }));
    $("destaque-livros").hidden = lista.length === 0;
    selecionarDestaque(destaque);
}
function atualizar() { preencherFiltros(); renderizarCatalogo(); renderizarDestaques(); }
function filtrar() { pagina = 1; renderizarCatalogo(); }
function fecharFiltros() { $("filtros-opcoes").classList.remove("aberto"); $("abrir-filtros").setAttribute("aria-expanded", "false"); }
function limparBusca() { $("form-busca").reset(); filtrar(); $("busca").focus({ preventScroll: true }); }
function abrirModal(modal) {
    if (!document.querySelector("dialog[open]")) acionadorModal = document.activeElement;
    document.querySelectorAll("dialog[open]").forEach(aberto => aberto.close());
    modal.showModal();
}
function fecharModal(modal) {
    versaoImagem++;
    lendoImagem = false;
    modal.close();
    const destino = acionadorModal?.isConnected ? acionadorModal : $("adicionar");
    destino?.focus({ preventScroll: true });
}
function abrirDetalhe(id) {
    const livro = livros.find(item => item.id === id);
    if (!livro) return;
    livroAberto = id;
    $("detalhe-capa").replaceChildren(criarCapa(livro));
    $("detalhe-titulo").textContent = livro.titulo;
    $("detalhe-autor").textContent = [livro.autor, livro.ano].filter(Boolean).join(", ") || "Autor e ano não informados";
    $("detalhe-resumo").textContent = livro.resumo || "Resumo não informado.";
    $("detalhe-paginas").textContent = `páginas: ${livro.paginas || "não informado"}`;
    $("detalhe-editora").textContent = livro.editora || "Editora não informada";
    abrirModal($("modal-detalhe"));
}
function atualizarPrevia() {
    const anterior = $("capa-previa");
    anterior.replaceChildren();
    if (capaEdicao) anterior.append(criarCapa({ titulo: $("livro-titulo").value, capa: capaEdicao }));
    else {
        const vazio = criar("div", "capa-vazia");
        vazio.innerHTML = '<svg class="icone" viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="12" width="48" height="40" rx="4"/><circle cx="23" cy="25" r="5"/><path d="m9 46 16-13 10 8 9-10 11 15"/></svg>';
        anterior.append(vazio);
    }
    anterior.parentElement.classList.toggle("com-imagem", Boolean(capaEdicao));
    document.querySelector(".arquivo-botao").textContent = capaEdicao ? "Alterar imagem" : "Adicionar imagem";
}
function abrirEditor(id = null) {
    livroEdicao = id;
    const livro = livros.find(item => item.id === id);
    versaoImagem++;
    lendoImagem = false;
    $("salvar-livro").disabled = false;
    $("form-livro").reset();
    $("form-livro").querySelectorAll("input,textarea").forEach(campo => campo.setCustomValidity(""));
    for (const campo of ["titulo", "autor", "ano", "paginas", "editora", "categoria", "isbn", "resumo"]) $("livro-" + campo).value = livro?.[campo] ?? "";
    capaEdicao = livro?.capa || "";
    $("editor-titulo").textContent = livro ? "Editar material" : "Adicionar material ao catálogo";
    $("excluir-livro").hidden = !livro;
    erro(); atualizarPrevia(); abrirModal($("modal-editor"));
}
$("form-livro").addEventListener("submit", evento => {
    evento.preventDefault();
    if (lendoImagem) return;
    for (const campo of ["titulo", "autor", "editora", "categoria", "resumo"]) {
        const input = $("livro-" + campo);
        input.value = input.value.trim();
        input.setCustomValidity(input.value ? "" : "Preencha este campo.");
    }
    const isbn = $("livro-isbn").value.replace(/[\s-]/g, "").toUpperCase();
    $("livro-isbn").setCustomValidity(!isbn || /^(\d{9}[\dX]|\d{13})$/.test(isbn) ? "" : "Informe um ISBN com 10 ou 13 caracteres, ou deixe o campo vazio.");
    if (!evento.currentTarget.reportValidity()) return;
    if (!capaEdicao) { erro("Adicione a imagem da capa antes de salvar."); $("arquivo-capa").focus(); return; }
    const anterior = livros.find(livro => livro.id === livroEdicao);
    const livro = {
        ...anterior,
        id: livroEdicao || `livro-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        titulo: $("livro-titulo").value, autor: $("livro-autor").value, ano: Number($("livro-ano").value),
        paginas: Number($("livro-paginas").value), editora: $("livro-editora").value,
        isbn, resumo: $("livro-resumo").value, categoria: $("livro-categoria").value, capa: capaEdicao
    };
    if (anterior && anterior.ano !== livro.ano) delete livro.anoDestaque;
    try {
        if (!livroValido(livro)) throw new Error("Confira os dados do material antes de salvar.");
        gravar(livroEdicao ? livros.map(item => item.id === livroEdicao ? livro : item) : [livro, ...livros]);
        $("form-busca").reset(); pagina = 1;
        atualizar(); fecharModal($("modal-editor"));
        notificar(livroEdicao ? "Material atualizado." : "Material adicionado.");
    } catch (falha) { erro(falha.message); }
});
$("form-livro").addEventListener("input", evento => { evento.target.setCustomValidity?.(""); erro(); });
$("arquivo-capa").addEventListener("change", async evento => {
    const arquivo = evento.target.files[0];
    if (!arquivo) return;
    const versao = ++versaoImagem;
    lendoImagem = false; $("salvar-livro").disabled = false;
    erro();
    if (!["image/png", "image/jpeg", "image/webp"].includes(arquivo.type) || arquivo.size > 500 * 1024) {
        erro("Escolha uma imagem PNG, JPG ou WebP de até 500 KB."); evento.target.value = ""; return;
    }
    lendoImagem = true; $("salvar-livro").disabled = true;
    try {
        const data = await new Promise((resolve, reject) => {
            const leitor = new FileReader();
            leitor.onload = () => resolve(leitor.result);
            leitor.onerror = () => reject(new Error("Falha ao ler a imagem"));
            leitor.readAsDataURL(arquivo);
        });
        const imagem = new Image(); imagem.src = data; await imagem.decode();
        if (versao !== versaoImagem || !$("modal-editor").open) return;
        if (!capaValida(data)) throw new Error("Imagem inválida");
        capaEdicao = data; atualizarPrevia();
    } catch { if (versao === versaoImagem) erro("Não foi possível abrir essa imagem. Escolha outro arquivo."); }
    finally { if (versao === versaoImagem) { lendoImagem = false; $("salvar-livro").disabled = false; } }
});
$("excluir-livro").addEventListener("click", () => {
    try {
        gravar(livros.filter(livro => livro.id !== livroEdicao));
        atualizar(); fecharModal($("modal-editor")); notificar("Material excluído.");
    } catch (falha) { erro(falha.message); }
});
$("adicionar").addEventListener("click", () => abrirEditor());
$("editar-livro").addEventListener("click", () => abrirEditor(livroAberto));
$("cancelar-editor").addEventListener("click", () => fecharModal($("modal-editor")));
$("form-busca").addEventListener("submit", evento => { evento.preventDefault(); filtrar(); fecharFiltros(); });
$("busca").addEventListener("input", filtrar);
["categoria", "editora"].forEach(id => $(id).addEventListener("change", () => { if (!mobile.matches) filtrar(); }));
["limpar-busca", "recomecar-busca"].forEach(id => $(id).addEventListener("click", limparBusca));
$("abrir-filtros").addEventListener("click", () => {
    const aberto = $("filtros-opcoes").classList.toggle("aberto");
    $("abrir-filtros").setAttribute("aria-expanded", String(aberto));
    if (aberto) $("categoria").focus();
});
// No celular, o formulário ocupa a página e conserva o rodapé do mockup.
const rodapeEditor = document.querySelector(".rodape").cloneNode(true);
rodapeEditor.classList.add("editor-rodape");
rodapeEditor.removeAttribute("id");
rodapeEditor.querySelectorAll("[id]").forEach(elemento => elemento.removeAttribute("id"));
rodapeEditor.querySelectorAll("[aria-labelledby]").forEach(elemento => elemento.removeAttribute("aria-labelledby"));
$("modal-editor").append(rodapeEditor);
document.querySelectorAll("dialog").forEach(modal => {
    modal.querySelectorAll("[data-fechar]").forEach(botao => botao.addEventListener("click", () => fecharModal(modal)));
    modal.addEventListener("cancel", evento => { evento.preventDefault(); fecharModal(modal); });
    modal.addEventListener("click", evento => {
        const area = modal.getBoundingClientRect();
        if (evento.target === modal && (evento.clientX < area.left || evento.clientX > area.right || evento.clientY < area.top || evento.clientY > area.bottom)) fecharModal(modal);
    });
});
const botaoMenu = document.querySelector(".nav-abrir");
const menu = document.querySelector(".menu");
botaoMenu.addEventListener("click", () => {
    const aberto = menu.classList.toggle("aberto"); botaoMenu.setAttribute("aria-expanded", String(aberto));
});
document.addEventListener("keydown", evento => {
    if (evento.key === "Escape") {
        if ($("filtros-opcoes").classList.contains("aberto")) { fecharFiltros(); $("abrir-filtros").focus(); }
        if (menu.classList.contains("aberto")) { menu.classList.remove("aberto"); botaoMenu.setAttribute("aria-expanded", "false"); botaoMenu.focus(); }
    }
});
mobile.addEventListener("change", () => { pagina = 1; fecharFiltros(); renderizarCatalogo(); });
if (temporario) {
    $("aviso-local").classList.remove("sr-only");
    $("aviso-local").textContent = "O armazenamento deste navegador não está disponível. As alterações serão mantidas somente nesta sessão.";
}
atualizar();