const API_URL = 'https://thekapitrainee.pythonanywhere.com';
const TEMPO_LIMITE = 15000;

// Integração das telas de autenticação.
export async function entrarNaApi(email, senha) {
    const controle = new AbortController();
    const temporizador = setTimeout(() => controle.abort(), TEMPO_LIMITE);

    try {
        const resposta = await fetch(`${API_URL}/auth/token/`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            credentials: 'omit',
            cache: 'no-store',
            signal: controle.signal,
            body: JSON.stringify({
                email: email.trim(),
                password: senha
            })
        });

        if (resposta.status === 401) {
            throw new Error('E-mail ou senha incorretos. Confira e tente novamente.');
        }

        if (resposta.status === 400) {
            throw new Error('Confira o e-mail e a senha informados.');
        }

        if (resposta.status === 429) {
            throw new Error('Muitas tentativas de acesso. Aguarde um pouco e tente novamente.');
        }

        if (!resposta.ok) {
            throw new Error('O serviço de login está indisponível. Tente novamente mais tarde.');
        }

        let dados;

        try {
            dados = await resposta.json();
        } catch (falha) {
            if (controle.signal.aborted) throw falha;
            throw new Error('A API retornou uma resposta inválida. Tente novamente.');
        }

        if (!dados || typeof dados.access !== 'string' || !dados.access.trim()) {
            throw new Error('A API não retornou o token de acesso. Tente novamente.');
        }

        // A renovação do token será integrada em outra etapa.
        return dados.access;
    } catch (falha) {
        if (controle.signal.aborted) {
            throw new Error('A API demorou para responder. Tente novamente.');
        }

        if (falha instanceof TypeError) {
            throw new Error('Não foi possível conectar à API. Confira sua conexão e tente novamente.');
        }

        throw falha;
    } finally {
        clearTimeout(temporizador);
    }
}

export async function cadastrarNaApi({ nome, email, senha, confirmacao }) {
    const partesNome = nome.trim().split(/\s+/);
    const emailNormalizado = email.trim().toLowerCase();

    // O mockup não pede um nome de usuário. A API usa e-mail para entrar.
    const usuario = /^[\w.@+-]{1,150}$/.test(emailNormalizado)
        ? emailNormalizado
        : `theka_${crypto.randomUUID()}`;

    const controle = new AbortController();
    const temporizador = setTimeout(() => controle.abort(), TEMPO_LIMITE);
    const semConfirmacao = 'Não foi possível confirmar o cadastro. Tente entrar com os dados informados antes de enviar novamente.';

    try {
        const resposta = await fetch(`${API_URL}/users/`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            credentials: 'omit',
            cache: 'no-store',
            signal: controle.signal,
            body: JSON.stringify({
                username: usuario,
                email: emailNormalizado,
                first_name: partesNome[0],
                last_name: partesNome.slice(1).join(' '),
                password: senha,
                password_confirm: confirmacao
            })
        });

        if (resposta.status === 429) {
            throw new Error('Muitas tentativas de cadastro. Aguarde um pouco e tente novamente.');
        }

        if (resposta.status >= 500) {
            throw new Error(semConfirmacao);
        }

        let dados;

        try {
            dados = await resposta.json();
        } catch (falha) {
            if (controle.signal.aborted) throw falha;
            throw new Error(
                resposta.ok
                    ? semConfirmacao
                    : 'O serviço de cadastro está indisponível. Tente novamente mais tarde.'
            );
        }

        if (!resposta.ok) {
            const rotulos = {
                email: 'E-mail',
                username: 'Conta',
                password: 'Senha',
                password_confirm: 'Confirmar senha',
                first_name: 'Nome',
                last_name: 'Sobrenome',
                non_field_errors: '',
                detail: ''
            };

            const mensagens = dados && typeof dados === 'object' && !Array.isArray(dados)
                ? Object.entries(dados).flatMap(([campo, valor]) => {
                    const textos = (Array.isArray(valor) ? valor : [valor])
                        .filter(item => typeof item === 'string');

                    return textos.map(texto =>
                        rotulos[campo] ? `${rotulos[campo]}: ${texto}` : texto
                    );
                })
                : [];

            throw new Error(
                mensagens.join(' ') ||
                'Não foi possível cadastrar. Confira os dados e tente novamente.'
            );
        }

        if (
            resposta.status !== 201 ||
            !Number.isInteger(dados?.id) ||
            dados.id <= 0 ||
            typeof dados.email !== 'string' ||
            dados.email.toLowerCase() !== emailNormalizado
        ) {
            throw new Error(semConfirmacao);
        }

        return dados;
    } catch (falha) {
        if (controle.signal.aborted || falha instanceof TypeError) {
            throw new Error(semConfirmacao);
        }

        throw falha;
    } finally {
        clearTimeout(temporizador);
    }
}

