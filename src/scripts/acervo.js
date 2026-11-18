import {
    listarLivrosNaApi,
    listarNovidadesNaApi,
    listarOpcoesDoAcervoNaApi,
    buscarLivroNaApi,
    salvarLivroNaApi,
    excluirLivroNaApi
} from './api.js';

const $ = id => document.getElementById(id);
const mobile = window.matchMedia('(max-width: 767px)');

const normalizar = valor =>
    String(valor)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

const criar = (tag, classe, conteudo) => {
    const elemento = document.createElement(tag);

    if (classe) elemento.className = classe;
    if (conteudo !== undefined) elemento.textContent = conteudo;

    return elemento;
};

let livros = [];
let novidades = [];
let generos = [];
let editoras = [];
let totalLivros = 0;
let pagina = 1;
let destaque = 0;
let filtros = { busca: '', genero: '', editora: '' };
let opcoesProntas = false;
let catalogoPronto = false;
let livroAberto = null;
let livroEdicao = null;
let capaEdicao = '';
let arquivoCapa = null;
let lendoImagem = false;
let enviando = false;
let resultadoIncerto = false;
let versaoImagem = 0;
let consultaCatalogo = 0;
let controleCatalogo;
let controleDetalhe;
let controleNovidades;
let buscaTimer;
let avisoTimer;
let acionadorModal;

const porPagina = () => mobile.matches ? 8 : 15;

function relacao(valor, nome, opcoes) {
    const id = typeof valor === 'number' ? valor : valor?.id;
    const texto = nome ||
        (typeof valor === 'string' ? valor : valor?.nome) ||
        '';

    const opcao = opcoes.find(item => item.id === id) ||
        opcoes.find(item =>
            texto && normalizar(item.nome) === normalizar(texto)
        );

    return {
        id: opcao?.id ?? id ?? null,
        nome: texto || opcao?.nome || ''
    };
}

function enderecoCapa(valor) {
    if (typeof valor !== 'string' || !valor) return '';

    try {
        const url = new URL(
            valor,
            'https://thekapitrainee.pythonanywhere.com'
        );

        if (
            url.hostname === 'thekapitrainee.pythonanywhere.com' &&
            url.protocol === 'http:'
        ) {
            url.protocol = 'https:';
        }

        return url.protocol === 'https:' ? url.href : '';
    } catch {
        return '';
    }
}

function prepararLivro(dados) {
    const editora = relacao(dados.editora, dados.editora_nome, editoras);
    const genero = relacao(dados.genero, dados.genero_nome, generos);

    return {
        id: dados.id,
        titulo: dados.titulo,
        autor: dados.autor || '',
        ano: dados.ano_publicacao ?? null,
        paginas: dados.numero_paginas ?? null,
        resumo: dados.resumo || '',
        isbn: dados.isbn || '',
        capa: enderecoCapa(dados.capa),
        editora: editora.nome,
        editoraId: editora.id,
        categoria: genero.nome,
        generoId: genero.id
    };
}

function notificar(texto) {
    $('notificacao').textContent = texto;
    $('notificacao').hidden = false;

    clearTimeout(avisoTimer);

    avisoTimer = setTimeout(() => {
        $('notificacao').hidden = true;
    }, 5500);
}

function erro(mensagem = '') {
    $('erro-formulario').textContent = mensagem;
    $('erro-formulario').hidden = !mensagem;
}

function criarCapa(livro) {
    const capa = criar('div', 'capa');
    capa.setAttribute('aria-hidden', 'true');

    if (livro.capa) {
        const imagem = criar('img');

        imagem.src = livro.capa;
        imagem.alt = '';
        imagem.loading = 'lazy';
        imagem.referrerPolicy = 'no-referrer';

        imagem.addEventListener('error', () => {
            imagem.remove();
            capa.append(criar('span', 'capa-titulo', livro.titulo));
        }, { once: true });

        capa.append(imagem);
    } else {
        capa.append(criar('span', 'capa-titulo', livro.titulo));
    }

    return capa;
}

function preencherSelect(id, opcoes, titulo) {
    const seletor = $(id);
    const anterior = seletor.value;

    seletor.replaceChildren(new Option(titulo, ''));

    [...opcoes]
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        .forEach(item => {
            seletor.add(new Option(item.nome, String(item.id)));
        });

    if ([...seletor.options].some(item => item.value === anterior)) {
        seletor.value = anterior;
    }
}

