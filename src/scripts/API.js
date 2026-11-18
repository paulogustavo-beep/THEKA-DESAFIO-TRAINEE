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