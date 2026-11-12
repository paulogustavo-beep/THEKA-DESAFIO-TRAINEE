(() => {
    "use strict";

    const $ = id => document.getElementById(id);
    const CHAVE = "theka:acervo:desktop:v1";
    const POR_PAGINA = 15;
    const TEMAS = ["amarela", "azul", "verde", "rosa", "laranja", "roxa", "escura", "creme"];
    const registrosAnteriores = [
        ["A cabeça do santo", "Socorro Acioli", "Romance", "Companhia das Letras", 2016, 176],
        ["Dom Casmurro", "Machado de Assis", "Romance", "Editora Exemplo A", 1899, 256],
        ["O Cortiço", "Aluísio Azevedo", "Literatura brasileira", "Editora Exemplo B", 1890, 304],
        ["Vidas Secas", "Graciliano Ramos", "Literatura brasileira", "Editora Exemplo A", 1938, 176],
        ["Além do horizonte", "Autor de exemplo", "Aventura", "Editora Exemplo C", 2024, 240],
        ["O jardim das palavras", "Autor de exemplo", "Poesia", "Editora Exemplo B", 2023, 128],
        ["Atlas das estrelas", "Autor de exemplo", "Ciência", "Editora Exemplo C", 2025, 320],
        ["A cidade de papel", "Autor de exemplo", "Fantasia", "Editora Exemplo A", 2022, 288],
        ["Entre rios e memórias", "Autor de exemplo", "Romance", "Editora Exemplo B", 2024, 224],
        ["Pequenas descobertas", "Autor de exemplo", "Ciência", "Editora Exemplo C", 2021, 192],
        ["Cartas para amanhã", "Autor de exemplo", "Poesia", "Editora Exemplo A", 2025, 144],
        ["O mapa do vento", "Autor de exemplo", "Aventura", "Editora Exemplo B", 2023, 272],
        ["Quando o sol voltar", "Autor de exemplo", "Romance", "Editora Exemplo C", 2024, 208],
        ["Um lugar entre nuvens", "Autor de exemplo", "Fantasia", "Editora Exemplo A", 2022, 352],
        ["Caminhos do saber", "Autor de exemplo", "Ciência", "Editora Exemplo B", 2025, 264],
        ["A última estação", "Autor de exemplo", "Aventura", "Editora Exemplo C", 2023, 296],
        ["Palavras que florescem", "Autor de exemplo", "Poesia", "Editora Exemplo A", 2024, 112],
        ["O segredo da biblioteca", "Autor de exemplo", "Fantasia", "Editora Exemplo B", 2025, 336]
    ];
    const exemplosAnteriores = registrosAnteriores.map((r, i) => ({
        id: `demo-${i + 1}`,
        titulo: r[0], autor: r[1], categoria: r[2], editora: r[3],
        ano: r[4], paginas: r[5], isbn: "", capa: "", tema: TEMAS[i % TEMAS.length],
        resumo: i === 0
            ? "Um jovem viaja para a cidade de Candeia para cumprir um pedido de sua mãe: encontrar o pai desconhecido."
            : "Registro demonstrativo para explorar as funções do acervo. Os dados desta edição são exemplos e podem ser alterados em Editar material."
    }));
    const exemplosNumerados = exemplosAnteriores.map((livro, i) => ({
        ...livro,
        titulo: `Exemplo ${i + 1}`,
        autor: "Autor de exemplo",
        resumo: `Este é o resumo do Exemplo ${i + 1}, usado para demonstrar o funcionamento do acervo.`
    }));
    const exemplos = exemplosNumerados.map((livro, i) => {
        const titulo = i === 4 ? "exwmplo 5" : `exemplo ${i + 1}`;
        return {
            ...livro,
            titulo,
            resumo: `Este é o resumo do ${titulo}, usado para demonstrar o funcionamento do acervo.`
        };
    });

    let armazenamento = "local";
    let livros = carregar();
    let pagina = 1;
    let destaque = 0;
    let capaEdicao = "";
    let temaEdicao = "amarela";
    let versaoImagem = 0;
    let lendoImagem = false;
    let avisoTimer;
    const normalizar = texto => String(texto).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const autorVisivel = livro => normalizar(livro.autor) === "autor de exemplo" ? "" : livro.autor;
    const texto = (id, valor) => { $(id).textContent = valor; };
    const criar = (tag, classe, conteudo) => {
        const elemento = document.createElement(tag);
        if (classe) elemento.className = classe;
        if (conteudo !== undefined) elemento.textContent = conteudo;
        return elemento;
    };

    function capaValida(capa) {
        return typeof capa === "string" && (capa === "" ||
            (capa.length <= 700000 && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(capa)));
    }
    function livroValido(livro) {
        return livro && ["id", "titulo", "autor", "categoria", "editora", "resumo"].every(chave =>
            typeof livro[chave] === "string" && livro[chave].trim().length > 0 && livro[chave].length <= 2000
        ) && typeof livro.isbn === "string" && TEMAS.includes(livro.tema) && capaValida(livro.capa) &&
            Number.isInteger(livro.paginas) && livro.paginas > 0 && livro.paginas <= 50000 &&
            Number.isInteger(livro.ano) && livro.ano > 0 && livro.ano <= 2100;
    }
    function atualizarExemplosAntigos(lista) {
        return lista.map(livro => {
            const indice = exemplosAnteriores.findIndex(exemplo => exemplo.id === livro.id);
            if (indice < 0) return livro;
            const anterior = exemplosAnteriores[indice];
            const numerado = exemplosNumerados[indice];
            const novo = exemplos[indice];
            const atualizado = { ...livro };
            ["titulo", "autor", "resumo"].forEach(campo => {
                if (livro[campo] === anterior[campo] || livro[campo] === numerado[campo]) {
                    atualizado[campo] = novo[campo];
                }
            });
            return atualizado;
        });
    }
    function carregar() {
        try {
            const salvo = localStorage.getItem(CHAVE);
            if (salvo === null) return exemplos.map(livro => ({ ...livro }));
            const dados = JSON.parse(salvo);
            if (dados.versao !== 1 || !Array.isArray(dados.livros) || !dados.livros.every(livroValido) ||
                new Set(dados.livros.map(livro => livro.id)).size !== dados.livros.length) {
                throw new Error("Dados locais inválidos");
            }
            return dados.versaoExemplos === 2 ? dados.livros : atualizarExemplosAntigos(dados.livros);
        } catch {
            armazenamento = "temporario";
            return exemplos.map(livro => ({ ...livro }));
        }
    }
    function gravar(proximos) {
        if (armazenamento === "local") {
            try {
                localStorage.setItem(CHAVE, JSON.stringify({ versao: 1, exemplosNumerados: true, versaoExemplos: 2, livros: proximos }));
            } catch {
                throw new Error("Não foi possível salvar neste navegador. Tente usar uma imagem de capa menor.");
            }
        }
        livros = proximos;
    }
    function notificar(acao) {
        texto("notificacao", `${acao} ${armazenamento === "local" ? "Alteração salva neste navegador." : "Alteração mantida somente até fechar esta página."}`);
        $("notificacao").hidden = false;
        clearTimeout(avisoTimer);
        avisoTimer = setTimeout(() => { $("notificacao").hidden = true; }, 5500);
    }
    function erro(id, mensagem = "") {
        texto(id, mensagem);
        $(id).hidden = !mensagem;
    }

    function criarCapa(livro) {
        const capa = criar("div", `capa capa-${livro.tema}`);
        capa.setAttribute("aria-hidden", "true");
        capa.style.justifyContent = "center";
        capa.append(criar("span", "capa-titulo", livro.titulo));
        if (livro.capa) {
            const imagem = criar("img");
            imagem.src = livro.capa;
            imagem.alt = "";
            imagem.addEventListener("error", () => imagem.remove(), { once: true });
            capa.append(imagem);
        }
        return capa;
    }
    function filtrados() {
        const termo = normalizar($("busca").value);
        return livros.filter(livro =>
            !termo || normalizar(`${livro.titulo} ${livro.autor}`).includes(termo)
        );
    }
    function renderizarCatalogo() {
        const lista = filtrados();
        const total = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
        pagina = Math.min(Math.max(1, pagina), total);
        const inicio = (pagina - 1) * POR_PAGINA;
        $("grade-livros").replaceChildren(...lista.slice(inicio, inicio + POR_PAGINA).map(livro => {
            const artigo = criar("article", "livro");
            const capa = criar("div", "livro-capa");
            capa.setAttribute("role", "img");
            capa.setAttribute("aria-label", `Capa de ${livro.titulo}`);
            capa.append(criarCapa(livro));
            artigo.append(capa);
            return artigo;
        }));
        texto("resultados", lista.length ? `Exibindo ${inicio + 1}–${Math.min(inicio + POR_PAGINA, lista.length)} de ${lista.length} ${lista.length === 1 ? "livro" : "livros"}` : "Nenhum livro encontrado");
        $("vazio").hidden = lista.length > 0;
        $("grade-livros").hidden = lista.length === 0;
        $("adicionar").classList.toggle("sem-resultados", lista.length === 0);
        $("limpar-busca").hidden = !$("busca").value;
        const nav = $("paginacao");
        nav.replaceChildren();
        nav.hidden = lista.length === 0;
        const adicionarPagina = (numero, rotulo, classe, desativado = false) => {
            const botao = criar("button", classe, rotulo);
            botao.type = "button";
            botao.disabled = desativado;
            botao.setAttribute("aria-label", classe === "pagina" ? `Página ${numero}` : rotulo === "←" ? "Página anterior" : "Próxima página");
            if (classe === "pagina" && numero === pagina) botao.setAttribute("aria-current", "page");
            botao.addEventListener("click", () => {
                pagina = numero;
                renderizarCatalogo();
                $("catalogo").scrollIntoView({ block: "start" });
                nav.querySelector('[aria-current="page"]')?.focus({ preventScroll: true });
            });
            nav.append(botao);
        };
        adicionarPagina(pagina - 1, "←", "seta", pagina === 1);
        const inicioPaginas = Math.max(1, Math.min(pagina - 1, total - 2));
        for (let numero = inicioPaginas; numero <= Math.min(total, inicioPaginas + 2); numero++) {
            adicionarPagina(numero, String(numero), "pagina");
        }
        adicionarPagina(pagina + 1, "→", "seta", pagina === total);
    }
    function selecionarDestaque(indice) {
        const lista = livros.slice(0, 5);
        destaque = indice;
        const livro = lista[indice];
        texto("destaque-titulo", livro?.titulo || "Seu acervo começa aqui");
        texto("destaque-autor", livro ? [autorVisivel(livro), livro.ano].filter(Boolean).join(" - ") : "Adicione um material ao catálogo.");
        $("destaque-livros").querySelectorAll("button").forEach((botao, i) => {
            botao.classList.toggle("ativo", i === indice);
            if (i === indice) botao.setAttribute("aria-current", "true");
            else botao.removeAttribute("aria-current");
        });
    }
    function renderizarDestaques() {
        const lista = livros.slice(0, 5);
        destaque = Math.min(destaque, Math.max(0, lista.length - 1));
        $("destaque-livros").replaceChildren(...lista.map((livro, i) => {
            const botao = criar("button", "destaque-livro");
            botao.type = "button";
            botao.setAttribute("aria-label", `Destacar ${livro.titulo}`);
            botao.append(criarCapa(livro));
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            const uso = document.createElementNS("http://www.w3.org/2000/svg", "use");
            svg.classList.add("icone", "destaque-abrir");
            svg.setAttribute("aria-hidden", "true");
            uso.setAttribute("href", "#icone-seta");
            svg.append(uso);
            botao.append(svg);
            botao.addEventListener("click", () => selecionarDestaque(i));
            botao.addEventListener("pointerenter", () => selecionarDestaque(i));
            botao.addEventListener("focus", () => selecionarDestaque(i));
            return botao;
        }));
        selecionarDestaque(destaque);
    }
    function atualizar() { renderizarCatalogo(); renderizarDestaques(); }
    function filtrar() { pagina = 1; renderizarCatalogo(); }
    function limparBusca() {
        $("form-busca").reset();
        filtrar();
        $("busca").focus({ preventScroll: true });
    }
    function abrirModal(modal) {
        document.querySelectorAll("dialog[open]").forEach(aberto => aberto.close());
        modal.showModal();
    }
    function fecharModal(modal) {
        modal.close();
        if (document.activeElement === document.body) $("adicionar").focus({ preventScroll: true });
    }
    function atualizarPrevia() {
        $("capa-previa").replaceChildren(criarCapa({ titulo: $("livro-titulo").value.trim() || "Seu novo livro", autor: $("livro-autor").value.trim() || "Nome do autor", tema: temaEdicao, capa: capaEdicao }));
        $("remover-capa").hidden = !capaEdicao;
    }
    function abrirEditor() {
        versaoImagem++;
        lendoImagem = false;
        $("salvar-livro").disabled = false;
        $("form-livro").reset();
        $("form-livro").querySelectorAll("input,textarea").forEach(campo => campo.setCustomValidity(""));
        capaEdicao = "";
        temaEdicao = TEMAS[livros.length % TEMAS.length];
        erro("erro-formulario");
        atualizarPrevia();
        abrirModal($("modal-editor"));
        $("livro-titulo").focus();
    }
    function cancelarEditor() {
        versaoImagem++;
        lendoImagem = false;
        fecharModal($("modal-editor"));
    }
    function fechar(modal) {
        if (modal.id === "modal-editor") cancelarEditor();
        else fecharModal(modal);
    }

    $("form-livro").addEventListener("submit", evento => {
        evento.preventDefault();
        if (lendoImagem) return;
        const form = evento.currentTarget;
        ["titulo", "autor", "editora", "categoria", "resumo"].forEach(chave => {
            const campo = $(`livro-${chave}`);
            campo.value = campo.value.trim();
            campo.setCustomValidity(campo.value ? "" : "Preencha este campo.");
        });
        const isbn = $("livro-isbn").value.replace(/[\s-]/g, "").toUpperCase();
        $("livro-isbn").setCustomValidity(!isbn || /^(\d{9}[\dX]|\d{13})$/.test(isbn) ? "" : "Informe um ISBN com 10 ou 13 caracteres, ou deixe o campo vazio.");
        if (!form.reportValidity()) return;
        const livro = {
            id: `livro-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            titulo: $("livro-titulo").value, autor: $("livro-autor").value,
            categoria: $("livro-categoria").value, editora: $("livro-editora").value,
            resumo: $("livro-resumo").value, ano: Number($("livro-ano").value),
            paginas: Number($("livro-paginas").value), isbn, capa: capaEdicao, tema: temaEdicao
        };
        try {
            if (!livroValido(livro)) throw new Error("Confira os dados do material antes de salvar.");
            gravar([livro, ...livros]);
            $("form-busca").reset();
            pagina = 1;
            destaque = 0;
            fecharModal($("modal-editor"));
            atualizar();
            notificar("Material adicionado.");
        } catch (falha) { erro("erro-formulario", falha.message); }
    });
    $("form-livro").addEventListener("input", evento => {
        evento.target.setCustomValidity?.("");
        erro("erro-formulario");
        if (["livro-titulo", "livro-autor"].includes(evento.target.id)) atualizarPrevia();
    });
    $("arquivo-capa").addEventListener("change", async evento => {
        const arquivo = evento.target.files[0];
        if (!arquivo) return;
        const versao = ++versaoImagem;
        lendoImagem = false;
        $("salvar-livro").disabled = false;
        erro("erro-formulario");
        if (!["image/png", "image/jpeg", "image/webp"].includes(arquivo.type) || arquivo.size > 500 * 1024) {
            erro("erro-formulario", "Escolha uma imagem PNG, JPG ou WebP de até 500 KB.");
            evento.target.value = "";
            return;
        }
        lendoImagem = true;
        $("salvar-livro").disabled = true;
        try {
            const data = await new Promise((resolve, reject) => {
                const leitor = new FileReader();
                leitor.onload = () => resolve(leitor.result);
                leitor.onerror = () => reject(new Error("Não foi possível ler a imagem."));
                leitor.readAsDataURL(arquivo);
            });
            const imagem = new Image();
            imagem.src = data;
            await imagem.decode();
            if (versao !== versaoImagem || !$("modal-editor").open) return;
            if (!capaValida(data)) throw new Error("Imagem inválida.");
            capaEdicao = data;
            atualizarPrevia();
        } catch {
            if (versao === versaoImagem) erro("erro-formulario", "Não foi possível abrir essa imagem. Escolha outro arquivo.");
        } finally {
            if (versao === versaoImagem) { lendoImagem = false; $("salvar-livro").disabled = false; }
        }
    });
    $("remover-capa").addEventListener("click", () => {
        versaoImagem++;
        lendoImagem = false;
        $("salvar-livro").disabled = false;
        capaEdicao = "";
        $("arquivo-capa").value = "";
        atualizarPrevia();
    });
    $("form-busca").addEventListener("submit", evento => { evento.preventDefault(); filtrar(); });
    $("busca").addEventListener("input", filtrar);
    ["limpar-busca", "recomecar-busca"].forEach(id => $(id).addEventListener("click", limparBusca));
    $("adicionar").addEventListener("click", () => abrirEditor());
    $("cancelar-editor").addEventListener("click", cancelarEditor);
    document.querySelectorAll("dialog").forEach(modal => {
        modal.querySelectorAll("[data-fechar]").forEach(botao => botao.addEventListener("click", () => fechar(modal)));
        modal.addEventListener("cancel", evento => { evento.preventDefault(); fechar(modal); });
        modal.addEventListener("click", evento => {
            const area = modal.getBoundingClientRect();
            if (evento.target === modal && (evento.clientX < area.left || evento.clientX > area.right || evento.clientY < area.top || evento.clientY > area.bottom)) fechar(modal);
        });
    });
    if (armazenamento === "temporario") {
        $("aviso-local").classList.remove("sr-only");
        texto("aviso-local", "O armazenamento local não pôde ser carregado. Nesta sessão, as alterações serão mantidas somente até fechar ou atualizar esta página.");
    }
    atualizar();
})();