async function carregarOpcoes() {
    opcoesProntas = false;
    $('adicionar').disabled = true;
    $('editar-livro').disabled = true;
    $('estado-opcoes').hidden = true;
    $('categoria').disabled = true;
    $('editora').disabled = true;
    $('recarregar-opcoes').disabled = true;

    try {
        ({ generos, editoras } = await listarOpcoesDoAcervoNaApi());

        preencherSelect('categoria', generos, 'Gênero');
        preencherSelect('editora', editoras, 'Editora');
        preencherSelect('livro-categoria', generos, 'Selecione o gênero');
        preencherSelect('livro-editora', editoras, 'Selecione a editora');

        opcoesProntas = true;
    } catch (falha) {
        $('mensagem-opcoes').textContent =
            'Não foi possível carregar os gêneros e as editoras. ' +
            falha.message;

        $('estado-opcoes').hidden = false;
    } finally {
        $('categoria').disabled = !opcoesProntas;
        $('editora').disabled = !opcoesProntas;
        $('adicionar').disabled = !opcoesProntas || !catalogoPronto;
        $('editar-livro').disabled = !opcoesProntas || !livroAberto;
        $('recarregar-opcoes').disabled = false;
    }
}

async function carregarCatalogo() {
    const consulta = ++consultaCatalogo;

    controleCatalogo?.abort();

    const controle = new AbortController();
    controleCatalogo = controle;
    catalogoPronto = false;

    $('catalogo').setAttribute('aria-busy', 'true');
    $('adicionar').disabled = true;
    $('adicionar').hidden = true;
    $('estado-acervo').hidden = false;
    $('mensagem-acervo').textContent = 'Carregando livros...';
    $('recarregar-acervo').hidden = true;
    $('grade-livros').hidden = true;
    $('paginacao').hidden = true;
    $('vazio').hidden = true;

    try {
        const dados = await listarLivrosNaApi(
            {
                ...filtros,
                pagina,
                porPagina: porPagina()
            },
            controle.signal
        );

        if (consulta !== consultaCatalogo) return false;

        totalLivros = dados.total;

        const ultima = Math.max(
            1,
            Math.ceil(totalLivros / porPagina())
        );

        if (pagina > ultima) {
            pagina = ultima;
            return carregarCatalogo();
        }

        livros = dados.livros.map(prepararLivro);
        catalogoPronto = true;
        $('estado-acervo').hidden = true;

        renderizarCatalogo();
        return true;
    } catch (falha) {
        if (
            consulta !== consultaCatalogo ||
            falha.name === 'AbortError'
        ) {
            return false;
        }

        if (falha.codigo === 'nao_encontrado' && pagina > 1) {
            pagina = 1;
            return carregarCatalogo();
        }

        $('mensagem-acervo').textContent = falha.message;
        $('recarregar-acervo').hidden = false;
        $('resultados').textContent =
            'Não foi possível carregar os livros.';

        return false;
    } finally {
        if (consulta === consultaCatalogo) {
            $('catalogo').removeAttribute('aria-busy');
            $('adicionar').disabled = !catalogoPronto || !opcoesProntas;
            $('adicionar').hidden = !catalogoPronto;
        }
    }
}

