const API_URL = 'https://thekapitrainee.pythonanywhere.com';
const TEMPO_LIMITE = 15000;

// Primeira etapa: somente o login está conectado à API.
export async function entrarNaApi(email, senha) {
    const controle = new AbortController();
    const temporizador = setTimeout(
        () => controle.abort(),
        TEMPO_LIMITE
    );

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
            throw new Error(
                'E-mail ou senha incorretos. Confira e tente novamente.'
            );
        }

        if (resposta.status === 400) {
            throw new Error(
                'Confira o e-mail e a senha informados.'
            );
        }

        if (resposta.status === 429) {
            throw new Error(
                'Muitas tentativas de acesso. Aguarde um pouco e tente novamente.'
            );
        }

        if (!resposta.ok) {
            throw new Error(
                'O serviço de login está indisponível. Tente novamente mais tarde.'
            );
        }

        let dados;

        try {
            dados = await resposta.json();
        } catch (falha) {
            if (controle.signal.aborted) {
                throw falha;
            }

            throw new Error(
                'A API retornou uma resposta inválida. Tente novamente.'
            );
        }

        if (
            !dados ||
            typeof dados.access !== 'string' ||
            !dados.access.trim()
        ) {
            throw new Error(
                'A API não retornou o token de acesso. Tente novamente.'
            );
        }

        // A renovação do token será integrada em outra etapa.
        return dados.access;
    } catch (falha) {
        if (controle.signal.aborted) {
            throw new Error(
                'A API demorou para responder. Tente novamente.'
            );
        }

        if (falha instanceof TypeError) {
            throw new Error(
                'Não foi possível conectar à API. Confira sua conexão e tente novamente.'
            );
        }

        throw falha;
    } finally {
        clearTimeout(temporizador);
    }
}