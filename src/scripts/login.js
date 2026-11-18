const botoesOlho = document.querySelectorAll('[data-mostrar-senha]');

botoesOlho.forEach(function (botao) {
    botao.addEventListener('click', function () {
        const campo = document.getElementById(botao.dataset.mostrarSenha);
        const visivel = campo.type === 'text';

        campo.type = visivel ? 'password' : 'text';

        const descricao = botao.getAttribute('aria-label')
            .replace(/^(Mostrar|Ocultar) /, '');

        botao.setAttribute(
            'aria-label',
            (visivel ? 'Mostrar ' : 'Ocultar ') + descricao
        );

        botao.setAttribute(
            'aria-pressed',
            String(!visivel)
        );
    });
});

const formulario = document.querySelector('[data-formulario]');
let enviando = false;
const CHAVE_ACESSO = 'theka:auth:access';

function mostrarMensagem(texto, erro = false) {
    const aviso = document.querySelector('#mensagem-formulario');

    aviso.textContent = texto;
    aviso.classList.toggle('auth-status--error', erro);
    aviso.hidden = false;
}

if (formulario) {
    const pagina = formulario.dataset.formulario;
    const parametros = new URLSearchParams(window.location.search);
    const uid = parametros.get('uid');
    const token = parametros.get('token');
    let linkInvalido = false;

    function bloquearRedefinicao() {
        linkInvalido = true;
        formulario.querySelector('[type="submit"]').disabled = true;

        formulario.querySelectorAll('input').forEach(campo => {
            campo.disabled = true;
        });

        mostrarMensagem(
            'Link inválido ou expirado. Volte para recuperar senha e solicite um novo e-mail.',
            true
        );
    }

    if (
        pagina === 'redefinicao' &&
        (
            !uid?.trim() ||
            !token?.trim() ||
            parametros.getAll('uid').length !== 1 ||
            parametros.getAll('token').length !== 1
        )
    ) {
        bloquearRedefinicao();
    }

    if (pagina === 'login') {
        if (parametros.get('senha') === 'redefinida') {
            mostrarMensagem('Senha redefinida com sucesso. Entre com sua nova senha.');
        } else if (parametros.get('cadastro') === 'sucesso') {
            mostrarMensagem('Conta criada com sucesso. Entre com seu e-mail e senha.');
        }
    }

    formulario.addEventListener('input', function () {
        const aviso = document.querySelector('#mensagem-formulario');

        if (!enviando && !linkInvalido) {
            aviso.hidden = true;
            aviso.textContent = '';
        }
    });

    formulario.addEventListener('submit', async function (evento) {
        evento.preventDefault();

        if (enviando || linkInvalido) return;

        const nome = formulario.querySelector('[name="nome"]');
        const email = formulario.querySelector('input[type="email"]');

        if (nome) {
            nome.value = nome.value.trim();
        }

        if (email) {
            email.value = email.value.trim();
        }

        if (!formulario.reportValidity()) {
            return;
        }

        if (pagina === 'cadastro' || pagina === 'redefinicao') {
            const senha = formulario.querySelector('[name="senha"]');

            const confirmacao = formulario.querySelector(
                '[name="confirmar-senha"]'
            );

            if (senha.value !== confirmacao.value) {
                mostrarMensagem(
                    'As senhas não coincidem. Confira e tente novamente.',
                    true
                );

                confirmacao.focus();
                return;
            }
        }

        if (pagina === 'cadastro') {
            const senha = formulario.querySelector('[name="senha"]');

            if (
                senha.value.length < 8 ||
                senha.value.length > 128 ||
                !/[A-Z]/.test(senha.value) ||
                !/[a-z]/.test(senha.value) ||
                !/[0-9]/.test(senha.value) ||
                !/[!@#$%^&*(),.?":{}|<>]/.test(senha.value)
            ) {
                mostrarMensagem(
                    'Use uma senha de 8 a 128 caracteres, com letra maiúscula, minúscula, número e símbolo, como !, @ ou #.',
                    true
                );

                senha.focus();
                return;
            }
        }

        // O endpoint de redefinição exige apenas 8 caracteres e confirmação igual.
        if (pagina === 'redefinicao') {
            const senha = formulario.querySelector('[name="senha"]');

            if (senha.value.trim().length < 8) {
                mostrarMensagem(
                    'A nova senha deve ter pelo menos 8 caracteres.',
                    true
                );

                senha.focus();
                return;
            }
        }

        if (['login', 'cadastro', 'recuperacao', 'redefinicao'].includes(pagina)) {
            const senha = formulario.querySelector('[name="senha"]');
            const botao = formulario.querySelector('[type="submit"]');
            const textoOriginal = botao.textContent;
            const campos = [...formulario.querySelectorAll('input')];
            const estados = campos.map(campo => campo.disabled);

            enviando = true;
            botao.disabled = true;

            botao.textContent = pagina === 'login'
                ? 'Entrando...'
                : pagina === 'recuperacao'
                    ? 'Enviando...'
                    : 'Salvando...';

            formulario.setAttribute('aria-busy', 'true');
            mostrarMensagem('Conectando à API...');

            campos.forEach(campo => {
                campo.disabled = true;
            });

            try {
                const api = await import('./api.js');

                if (pagina === 'cadastro') {
                    await api.cadastrarNaApi({
                        nome: nome.value,
                        email: email.value,
                        senha: senha.value,
                        confirmacao: formulario.querySelector('[name="confirmar-senha"]').value
                    });

                    formulario.reset();
                    mostrarMensagem('Conta criada com sucesso. Abrindo o login...');
                    window.location.assign('login.html?cadastro=sucesso');
                } else if (pagina === 'recuperacao') {
                    await api.recuperarSenhaNaApi(email.value);

                    mostrarMensagem(
                        'E-mail de recuperação enviado. Confira sua caixa de entrada e a pasta de spam.'
                    );
                } else if (pagina === 'redefinicao') {
                    await api.redefinirSenhaNaApi({
                        uid,
                        token,
                        senha: senha.value,
                        confirmacao: formulario.querySelector('[name="confirmar-senha"]').value
                    });

                    formulario.reset();

                    // A senha mudou: descarte a sessão anterior deste navegador.
                    try {
                        sessionStorage.removeItem(CHAVE_ACESSO);
                    } catch {
                        // Sem sessão local disponível.
                    }

                    mostrarMensagem('Senha redefinida com sucesso. Abrindo o login...');
                    window.location.replace('login.html?senha=redefinida');
                } else {
                    const acesso = await api.entrarNaApi(email.value, senha.value);

                    try {
                        sessionStorage.setItem(CHAVE_ACESSO, acesso);
                    } catch {
                        throw new Error(
                            'O login foi confirmado, mas não foi possível guardar a sessão neste navegador.'
                        );
                    }

                    senha.value = '';
                    window.location.assign('acervo.html');
                }
            } catch (falha) {
                if (pagina === 'redefinicao' && falha.codigo === 'link_invalido') {
                    bloquearRedefinicao();
                } else {
                    const mensagem = falha instanceof TypeError
                        ? 'Não foi possível carregar a integração. Abra o projeto pelo servidor e confira o arquivo src/scripts/api.js.'
                        : falha.message || 'Não foi possível concluir a solicitação. Tente novamente.';

                    mostrarMensagem(mensagem, true);
                }
            } finally {
                enviando = false;
                botao.disabled = linkInvalido;
                botao.textContent = textoOriginal;
                formulario.removeAttribute('aria-busy');

                campos.forEach((campo, indice) => {
                    campo.disabled = linkInvalido || estados[indice];
                });
            }
        }
    });
}