function renderizarCatalogo() {
    const inicio = (pagina - 1) * porPagina();
    const total = Math.max(1, Math.ceil(totalLivros / porPagina()));

    $('grade-livros').replaceChildren(
        ...livros.map(livro => {
            const artigo = criar('article', 'livro');
            const botao = criar('button', 'livro-capa');

            botao.type = 'button';
            botao.setAttribute(
                'aria-label',
                `Ver informações de ${livro.titulo}`
            );

            botao.append(criarCapa(livro));
            botao.addEventListener('click', () => abrirDetalhe(livro.id));
            artigo.append(botao);

            return artigo;
        })
    );

    $('resultados').textContent = totalLivros
        ? `Exibindo ${inicio + 1}–${inicio + livros.length} de ${totalLivros} ${totalLivros === 1 ? 'livro' : 'livros'}`
        : 'Nenhum livro encontrado';

    $('vazio').hidden = livros.length > 0;
    $('grade-livros').hidden = livros.length === 0;

    $('adicionar').classList.toggle(
        'sem-resultados',
        livros.length === 0
    );

    const comFiltro = Boolean(
        filtros.busca || filtros.genero || filtros.editora
    );

    $('vazio-titulo').textContent = comFiltro
        ? 'Nenhum livro encontrado'
        : 'O acervo ainda não tem livros';

    $('vazio-texto').textContent = comFiltro
        ? 'Tente outro título, autor ou filtro.'
        : 'Use o botão + para adicionar o primeiro material.';

    $('recomecar-busca').hidden = !comFiltro;
    $('limpar-busca').hidden = !comFiltro;

    const nav = $('paginacao');
    nav.replaceChildren();
    nav.hidden = totalLivros === 0;

    function adicionarPagina(numero, rotulo, classe, desativado = false) {
        const botao = criar('button', classe, rotulo);

        botao.type = 'button';
        botao.disabled = desativado;

        botao.setAttribute(
            'aria-label',
            classe === 'pagina'
                ? `Página ${numero}`
                : rotulo === '‹'
                    ? 'Página anterior'
                    : 'Próxima página'
        );

        if (classe === 'pagina' && numero === pagina) {
            botao.setAttribute('aria-current', 'page');
        }

        botao.addEventListener('click', async () => {
            pagina = numero;

            if (await carregarCatalogo()) {
                $('catalogo').scrollIntoView({ block: 'start' });

                nav.querySelector('[aria-current="page"]')
                    ?.focus({ preventScroll: true });
            }
        });

        nav.append(botao);
    }

    adicionarPagina(pagina - 1, '‹', 'seta', pagina === 1);

    const primeira = Math.max(
        1,
        Math.min(pagina - 1, total - 2)
    );

    for (
        let numero = primeira;
        numero <= Math.min(total, primeira + 2);
        numero++
    ) {
        adicionarPagina(numero, String(numero), 'pagina');
    }

    adicionarPagina(pagina + 1, '›', 'seta', pagina === total);
}

function selecionarDestaque(indice) {
    destaque = indice;

    const livro = novidades[indice];

    $('destaque-titulo').textContent =
        livro?.titulo || 'Nenhuma novidade por enquanto';

    $('destaque-autor').textContent = livro
        ? [livro.autor, livro.ano].filter(Boolean).join(' - ')
        : '';

    $('destaque-livros').querySelectorAll('button')
        .forEach((botao, i) => {
            botao.classList.toggle('ativo', i === indice);
            botao.setAttribute('aria-expanded', String(i === indice));
        });
}

async function carregarDestaques() {
    controleNovidades?.abort();

    const controle = new AbortController();
    controleNovidades = controle;

    $('recarregar-novidades').hidden = true;

    try {
        const dados = await listarNovidadesNaApi(controle.signal);

        if (controle.signal.aborted) return;

        novidades = dados.slice(0, 5).map(prepararLivro);

        destaque = Math.min(
            destaque,
            Math.max(0, novidades.length - 1)
        );

        $('destaque-livros').replaceChildren(
            ...novidades.map((livro, i) => {
                const botao = criar('button', 'destaque-livro');

                botao.type = 'button';
                botao.setAttribute(
                    'aria-label',
                    `Destacar e ver ${livro.titulo}`
                );

                botao.append(criarCapa(livro));

                const svg = document.createElementNS(
                    'http://www.w3.org/2000/svg',
                    'svg'
                );

                const uso = document.createElementNS(
                    'http://www.w3.org/2000/svg',
                    'use'
                );

                svg.classList.add('icone', 'destaque-abrir');
                svg.setAttribute('aria-hidden', 'true');
                uso.setAttribute('href', '#icone-seta');

                svg.append(uso);
                botao.append(svg);

                botao.addEventListener('click', () => {
                    if (destaque === i) {
                        abrirDetalhe(livro.id);
                    } else {
                        selecionarDestaque(i);
                    }
                });

                botao.addEventListener('pointerenter', evento => {
                    if (evento.pointerType === 'mouse') {
                        selecionarDestaque(i);
                    }
                });

                return botao;
            })
        );

        $('destaque-livros').hidden = novidades.length === 0;
        selecionarDestaque(destaque);
    } catch (falha) {
        if (falha.name === 'AbortError') return;

        $('destaque-livros').hidden = true;
        $('destaque-titulo').textContent =
            'Não foi possível carregar as novidades';

        $('destaque-autor').textContent = '';
        $('recarregar-novidades').hidden = false;
    }
}

function filtrar() {
    clearTimeout(buscaTimer);

    filtros = {
        busca: $('busca').value.trim(),
        genero: $('categoria').value,
        editora: $('editora').value
    };

    pagina = 1;
    carregarCatalogo();
}

function fecharFiltros() {
    $('filtros-opcoes').classList.remove('aberto');
    $('abrir-filtros').setAttribute('aria-expanded', 'false');
}