function erroDeLink() {
    const erro = new Error(
        'Link inválido ou expirado. Volte para recuperar senha e solicite um novo e-mail.'
    );

    erro.codigo = 'link_invalido';
    return erro;
}

async function enviarPedidoDeSenha(caminho, campos, redefinicao = false) {
    const controle = new AbortController();
    const temporizador = setTimeout(() => controle.abort(), TEMPO_LIMITE);

    const semConfirmacao = redefinicao
        ? 'Não foi possível confirmar a alteração. Tente entrar com a nova senha antes de solicitar outro link.'
        : 'Não foi possível confirmar o envio. Confira sua caixa de entrada e o spam antes de tentar novamente.';

    try {
        const resposta = await fetch(`${API_URL}${caminho}`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            credentials: 'omit',
            cache: 'no-store',
            referrerPolicy: 'no-referrer',
            signal: controle.signal,
            body: JSON.stringify(campos)
        });

        if (resposta.status === 429) {
            throw new Error('Muitas tentativas. Aguarde um pouco e tente novamente.');
        }

        if (resposta.status >= 500) {
            throw new Error(semConfirmacao);
        }

        let dados;

        try {
            dados = await resposta.json();
        } catch (falha) {
            if (controle.signal.aborted) throw falha;
            throw new Error(semConfirmacao);
        }

        if (!resposta.ok) {
            if (redefinicao && (dados?.uid || dados?.token)) {
                throw erroDeLink();
            }

            const rotulos = {
                email: 'E-mail',
                new_password: 'Nova senha',
                new_password_confirm: 'Confirmar nova senha',
                non_field_errors: '',
                detail: ''
            };

            const mensagens = dados && typeof dados === 'object' && !Array.isArray(dados)
                ? Object.entries(dados).flatMap(([campo, valor]) => {
                    if (!Object.hasOwn(rotulos, campo)) return [];

                    return (Array.isArray(valor) ? valor : [valor])
                        .filter(texto => typeof texto === 'string')
                        .map(texto =>
                            rotulos[campo] ? `${rotulos[campo]}: ${texto}` : texto
                        );
                })
                : [];

            throw new Error(
                mensagens.join(' ') ||
                'Não foi possível concluir. Confira os dados e tente novamente.'
            );
        }

        if (
            resposta.status !== 200 ||
            typeof dados?.message !== 'string' ||
            !dados.message.trim()
        ) {
            throw new Error(semConfirmacao);
        }
    } catch (falha) {
        if (controle.signal.aborted || falha instanceof TypeError) {
            throw new Error(semConfirmacao);
        }

        throw falha;
    } finally {
        clearTimeout(temporizador);
    }
}

export async function recuperarSenhaNaApi(email) {
    await enviarPedidoDeSenha('/auth/password/reset/', {
        email: email.trim().toLowerCase()
    });
}

export async function redefinirSenhaNaApi({ uid, token, senha, confirmacao }) {
    if (
        typeof uid !== 'string' ||
        !uid.trim() ||
        typeof token !== 'string' ||
        !token.trim()
    ) {
        throw erroDeLink();
    }

    await enviarPedidoDeSenha('/auth/password/reset/confirm/', {
        uid,
        token,
        new_password: senha,
        new_password_confirm: confirmacao
    }, true);
}

// Acervo: as alterações só são confirmadas depois da resposta do servidor.
function erroAcervo(mensagem, codigo = '') {
    const falha = new Error(mensagem);
    falha.codigo = codigo;
    return falha;
}

