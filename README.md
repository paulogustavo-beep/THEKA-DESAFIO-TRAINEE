# Theka

Esse é o meu projeto do desafio de Front-end do Trainee 2026.2 da EJECT, na trilha de JavaScript, a proposta é desenvolver o site de uma biblioteca chamada Theka, seguindo as telas no Figma

Estou aprendendo desenvolvimento web e usando esse projeto para colocar os estudos na prática, ele reúne a parte visual das páginas, as interações com JavaScript e a comunicação com a API

## O que tem no projeto

- Login e cadastro de usuário
- Páginas para recuperar e redefinir a senha
- Acervo com capas dos livros, carrossel e paginação
- Pesquisa por título ou autor
- Filtros por gênero e editora
- Janela com os detalhes de cada livro
- Opções para adicionar, editar e excluir livros
- Página Sobre Nós, com história, valores e equipe da Theka
- Ajustes no layout para diferentes tamanhos de tela


## O que usei

Usei ***HTML** para montar as páginas, **CSS** para os estilos e **JavaScript** para as funcionalidades. No CSS, usei ****Flexbox**, Grid e media queries para organizar os elementos e adaptar as telas

As requisições à API são feitas com `fetch`. Também usei `localStorage` para guardar as alterações dos livros no navegador e `sessionStorage` para guardar o token recebido no login

O Figma é a referência do layout, e o GitHub é usado para guardar o código e acompanhar as alterações, o projeto também tem um servidor local e comandos de verificação que usam Node.js

## Como abrir o projeto

Abra a pasta do projeto no VS Code e instale a extensão Live Server, de Ritwick Dey.

Depois, clique com o botão direito no arquivo `src/pages/login.html` da pasta principal, e escolha **Open with Live Server**, o projeto vai abrir no navegador, na página do acervo.

Para abrir qualquer tela de login, faça o mesmo com os arquivos `src/pages/login.html`


## Como organizei os arquivos

Separei as páginas, os estilos e os scripts para facilitar a localização de cada parte do projeto

| Pasta ou arquivo | O que fica nele |
| --- | --- |
| `index.html` | Página de entrada, que encaminha para o acervo |
| `src/pages/` | Os arquivos HTML das páginas |
| `src/styles/` | Os arquivos CSS |
| `src/scripts/` | O JavaScript das funcionalidades e das chamadas à API |
| `src/data/` | Os dados iniciais dos livros e as referências das fontes |
| `src/assets/` | As imagens, capas e fontes usadas no site |
| `auth/password/reset/confirm/index.html` | A página que recebe o link de redefinição de senha |
| `tools/` | O servidor local e o script de verificação |
| `tests/` | Os testes de recuperação e redefinição de senha |

## Sobre a API e os dados

Usei a API da Theka para o login, o cadastro e as funções de recuperação e redefinição de senha, o acervo também está integrado à API, permitindo buscar, adicionar, editar e excluir livros


## Como conferir o código

Com o Node.js instalado, pode usar o comando no projeto para verificar a sintaxe do JavaScript e os caminhos dos arquivos:

```bash
npm run check
```

## O que falta fazer


## Referências

- [Enunciado do desafio](https://drive.google.com/file/d/1nis6gGaHB-C3w1JW1_NPO-kLJrGdNfyz/view)
- [Trilha de JavaScript da EJECT](https://drive.google.com/file/d/1OUSBoHxR0oXOt0YmGcRA2VjRZMeAB8IF/view)
- [Telas do projeto no Figma](https://www.figma.com/design/EF8SxbkHZAVwgcedfGkGJI/Trainee-26.2---Front-end?node-id=4070-1414)
- [Documentação da API](https://thekapitrainee.pythonanywhere.com/docs/)
- [Repositório da API](https://github.com/CarlosG18/theka_API)
- [Modelo de projeto JavaScript da EJECT](https://github.com/EJECT4UFRN/MODELO_Trainee_JavaScript)

## Desenvolvedor

[Paulo Gustavo](https://github.com/paulogustavo-beep) — Trainee EJECT 2026.2.
