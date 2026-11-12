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

        botao.setAttribute('aria-pressed', String(!visivel));
    });
});

const formulario = document.querySelector('[data-formulario]');

function mostrarMensagem(texto, erro = false) {
    const aviso = document.querySelector('#mensagem-formulario');

    aviso.textContent = texto;
    aviso.classList.toggle('auth-status--error', erro);
    aviso.hidden = false;
}

if (formulario) {
    formulario.addEventListener('input', function () {
        const aviso = document.querySelector('#mensagem-formulario');
        aviso.hidden = true;
        aviso.textContent = '';
    });

    formulario.addEventListener('submit', function (evento) {
        evento.preventDefault();

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
            mostrarMensagem(
                'Dados preenchidos corretamente. Nenhum acesso foi realizado.'
            );
        } else if (pagina === 'recuperacao') {
            window.location.href = 'redefinir-senha.html';
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