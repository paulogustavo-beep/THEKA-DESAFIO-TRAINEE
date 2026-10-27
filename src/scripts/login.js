
const formulario = document.querySelector('#login-form');
const campoEmail = document.querySelector('#email');
const campoSenha = document.querySelector('#senha');

formulario.addEventListener('submit', function(evento) {

    evento.preventDefault();

    const email = campoEmail.value.trim();
    const senha = campoSenha.value;

    if (email === '' || senha === '') {
        alert('Preencha o e-mail e a senha.');
        return;
    }

    alert('Os dados foram conferidos, mas o login ainda não está disponível.');
});
