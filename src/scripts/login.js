const botoesOlho = document.querySelectorAll('[data-mostrar-senha]');

botoesOlho.forEach(function (botao) {
    botao.addEventListener('click', function () {
        const campo = document.getElementById(
            botao.dataset.mostrarSenha
        );

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
const CHAVE_ACESSO = 'theka:auth:access';

let enviando = false;

function mostrarMensagem(texto, erro = false) {
    const aviso = document.querySelector('#mensagem-formulario');

    aviso.textContent = texto;
    aviso.classList.toggle('auth-status--error', erro);
    aviso.hidden = false;
}

if (formulario) {
    formulario.addEventListener('input', function () {
        const aviso = document.querySelector('#mensagem-formulario');

        if (!enviando) {
            aviso.hidden = true;
            aviso.textContent = '';
        }
    });

    formulario.addEventListener('submit', async function (evento) {
        evento.preventDefault();

        if (enviando) {
            return;
        }

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

        const pagina = formulario.dataset.formulario;

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

        if (pagina === 'login') {
            const senha = formulario.querySelector('[name="senha"]');
            const botao = formulario.querySelector('[type="submit"]');
            const textoOriginal = botao.textContent;

            const campos = [
                ...formulario.querySelectorAll('input')
            ];

            const estados = campos.map(campo => campo.disabled);

            enviando = true;
            botao.disabled = true;
            botao.textContent = 'Entrando...';

            formulario.setAttribute('aria-busy', 'true');

            mostrarMensagem('Conectando à API...');

            campos.forEach(campo => {
                campo.disabled = true;
            });

            try {
                const { entrarNaApi } = await import('./api.js');

                const acesso = await entrarNaApi(
                    email.value,
                    senha.value
                );

                try {
                    sessionStorage.setItem(CHAVE_ACESSO, acesso);
                } catch {
                    throw new Error(
                        'O login foi confirmado, mas não foi possível guardar a sessão neste navegador.'
                    );
                }

                senha.value = '';

                window.location.assign('acervo.html');
            } catch (falha) {
                const mensagem = falha instanceof TypeError
                    ? 'Não foi possível carregar a integração. Abra o projeto pelo servidor e confira o arquivo src/scripts/api.js.'
                    : falha.message || 'Não foi possível entrar. Tente novamente.';

                mostrarMensagem(mensagem, true);
            } finally {
                enviando = false;
                botao.disabled = false;
                botao.textContent = textoOriginal;

                formulario.removeAttribute('aria-busy');

                campos.forEach((campo, indice) => {
                    campo.disabled = estados[indice];
                });
            }
        } else if (pagina === 'recuperacao') {
            mostrarMensagem(
                'E-mail conferido. Nenhuma mensagem foi enviada.'
            );
        } else if (pagina === 'redefinicao') {
            mostrarMensagem(
                'Senhas conferidas. Nenhuma senha foi alterada.'
            );
        } else if (pagina === 'cadastro') {
            mostrarMensagem(
                'Formulário conferido. Nenhum cadastro foi realizado.'
            );
        }
    });
}