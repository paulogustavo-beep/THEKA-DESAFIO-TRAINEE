
/*
  Login Theka — primeira etapa.

  O formulário captura os dados,
  mas ainda não faz autenticação na API.
*/

// Localizar os elementos do HTML
const formulario = document.querySelector('#login-form');
const campoEmail = document.querySelector('#email');
const campoSenha = document.querySelector('#senha');

console.log('JavaScript do login carregado.');

// Detectar o envio do formulário
formulario.addEventListener('submit', function(evento) {

    // Impedir que a página recarregue
    evento.preventDefault();

    // Capturar os dados digitados
    const email = campoEmail.value.trim();
    const senha = campoSenha.value;

    // Verificação básica
    if (email === '' || senha === '') {
        alert('Preencha o e-mail e a senha.');
        return;
    }

    console.log('Formulário recebido!');
    console.log('E-mail digitado:', email);

    // Não exibir a senha no console.

    // PENDENTE:
    // Fazer requisição usando fetch()
    // Endpoint: POST /auth/token/
    // Receber e tratar a resposta da API.

    alert('Dados recebidos! Autenticação ainda não implementada.');
});