async function pedidoAcervo(
    caminho,
    { metodo = 'GET', corpo, signal, status = 200 } = {}
) {
    const controle = new AbortController();
    const cancelar = () => controle.abort();

    if (signal?.aborted) cancelar();
    signal?.addEventListener('abort', cancelar, { once: true });

    const temporizador = setTimeout(cancelar, TEMPO_LIMITE);
    const alteracao = metodo !== 'GET';
    const incerto = 'Não foi possível confirmar a alteração. Confira o acervo antes de tentar novamente.';
    const headers = { Accept: 'application/json' };
    let acesso = '';

    // A consulta é pública. Nas alterações, usamos a sessão quando disponível.
    if (alteracao) {
        try {
            acesso = sessionStorage.getItem('theka:auth:access') || '';
        } catch {
            // Sem sessão.
        }

        if (acesso) headers.Authorization = `Bearer ${acesso}`;
    }

    try {
        const resposta = await fetch(`${API_URL}${caminho}`, {
            method: metodo,
            headers,
            body: corpo,
            signal: controle.signal,
            credentials: 'omit',
            cache: 'no-store',
            referrerPolicy: 'no-referrer'
        });

        if (resposta.status === 401) {
            try {
                if (sessionStorage.getItem('theka:auth:access') === acesso) {
                    sessionStorage.removeItem('theka:auth:access');
                }
            } catch {
                // Sem sessão local disponível.
            }

            throw erroAcervo(
                'Entre na sua conta novamente para alterar o acervo.',
                'sessao_expirada'
            );
        }

        if (resposta.status === 403) {
            throw erroAcervo(
                'Sua conta não tem permissão para fazer essa alteração.',
                'sem_permissao'
            );
        }

        if (resposta.status === 404) {
            throw erroAcervo(
                'Este material não está mais disponível. Atualize o acervo.',
                'nao_encontrado'
            );
        }

        if (resposta.status === 429) {
            throw erroAcervo(
                'Muitas solicitações. Aguarde um pouco e tente novamente.'
            );
        }

        if (resposta.status >= 500) {
            throw erroAcervo(
                alteracao
                    ? incerto
                    : 'O acervo está indisponível. Tente novamente em instantes.',
                alteracao ? 'resultado_incerto' : ''
            );
        }

        if (metodo === 'DELETE' && resposta.status === 204) return;

        let dados;

        try {
            dados = await resposta.json();
        } catch (falha) {
            if (controle.signal.aborted) throw falha;

            throw erroAcervo(
                alteracao ? incerto : 'Não foi possível ler os dados do acervo.',
                alteracao ? 'resultado_incerto' : ''
            );
        }

        if (!resposta.ok) {
            const rotulos = {
                titulo: 'Título',
                autor: 'Autor',
                isbn: 'ISBN',
                numero_paginas: 'Páginas',
                ano_publicacao: 'Ano',
                editora: 'Editora',
                genero: 'Gênero',
                capa: 'Capa',
                resumo: 'Resumo',
                detail: '',
                non_field_errors: ''
            };

            const mensagens = dados && typeof dados === 'object' && !Array.isArray(dados)
                ? Object.entries(dados).flatMap(([campo, valor]) =>
                    Object.hasOwn(rotulos, campo)
                        ? (Array.isArray(valor) ? valor : [valor])
                            .filter(texto => typeof texto === 'string')
                            .map(texto =>
                                rotulos[campo] ? `${rotulos[campo]}: ${texto}` : texto
                            )
                        : []
                )
                : [];

            throw erroAcervo(
                mensagens.join(' ') ||
                'Não foi possível concluir. Confira os dados e tente novamente.'
            );
        }

        if (resposta.status !== status) {
            throw erroAcervo(
                alteracao ? incerto : 'A resposta do acervo não foi reconhecida.',
                alteracao ? 'resultado_incerto' : ''
            );
        }

        return dados;
    } catch (falha) {
        if (signal?.aborted) {
            throw new DOMException('Consulta cancelada.', 'AbortError');
        }

        if (controle.signal.aborted || falha instanceof TypeError) {
            throw erroAcervo(
                alteracao
                    ? incerto
                    : 'Não foi possível carregar o acervo. Confira sua conexão e tente novamente.',
                alteracao ? 'resultado_incerto' : ''
            );
        }

        throw falha;
    } finally {
        clearTimeout(temporizador);
        signal?.removeEventListener('abort', cancelar);
    }
}