function limparBusca() {
    $('form-busca').reset();
    filtrar();
    $('busca').focus({ preventScroll: true });
}

function abrirModal(modal) {
    if (!document.querySelector('dialog[open]')) {
        acionadorModal = document.activeElement;
    }

    document.querySelectorAll('dialog[open]')
        .forEach(aberto => aberto.close());

    modal.showModal();
}

function fecharModal(modal) {
    if (modal.id === 'modal-editor' && enviando) return;

    if (modal.id === 'modal-detalhe') {
        controleDetalhe?.abort();
    }

    versaoImagem++;
    lendoImagem = false;

    modal.close();

    const destino = acionadorModal?.isConnected
        ? acionadorModal
        : $('adicionar');

    destino?.focus({ preventScroll: true });
}

async function abrirDetalhe(id) {
    controleDetalhe?.abort();

    const controle = new AbortController();
    controleDetalhe = controle;
    livroAberto = null;

    $('detalhe-capa').replaceChildren();
    $('detalhe-titulo').textContent = 'Carregando material...';

    for (const campo of ['autor', 'resumo', 'paginas', 'editora']) {
        $('detalhe-' + campo).textContent = '';
    }

    $('detalhe-estado').hidden = true;
    $('editar-livro').disabled = true;

    abrirModal($('modal-detalhe'));

    try {
        const dados = await buscarLivroNaApi(id, controle.signal);

        if (controle.signal.aborted) return;

        const livro = prepararLivro(dados);
        livroAberto = livro;

        $('detalhe-capa').replaceChildren(criarCapa(livro));
        $('detalhe-titulo').textContent = livro.titulo;

        $('detalhe-autor').textContent =
            [livro.autor, livro.ano].filter(Boolean).join(', ') ||
            'Autor e ano não informados';

        $('detalhe-resumo').textContent =
            livro.resumo || 'Resumo não informado.';

        $('detalhe-paginas').textContent =
            `páginas: ${livro.paginas ?? 'não informado'}`;

        $('detalhe-editora').textContent =
            livro.editora || 'Editora não informada';

        $('editar-livro').disabled = !opcoesProntas;
    } catch (falha) {
        if (falha.name === 'AbortError') return;

        $('detalhe-titulo').textContent = 'Material indisponível';
        $('detalhe-estado').textContent = falha.message;
        $('detalhe-estado').hidden = false;
    }
}

function atualizarPrevia() {
    const anterior = $('capa-previa');
    anterior.replaceChildren();

    if (capaEdicao) {
        anterior.append(
            criarCapa({
                titulo: $('livro-titulo').value,
                capa: capaEdicao
            })
        );
    } else {
        const vazio = criar('div', 'capa-vazia');

        vazio.innerHTML = '<svg class="icone" viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="12" width="48" height="40" rx="4"/><circle cx="23" cy="25" r="5"/><path d="m9 46 16-13 10 8 9-10 11 15"/></svg>';

        anterior.append(vazio);
    }

    anterior.parentElement.classList.toggle(
        'com-imagem',
        Boolean(capaEdicao)
    );

    document.querySelector('.arquivo-botao').textContent =
        capaEdicao ? 'Alterar imagem' : 'Adicionar imagem';
}

function bloquearEditor(ativo, excluindo = false) {
    enviando = ativo;

    $('modal-editor')
        .querySelectorAll('input,textarea,select,button')
        .forEach(campo => {
            campo.disabled = ativo;
        });

    $('salvar-livro').textContent =
        ativo && !excluindo ? 'Salvando...' : 'Salvar';

    $('excluir-livro').textContent =
        ativo && excluindo ? 'Excluindo...' : 'Excluir';

    $('salvar-livro').disabled =
        ativo || lendoImagem || resultadoIncerto;

    $('excluir-livro').disabled = ativo || resultadoIncerto;
    $('form-livro').setAttribute('aria-busy', String(ativo));
}

