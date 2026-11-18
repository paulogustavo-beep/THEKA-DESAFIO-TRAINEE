import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { recuperarSenhaNaApi, redefinirSenhaNaApi } from '../src/scripts/api.js';

// Dados fictícios. Todas as requisições destes testes são interceptadas.
const pedido = {
    uid: 'uid-teste',
    token: 'token-teste',
    senha: 'abcdefgh',
    confirmacao: 'abcdefgh'
};

const sucesso = () => Response.json({ message: 'Operação concluída' });

afterEach(() => mock.restoreAll());

test('recuperação usa o endpoint e o e-mail normalizado sem credenciais', async () => {
    const chamada = mock.method(globalThis, 'fetch', async (url, opcoes) => {
        assert.equal(
            url,
            'https://thekapitrainee.pythonanywhere.com/auth/password/reset/'
        );

        assert.equal(opcoes.method, 'POST');
        assert.equal(opcoes.credentials, 'omit');
        assert.equal(opcoes.referrerPolicy, 'no-referrer');
        assert.equal(opcoes.headers['Content-Type'], 'application/json');

        assert.deepEqual(JSON.parse(opcoes.body), {
            email: 'teste@example.invalid'
        });

        return sucesso();
    });

    await recuperarSenhaNaApi(' Teste@Example.Invalid ');
    assert.equal(chamada.mock.callCount(), 1);
});

test('redefinição usa os nomes de campos da API sem impor a regra do cadastro', async () => {
    mock.method(globalThis, 'fetch', async (url, opcoes) => {
        assert.equal(
            url,
            'https://thekapitrainee.pythonanywhere.com/auth/password/reset/confirm/'
        );

        assert.deepEqual(JSON.parse(opcoes.body), {
            uid: pedido.uid,
            token: pedido.token,
            new_password: pedido.senha,
            new_password_confirm: pedido.confirmacao
        });

        assert.equal(opcoes.cache, 'no-store');
        return sucesso();
    });

    await redefinirSenhaNaApi(pedido);
});

test('link incompleto não chega à API', async () => {
    const chamada = mock.method(globalThis, 'fetch', async () => sucesso());

    for (const incompleto of [
        { uid: '' },
        { token: undefined },
        { token: ' ' }
    ]) {
        await assert.rejects(
            redefinirSenhaNaApi({ ...pedido, ...incompleto }),
            { codigo: 'link_invalido' }
        );
    }

    assert.equal(chamada.mock.callCount(), 0);
});

test('erro de usuário ou token orienta a solicitar outro link', async () => {
    let campo = 'token';

    mock.method(globalThis, 'fetch', async () =>
        Response.json(
            { [campo]: ['Link inválido ou expirado.'] },
            { status: 400 }
        )
    );

    await assert.rejects(
        redefinirSenhaNaApi(pedido),
        { codigo: 'link_invalido' }
    );

    campo = 'uid';

    await assert.rejects(
        redefinirSenhaNaApi(pedido),
        { codigo: 'link_invalido' }
    );
});

test('recuperação apresenta o erro do e-mail devolvido pela API', async () => {
    mock.method(globalThis, 'fetch', async () =>
        Response.json(
            { email: ['Não existe usuário com este email.'] },
            { status: 400 }
        )
    );

    await assert.rejects(
        recuperarSenhaNaApi('teste@example.invalid'),
        /E-mail: Não existe usuário/
    );
});

test('redefinição apresenta erros de senha sem classificá-los como link expirado', async () => {
    mock.method(globalThis, 'fetch', async () =>
        Response.json(
            { new_password_confirm: ['As senhas não coincidem.'] },
            { status: 400 }
        )
    );

    await assert.rejects(redefinirSenhaNaApi(pedido), erro => {
        assert.match(
            erro.message,
            /Confirmar nova senha: As senhas não coincidem/
        );

        assert.equal(erro.codigo, undefined);
        return true;
    });
});

test('excesso de tentativas não informa sucesso', async () => {
    mock.method(
        globalThis,
        'fetch',
        async () => new Response('', { status: 429 })
    );

    await assert.rejects(
        recuperarSenhaNaApi('teste@example.invalid'),
        /Muitas tentativas/
    );

    await assert.rejects(
        redefinirSenhaNaApi(pedido),
        /Muitas tentativas/
    );
});

test('falha do servidor diferencia envio incerto de alteração incerta', async () => {
    mock.method(
        globalThis,
        'fetch',
        async () => new Response('Indisponível', { status: 503 })
    );

    await assert.rejects(
        recuperarSenhaNaApi('teste@example.invalid'),
        /confirmar o envio/
    );

    await assert.rejects(
        redefinirSenhaNaApi(pedido),
        /Tente entrar com a nova senha/
    );
});

test('respostas incompletas ou inesperadas não são tratadas como sucesso', async () => {
    const respostas = [
        () => new Response('<html>Falha</html>'),
        () => Response.json({}),
        () => Response.json({ message: ' ' }),
        () => Response.json({ message: 'Recebido' }, { status: 202 }),
        () => new Response(null, { status: 204 })
    ];

    for (const resposta of respostas) {
        mock.method(globalThis, 'fetch', async () => resposta());

        await assert.rejects(
            recuperarSenhaNaApi('teste@example.invalid'),
            /confirmar o envio/
        );

        await assert.rejects(
            redefinirSenhaNaApi(pedido),
            /confirmar a alteração/
        );

        mock.restoreAll();
    }
});

test('queda de rede não dispara uma segunda solicitação automaticamente', async () => {
    const chamada = mock.method(globalThis, 'fetch', async () => {
        throw new TypeError('Conexão interrompida');
    });

    await assert.rejects(
        redefinirSenhaNaApi(pedido),
        /confirmar a alteração/
    );

    assert.equal(chamada.mock.callCount(), 1);
});

test('tempo limite cancela a requisição e informa resultado incerto', async () => {
    mock.method(globalThis, 'setTimeout', (funcao, tempo) => {
        assert.equal(tempo, 15000);
        queueMicrotask(funcao);
        return 0;
    });

    mock.method(globalThis, 'clearTimeout', () => {});

    mock.method(
        globalThis,
        'fetch',
        (_url, { signal }) => new Promise((_resolve, reject) => {
            signal.addEventListener(
                'abort',
                () => reject(new DOMException('Tempo limite', 'AbortError')),
                { once: true }
            );
        })
    );

    await assert.rejects(
        recuperarSenhaNaApi('teste@example.invalid'),
        /confirmar o envio/
    );
});