function livroRecebidoValido(livro) {
    return livro &&
        Number.isSafeInteger(livro.id) &&
        livro.id > 0 &&
        typeof livro.titulo === 'string' &&
        Boolean(livro.titulo.trim());
}

function conferirLista(dados, validar = livroRecebidoValido) {
    const lista = Array.isArray(dados) ? dados : dados?.results;

    if (!Array.isArray(lista) || !lista.every(validar)) {
        throw erroAcervo(
            'A resposta do acervo está incompleta. Tente carregar novamente.'
        );
    }

    return lista;
}

export async function listarLivrosNaApi(
    { busca = '', genero = '', editora = '', pagina = 1, porPagina = 15 } = {},
    signal
) {
    const parametros = new URLSearchParams({
        page: String(pagina),
        page_size: String(porPagina)
    });

    if (busca.trim()) parametros.set('search', busca.trim());
    if (genero) parametros.set('genero', String(genero));
    if (editora) parametros.set('editora', String(editora));

    const dados = await pedidoAcervo(`/livros/?${parametros}`, { signal });
    const livros = conferirLista(dados);

    if (!Number.isSafeInteger(dados.count) || dados.count < livros.length) {
        throw erroAcervo('Não foi possível conferir a quantidade de livros.');
    }

    return { livros, total: dados.count };
}

export async function listarNovidadesNaApi(signal) {
    return conferirLista(
        await pedidoAcervo('/livros/novidades/', { signal })
    );
}

export async function listarOpcoesDoAcervoNaApi() {
    const validar = item =>
        item &&
        Number.isSafeInteger(item.id) &&
        item.id > 0 &&
        typeof item.nome === 'string';

    const [generos, editoras] = await Promise.all([
        pedidoAcervo('/generos/'),
        pedidoAcervo('/editoras/')
    ]);

    return {
        generos: conferirLista(generos, validar),
        editoras: conferirLista(editoras, validar)
    };
}

function conferirId(id) {
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw erroAcervo('Material inválido. Atualize o acervo.');
    }
}

export async function buscarLivroNaApi(id, signal) {
    conferirId(id);

    const livro = await pedidoAcervo(`/livros/${id}/`, { signal });

    if (!livroRecebidoValido(livro) || livro.id !== id) {
        throw erroAcervo('Não foi possível conferir os dados deste material.');
    }

    return livro;
}

export async function salvarLivroNaApi(campos, arquivoCapa = null, id = null) {
    if (id !== null) conferirId(id);

    const corpo = new FormData();

    for (const campo of [
        'titulo',
        'autor',
        'isbn',
        'resumo',
        'editora',
        'genero',
        'numero_paginas',
        'ano_publicacao'
    ]) {
        if (campos[campo] !== undefined) {
            corpo.append(campo, String(campos[campo] ?? ''));
        }
    }

    // Sem uma nova imagem, o PATCH conserva a capa que já está no servidor.
    if (arquivoCapa) {
        corpo.append('capa', arquivoCapa, arquivoCapa.name);
    }

    const livro = await pedidoAcervo(
        id === null ? '/livros/' : `/livros/${id}/`,
        {
            metodo: id === null ? 'POST' : 'PATCH',
            corpo,
            status: id === null ? 201 : 200
        }
    );

    if (
        !livroRecebidoValido(livro) ||
        (id !== null && livro.id !== id)
    ) {
        throw erroAcervo(
            'Não foi possível confirmar a alteração. Confira o acervo antes de tentar novamente.',
            'resultado_incerto'
        );
    }

    return livro;
}

export async function excluirLivroNaApi(id) {
    conferirId(id);

    await pedidoAcervo(`/livros/${id}/`, {
        metodo: 'DELETE',
        status: 204
    });
}