function abrirEditor(livro = null) {
    if (!opcoesProntas) {
        notificar('Carregue os gêneros e as editoras antes de editar.');
        return;
    }

    controleDetalhe?.abort();

    livroEdicao = livro;
    versaoImagem++;
    lendoImagem = false;
    resultadoIncerto = false;
    arquivoCapa = null;

    bloquearEditor(false);
    $('form-livro').reset();

    $('form-livro')
        .querySelectorAll('input,textarea,select')
        .forEach(campo => campo.setCustomValidity(''));

    for (const campo of [
        'titulo',
        'autor',
        'ano',
        'paginas',
        'isbn',
        'resumo'
    ]) {
        $('livro-' + campo).value = livro?.[campo] ?? '';
    }

    $('livro-editora').value = String(
        relacao(livro?.editoraId, livro?.editora, editoras).id ?? ''
    );

    $('livro-categoria').value = String(
        relacao(livro?.generoId, livro?.categoria, generos).id ?? ''
    );

    capaEdicao = livro?.capa || '';

    $('editor-titulo').textContent = livro
        ? 'Editar material'
        : 'Adicionar material ao catálogo';

    $('excluir-livro').hidden = !livro;
    $('entrar-editor').hidden = true;
    $('conferir-acervo').hidden = true;

    erro();
    atualizarPrevia();
    abrirModal($('modal-editor'));
}

function mostrarFalhaAlteracao(falha) {
    erro(falha.message);

    resultadoIncerto = falha.codigo === 'resultado_incerto';

    $('entrar-editor').hidden =
        falha.codigo !== 'sessao_expirada';

    $('conferir-acervo').hidden =
        !resultadoIncerto && falha.codigo !== 'nao_encontrado';
}

$('form-livro').addEventListener('submit', async evento => {
    evento.preventDefault();

    if (lendoImagem || enviando || resultadoIncerto) return;

    for (const campo of ['titulo', 'autor', 'isbn', 'resumo']) {
        const input = $('livro-' + campo);

        input.value = input.value.trim();
        input.setCustomValidity(
            input.value ? '' : 'Preencha este campo.'
        );
    }

    for (const campo of ['ano', 'paginas']) {
        const input = $('livro-' + campo);

        input.setCustomValidity(
            !input.value || Number.isSafeInteger(Number(input.value))
                ? ''
                : 'Informe um número inteiro.'
        );
    }

    if (!evento.currentTarget.reportValidity()) return;

    const id = livroEdicao?.id ?? null;

    const campos = {
        titulo: $('livro-titulo').value,
        autor: $('livro-autor').value,
        isbn: $('livro-isbn').value,
        resumo: $('livro-resumo').value,
        numero_paginas: $('livro-paginas').value || null,
        ano_publicacao: $('livro-ano').value || null,
        editora: Number($('livro-editora').value),
        genero: Number($('livro-categoria').value)
    };

    erro();
    bloquearEditor(true);

    try {
        await salvarLivroNaApi(campos, arquivoCapa, id);

        bloquearEditor(false);
        fecharModal($('modal-editor'));

        if (id === null) {
            $('form-busca').reset();
            filtros = { busca: '', genero: '', editora: '' };
            pagina = 1;
        }

        notificar(
            id === null
                ? 'Material adicionado ao acervo.'
                : 'Material atualizado no acervo.'
        );

        carregarCatalogo();
        carregarDestaques();
    } catch (falha) {
        mostrarFalhaAlteracao(falha);
    } finally {
        bloquearEditor(false);
    }
});

$('form-livro').addEventListener('input', evento => {
    evento.target.setCustomValidity?.('');

    if (!resultadoIncerto) erro();
});

$('arquivo-capa').addEventListener('change', async evento => {
    const arquivo = evento.target.files[0];

    if (!arquivo || enviando) return;

    const versao = ++versaoImagem;

    lendoImagem = false;
    $('salvar-livro').disabled = resultadoIncerto;
    erro();

    if (
        !['image/png', 'image/jpeg', 'image/webp'].includes(arquivo.type) ||
        arquivo.size > 5 * 1024 * 1024
    ) {
        erro('Escolha uma imagem PNG, JPG ou WebP de até 5 MB.');
        evento.target.value = '';
        return;
    }

    lendoImagem = true;
    $('salvar-livro').disabled = true;

    try {
        const data = await new Promise((resolve, reject) => {
            const leitor = new FileReader();

            leitor.onload = () => resolve(leitor.result);
            leitor.onerror = () =>
                reject(new Error('Falha ao ler a imagem'));

            leitor.readAsDataURL(arquivo);
        });

        const imagem = new Image();
        imagem.src = data;

        await imagem.decode();

        if (
            versao !== versaoImagem ||
            !$('modal-editor').open
        ) {
            return;
        }

        arquivoCapa = arquivo;
        capaEdicao = data;
        atualizarPrevia();
    } catch {
        if (versao === versaoImagem) {
            evento.target.value = '';

            erro(
                'Não foi possível abrir essa imagem. Escolha outro arquivo.'
            );
        }
    } finally {
        if (versao === versaoImagem) {
            lendoImagem = false;
            $('salvar-livro').disabled = enviando || resultadoIncerto;
        }
    }
});

$('excluir-livro').addEventListener('click', async () => {
    if (!livroEdicao || enviando || resultadoIncerto) return;

    if (
        !window.confirm(
            `Excluir “${livroEdicao.titulo}” do acervo? Essa ação não pode ser desfeita.`
        )
    ) {
        return;
    }

    erro();
    bloquearEditor(true, true);

    try {
        await excluirLivroNaApi(livroEdicao.id);

        bloquearEditor(false);
        fecharModal($('modal-editor'));

        if (livros.length === 1 && pagina > 1) pagina--;

        notificar('Material excluído do acervo.');

        carregarCatalogo();
        carregarDestaques();
    } catch (falha) {
        mostrarFalhaAlteracao(falha);
    } finally {
        bloquearEditor(false);
    }
});

$('conferir-acervo').addEventListener('click', () => {
    fecharModal($('modal-editor'));
    carregarCatalogo();
    carregarDestaques();
});

$('adicionar').addEventListener('click', () => abrirEditor());

$('editar-livro').addEventListener('click', () => {
    if (livroAberto) abrirEditor(livroAberto);
});

$('cancelar-editor').addEventListener('click', () => {
    fecharModal($('modal-editor'));
});

$('recarregar-acervo').addEventListener('click', carregarCatalogo);
$('recarregar-opcoes').addEventListener('click', carregarOpcoes);
$('recarregar-novidades').addEventListener('click', carregarDestaques);

$('form-busca').addEventListener('submit', evento => {
    evento.preventDefault();
    filtrar();
    fecharFiltros();
});

$('busca').addEventListener('input', () => {
    clearTimeout(buscaTimer);
    controleCatalogo?.abort();
    buscaTimer = setTimeout(filtrar, 300);
});

['categoria', 'editora'].forEach(id => {
    $(id).addEventListener('change', () => {
        if (!mobile.matches) filtrar();
    });
});

['limpar-busca', 'recomecar-busca'].forEach(id => {
    $(id).addEventListener('click', limparBusca);
});

$('abrir-filtros').addEventListener('click', () => {
    const aberto = $('filtros-opcoes')
        .classList.toggle('aberto');

    $('abrir-filtros').setAttribute(
        'aria-expanded',
        String(aberto)
    );

    if (aberto) $('categoria').focus();
});

// No celular, o formulário conserva o rodapé do mockup.
const rodapeEditor = document.querySelector('.rodape').cloneNode(true);

rodapeEditor.classList.add('editor-rodape');
rodapeEditor.removeAttribute('id');

rodapeEditor.querySelectorAll('[id]').forEach(elemento => {
    elemento.removeAttribute('id');
});

rodapeEditor.querySelectorAll('[aria-labelledby]').forEach(elemento => {
    elemento.removeAttribute('aria-labelledby');
});

$('modal-editor').append(rodapeEditor);

document.querySelectorAll('dialog').forEach(modal => {
    modal.querySelectorAll('[data-fechar]').forEach(botao => {
        botao.addEventListener('click', () => fecharModal(modal));
    });

    modal.addEventListener('cancel', evento => {
        evento.preventDefault();
        fecharModal(modal);
    });

    modal.addEventListener('click', evento => {
        const area = modal.getBoundingClientRect();

        if (
            evento.target === modal &&
            (
                evento.clientX < area.left ||
                evento.clientX > area.right ||
                evento.clientY < area.top ||
                evento.clientY > area.bottom
            )
        ) {
            fecharModal(modal);
        }
    });
});

const botaoMenu = document.querySelector('.nav-abrir');
const menu = document.querySelector('.menu');

botaoMenu.addEventListener('click', () => {
    const aberto = menu.classList.toggle('aberto');

    botaoMenu.setAttribute('aria-expanded', String(aberto));
});

document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape') {
        if ($('filtros-opcoes').classList.contains('aberto')) {
            fecharFiltros();
            $('abrir-filtros').focus();
        }

        if (menu.classList.contains('aberto')) {
            menu.classList.remove('aberto');
            botaoMenu.setAttribute('aria-expanded', 'false');
            botaoMenu.focus();
        }
    }
});

mobile.addEventListener('change', () => {
    fecharFiltros();
    filtrar();
});

carregarOpcoes();
carregarCatalogo();
carregarDestaques();