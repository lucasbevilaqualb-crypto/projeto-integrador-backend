'use strict';
// ============================================================
// Documentação da API no padrão OpenAPI 3 (a "linguagem" do Swagger).
// O server.js entrega este objeto ao Swagger UI, que monta a página /docs.
// Se você criar ou mudar uma rota, atualize este arquivo (um teste avisa se faltar alguma).
// ============================================================
const pacote = require('../package.json');

// Formas de autenticação aceitas pelas rotas protegidas
const protegido = [{ bearerAuth: [] }, { cookieAuth: [] }];
const publico = [];

const ref = (nome) => ({ $ref: `#/components/schemas/${nome}` });
const resp = (nome) => ({ $ref: `#/components/responses/${nome}` });
const json = (schema, exemplo) => ({ 'application/json': exemplo ? { schema, example: exemplo } : { schema } });

const exemploUsuario = {
  id: 2,
  nome: 'Maria da Silva',
  cpf: '12345678909',
  telefone: '86999991234',
  endereco: 'Rua das Flores, 120 - Teresina, PI',
  email: 'maria@teste.com',
  tipoUsuario: { id: 1, nome: 'tutor' },
  criadoEm: '2026-09-30T17:12:24.655Z',
  atualizadoEm: '2026-09-30T17:12:24.655Z'
};

const exemploTipo = {
  id: 4,
  nome: 'Veterinario',
  descricao: 'Apoio clínico',
  cadastroPublico: false,
  criadoEm: '2026-09-30T17:12:24.655Z',
  atualizadoEm: '2026-09-30T17:12:24.655Z'
};

const parametroId = { $ref: '#/components/parameters/Id' };

const base = {
  openapi: '3.0.3',
  info: {
    title: 'Creche Pet API',
    version: pacote.version,
    description: [
      'API de **usuários, tipos de usuário e login** da Creche Pet.',
      '',
      '### Como testar as rotas protegidas aqui no Swagger',
      '1. Abra **POST /autenticacao/login**, clique em *Try it out* e envie `"modo": "token"` (já vem preenchido no exemplo).',
      '2. Copie o valor de `token` da resposta.',
      '3. Clique no botão **Authorize** (cadeado), cole o token em `bearerAuth` e confirme.',
      '4. Agora as rotas com cadeado funcionam. Para as rotas de administrador, entre com o administrador (`admin@crechepet.com`).',
      '',
      '### Cookies x token',
      'No navegador, o login padrão (`"modo": "cookie"`) grava os tokens em **cookies HttpOnly**. Como o Swagger roda em outro endereço que o do front-end,',
      'pedidos que **alteram dados** com cookie são recusados pela defesa contra CSRF (`403 Origem não autorizada`). Por isso, **aqui use o modo `token`**.',
      'Os cookies `token_acesso` (15 min) e `token_renovacao` (7 dias) são o caminho do front-end web; o modo `token` é o do app mobile.'
    ].join('\n')
  },
  servers: [{ url: '/api', description: 'Esta API' }],
  tags: [
    { name: 'Saúde', description: 'Confere se a API e o banco de dados estão respondendo.' },
    { name: 'Autenticação', description: 'Cadastro, login, renovação da sessão e logout.' },
    { name: 'Tipos de usuário', description: 'Categorias de usuário (tutor, profissional, administrador...).' },
    { name: 'Usuários', description: 'Pessoas cadastradas. Cada uma tem um tipo de usuário.' }
  ],

  paths: {
    // ---------------------------------------------------------------- Saúde
    '/saude': {
      get: {
        tags: ['Saúde'],
        summary: 'Verifica se a API e o banco estão no ar',
        security: publico,
        responses: {
          200: { description: 'API e banco respondendo.', content: json(ref('Saude'), { status: 'ok', banco: 'ok', horario: '2026-09-30T17:12:24.655Z' }) },
          503: { description: 'Banco de dados indisponível.', content: json(ref('Saude'), { status: 'erro', banco: 'indisponivel', horario: '2026-09-30T17:12:24.655Z' }) }
        }
      }
    },

    // ---------------------------------------------------------------- Autenticação
    '/autenticacao/cadastro': {
      post: {
        tags: ['Autenticação'],
        summary: 'Cadastra uma pessoa (cria o usuário e o login)',
        description: 'Só aceita tipos de usuário **públicos** (tutor e profissional). O administrador **não** pode ser escolhido aqui. ' +
          'A ficha (`usuario`) e a chave (`login`) são gravadas juntas, numa transação.',
        security: publico,
        requestBody: { required: true, content: json(ref('CadastroRequisicao')) },
        responses: {
          201: { description: 'Cadastro realizado.', content: json(ref('CadastroResposta')) },
          400: resp('Invalido'),
          403: { description: 'Esse tipo de usuário não permite cadastro público.', content: json(ref('Erro')) },
          409: { description: 'E-mail ou CPF já cadastrado no sistema.', content: json(ref('Erro')) },
          429: resp('MuitasRequisicoes')
        }
      }
    },
    '/autenticacao/login': {
      post: {
        tags: ['Autenticação'],
        summary: 'Faz login e abre uma sessão',
        description: 'Confere o e-mail e a senha na tabela `login`. Depois de 5 senhas erradas seguidas, a conta é bloqueada por 15 minutos.\n\n' +
          '- **`"modo": "cookie"`** (padrão): os tokens vão em **cookies HttpOnly** e o corpo traz só o usuário.\n' +
          '- **`"modo": "token"`**: os tokens vêm no corpo da resposta (app mobile e testes no Swagger).',
        security: publico,
        requestBody: {
          required: true,
          content: json(ref('LoginRequisicao'), { email: 'maria@teste.com', senha: 'Senha@1234', modo: 'token' })
        },
        responses: {
          200: {
            description: 'Login feito. No modo `cookie`, a resposta também define os cookies `token_acesso` e `token_renovacao`.',
            headers: {
              'Set-Cookie': {
                description: '`token_acesso` (15 min, Path=/) e `token_renovacao` (7 dias, Path=/api/autenticacao). Ambos HttpOnly, Secure e SameSite=Lax. Só no modo `cookie`.',
                schema: { type: 'string' }
              }
            },
            content: json({ oneOf: [ref('LoginRespostaCookie'), ref('LoginRespostaToken')] })
          },
          400: resp('Invalido'),
          401: { description: 'E-mail ou senha inválidos (a mesma mensagem para os dois casos).', content: json(ref('Erro'), { erro: { codigo: 'CREDENCIAIS_INVALIDAS', mensagem: 'E-mail ou senha inválidos' } }) },
          429: { description: 'Muitas tentativas: conta bloqueada por 15 minutos ou limite de tentativas por IP.', content: json(ref('Erro')) }
        }
      }
    },
    '/autenticacao/renovar': {
      post: {
        tags: ['Autenticação'],
        summary: 'Renova a sessão (troca os dois tokens por um par novo)',
        description: 'Cada token de renovação só vale **uma vez**. Se um token **antigo** for usado de novo, a sessão inteira é encerrada.\n\n' +
          'No modo `cookie`, o cookie `token_renovacao` vai sozinho e o pedido precisa vir de um site da lista `ORIGENS_PERMITIDAS`. ' +
          'No modo `token`, envie o `refreshToken` no corpo.',
        security: publico,
        requestBody: { required: false, content: json(ref('RenovarRequisicao'), { modo: 'token', refreshToken: 'rK3Z9CBEjpK8NsRH8_exemplo_de_token_de_renovacao' }) },
        responses: {
          200: { description: 'Sessão renovada (novos cookies, ou novos tokens no corpo).', content: json({ oneOf: [ref('LoginRespostaCookie'), ref('LoginRespostaToken')] }) },
          400: resp('Invalido'),
          401: { description: 'Sessão inválida, expirada ou revogada.', content: json(ref('Erro'), { erro: { codigo: 'NAO_AUTENTICADO', mensagem: 'Sessão inválida ou expirada. Faça login novamente.' } }) },
          403: { description: 'Pedido com cookie vindo de uma origem não autorizada (defesa contra CSRF).', content: json(ref('Erro')) },
          429: resp('MuitasRequisicoes')
        }
      }
    },
    '/autenticacao/logout': {
      post: {
        tags: ['Autenticação'],
        summary: 'Encerra a sessão (logout de verdade)',
        description: 'Revoga a sessão no banco: o token de acesso e o de renovação **param de valer na hora**, e os cookies são apagados. ' +
          'É **idempotente**: chamar sem sessão não dá erro.',
        security: publico,
        requestBody: { required: false, content: json(ref('RenovarRequisicao'), { modo: 'token', refreshToken: 'rK3Z9CBEjpK8NsRH8_exemplo_de_token_de_renovacao' }) },
        responses: {
          204: { description: 'Sessão encerrada (e cookies apagados, no modo `cookie`).' },
          400: resp('Invalido'),
          403: { description: 'Pedido com cookie vindo de uma origem não autorizada (defesa contra CSRF).', content: json(ref('Erro')) },
          429: resp('MuitasRequisicoes')
        }
      }
    },

    // ---------------------------------------------------------------- Tipos de usuário
    '/tipos-usuario/publicos': {
      get: {
        tags: ['Tipos de usuário'],
        summary: 'Lista os tipos que aparecem na tela "Criar Conta"',
        security: publico,
        responses: {
          200: {
            description: 'Tipos com cadastro público.',
            content: json({ type: 'array', items: ref('TipoUsuarioPublico') }, [
              { id: 1, nome: 'tutor', descricao: 'Dono de Pet' },
              { id: 2, nome: 'profissional', descricao: 'Profissional Acolhedor' }
            ])
          }
        }
      }
    },
    '/tipos-usuario': {
      get: {
        tags: ['Tipos de usuário'],
        summary: 'Lista todos os tipos (administrador)',
        security: protegido,
        responses: {
          200: { description: 'Todos os tipos.', content: json({ type: 'array', items: ref('TipoUsuario') }) },
          401: resp('NaoAutenticado'),
          403: resp('Proibido')
        }
      },
      post: {
        tags: ['Tipos de usuário'],
        summary: 'Cria um tipo de usuário (administrador)',
        description: 'O nome é único, sem diferenciar maiúsculas de minúsculas. O tipo `administrador` nunca pode ter cadastro público.',
        security: protegido,
        requestBody: { required: true, content: json(ref('CriarTipoRequisicao'), { nome: 'Veterinario', descricao: 'Apoio clínico', cadastroPublico: false }) },
        responses: {
          201: { description: 'Tipo criado.', content: json(ref('TipoUsuario'), exemploTipo) },
          400: resp('Invalido'),
          401: resp('NaoAutenticado'),
          403: resp('Proibido'),
          409: { description: 'Já existe um tipo com esse nome.', content: json(ref('Erro')) }
        }
      }
    },
    '/tipos-usuario/{id}': {
      parameters: [parametroId],
      get: {
        tags: ['Tipos de usuário'],
        summary: 'Busca um tipo (administrador)',
        security: protegido,
        responses: {
          200: { description: 'O tipo.', content: json(ref('TipoUsuario'), exemploTipo) },
          400: resp('Invalido'),
          401: resp('NaoAutenticado'),
          403: resp('Proibido'),
          404: resp('NaoEncontrado')
        }
      },
      put: {
        tags: ['Tipos de usuário'],
        summary: 'Atualiza um tipo (administrador)',
        description: 'Os tipos base (`tutor`, `profissional`, `administrador`) não podem ser renomeados.',
        security: protegido,
        requestBody: { required: true, content: json(ref('AtualizarTipoRequisicao'), { descricao: 'Apoio clínico e vacinas', cadastroPublico: true }) },
        responses: {
          200: { description: 'Tipo atualizado.', content: json(ref('TipoUsuario'), exemploTipo) },
          400: resp('Invalido'),
          401: resp('NaoAutenticado'),
          403: resp('Proibido'),
          404: resp('NaoEncontrado'),
          409: resp('Conflito')
        }
      },
      delete: {
        tags: ['Tipos de usuário'],
        summary: 'Remove um tipo (administrador)',
        description: 'Não remove os tipos base, nem um tipo que ainda tenha usuários (`409`).',
        security: protegido,
        responses: {
          204: { description: 'Tipo removido.' },
          400: resp('Invalido'),
          401: resp('NaoAutenticado'),
          403: resp('Proibido'),
          404: resp('NaoEncontrado'),
          409: resp('Conflito')
        }
      }
    },

    // ---------------------------------------------------------------- Usuários
    '/usuarios/eu': {
      get: {
        tags: ['Usuários'],
        summary: 'Meu perfil',
        security: protegido,
        responses: {
          200: { description: 'Os dados de quem está logado.', content: json(ref('Usuario'), exemploUsuario) },
          401: resp('NaoAutenticado')
        }
      }
    },
    '/usuarios': {
      get: {
        tags: ['Usuários'],
        summary: 'Lista os usuários, paginado (administrador)',
        security: protegido,
        parameters: [
          { name: 'pagina', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limite', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'tipoUsuarioId', in: 'query', description: 'Filtra por tipo de usuário.', schema: { type: 'integer', minimum: 1 } }
        ],
        responses: {
          200: { description: 'Uma página de usuários.', content: json(ref('PaginaUsuarios')) },
          400: resp('Invalido'),
          401: resp('NaoAutenticado'),
          403: resp('Proibido')
        }
      },
      post: {
        tags: ['Usuários'],
        summary: 'Cria um usuário de qualquer tipo (administrador)',
        security: protegido,
        requestBody: { required: true, content: json(ref('CadastroRequisicao')) },
        responses: {
          201: { description: 'Usuário criado.', content: json(ref('Usuario'), exemploUsuario) },
          400: resp('Invalido'),
          401: resp('NaoAutenticado'),
          403: resp('Proibido'),
          409: { description: 'E-mail ou CPF já cadastrado no sistema.', content: json(ref('Erro')) }
        }
      }
    },
    '/usuarios/{id}': {
      parameters: [parametroId],
      get: {
        tags: ['Usuários'],
        summary: 'Busca um usuário (o próprio ou administrador)',
        security: protegido,
        responses: {
          200: { description: 'O usuário.', content: json(ref('Usuario'), exemploUsuario) },
          400: resp('Invalido'),
          401: resp('NaoAutenticado'),
          403: resp('Proibido'),
          404: resp('NaoEncontrado')
        }
      },
      put: {
        tags: ['Usuários'],
        summary: 'Atualiza um usuário (o próprio ou administrador)',
        description: 'Só o administrador pode mudar o `tipoUsuarioId`. O último administrador não pode ser rebaixado.',
        security: protegido,
        requestBody: { required: true, content: json(ref('AtualizarUsuarioRequisicao'), { nome: 'Maria Souza da Silva', telefone: '(86) 98888-0000' }) },
        responses: {
          200: { description: 'Usuário atualizado.', content: json(ref('Usuario'), exemploUsuario) },
          400: resp('Invalido'),
          401: resp('NaoAutenticado'),
          403: resp('Proibido'),
          404: resp('NaoEncontrado'),
          409: resp('Conflito')
        }
      },
      delete: {
        tags: ['Usuários'],
        summary: 'Remove um usuário (o próprio ou administrador)',
        description: 'O login e as sessões do usuário são apagados junto. O último administrador não pode ser removido (`409`).',
        security: protegido,
        responses: {
          204: { description: 'Usuário removido.' },
          400: resp('Invalido'),
          401: resp('NaoAutenticado'),
          403: resp('Proibido'),
          404: resp('NaoEncontrado'),
          409: resp('Conflito')
        }
      }
    },
    '/usuarios/{id}/senha': {
      parameters: [parametroId],
      put: {
        tags: ['Usuários'],
        summary: 'Troca a própria senha',
        description: 'Exige a senha atual. Ao trocar, as sessões abertas em **outros** aparelhos são encerradas.',
        security: protegido,
        requestBody: { required: true, content: json(ref('AlterarSenhaRequisicao'), { senhaAtual: 'Senha@1234', novaSenha: 'NovaSenha@5678' }) },
        responses: {
          200: { description: 'Senha alterada.', content: json({ type: 'object', properties: { mensagem: { type: 'string', example: 'Senha alterada com sucesso.' } } }) },
          400: resp('Invalido'),
          401: resp('NaoAutenticado'),
          403: resp('Proibido'),
          404: resp('NaoEncontrado')
        }
      }
    }
  },

  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token de acesso (15 minutos). Obtenha em **POST /autenticacao/login** com `"modo": "token"`.'
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'token_acesso',
        description: 'Cookie HttpOnly gravado pelo login no modo `cookie` (o navegador o envia sozinho).'
      }
    },

    parameters: {
      Id: { name: 'id', in: 'path', required: true, description: 'Identificador numérico.', schema: { type: 'integer', minimum: 1 } }
    },

    responses: {
      Invalido: {
        description: 'Dados inválidos: a resposta mostra o campo e o motivo.',
        content: json(ref('Erro'), {
          erro: {
            codigo: 'REQUISICAO_INVALIDA',
            mensagem: 'Dados inválidos.',
            detalhes: [{ campo: 'cpf', mensagem: 'CPF inválido.' }, { campo: 'senha', mensagem: 'A senha deve ter no mínimo 8 caracteres.' }]
          }
        })
      },
      NaoAutenticado: {
        description: 'Sem token válido (ausente, inválido, expirado ou sessão encerrada).',
        content: json(ref('Erro'), { erro: { codigo: 'NAO_AUTENTICADO', mensagem: 'Autenticação necessária.' } })
      },
      Proibido: {
        description: 'Sem permissão para esta ação.',
        content: json(ref('Erro'), { erro: { codigo: 'ACESSO_NEGADO', mensagem: 'Você não tem permissão para realizar esta ação.' } })
      },
      NaoEncontrado: {
        description: 'Não encontrado.',
        content: json(ref('Erro'), { erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Usuário não encontrado.' } })
      },
      Conflito: {
        description: 'Conflito com uma regra do sistema (nome repetido, registro em uso, último administrador...).',
        content: json(ref('Erro'))
      },
      MuitasRequisicoes: {
        description: 'Muitas requisições deste IP. Tente novamente mais tarde.',
        content: json(ref('Erro'), { erro: { codigo: 'MUITAS_REQUISICOES', mensagem: 'Muitas requisições. Tente novamente mais tarde.' } })
      }
    },

    schemas: {
      Erro: {
        type: 'object',
        description: 'Formato de todos os erros da API.',
        properties: {
          erro: {
            type: 'object',
            properties: {
              codigo: { type: 'string', example: 'REQUISICAO_INVALIDA' },
              mensagem: { type: 'string', example: 'Dados inválidos.' },
              detalhes: {
                type: 'array',
                description: 'Só aparece nos erros de validação.',
                items: { type: 'object', properties: { campo: { type: 'string' }, mensagem: { type: 'string' } } }
              }
            }
          }
        }
      },
      Saude: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok', 'erro'] },
          banco: { type: 'string', enum: ['ok', 'indisponivel'] },
          horario: { type: 'string', format: 'date-time' }
        }
      },

      TipoUsuarioPublico: {
        type: 'object',
        properties: { id: { type: 'integer' }, nome: { type: 'string' }, descricao: { type: 'string', nullable: true } }
      },
      TipoUsuario: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          nome: { type: 'string' },
          descricao: { type: 'string', nullable: true },
          cadastroPublico: { type: 'boolean' },
          criadoEm: { type: 'string', format: 'date-time' },
          atualizadoEm: { type: 'string', format: 'date-time' }
        }
      },
      CriarTipoRequisicao: {
        type: 'object',
        additionalProperties: false,
        required: ['nome'],
        properties: {
          nome: { type: 'string', minLength: 3, maxLength: 40, description: 'Só letras, espaços, _ e -.' },
          descricao: { type: 'string', maxLength: 200 },
          cadastroPublico: { type: 'boolean', default: false }
        }
      },
      AtualizarTipoRequisicao: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          nome: { type: 'string', minLength: 3, maxLength: 40 },
          descricao: { type: 'string', maxLength: 200, nullable: true },
          cadastroPublico: { type: 'boolean' }
        }
      },

      Usuario: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          nome: { type: 'string' },
          cpf: { type: 'string', description: 'Somente dígitos.' },
          telefone: { type: 'string', description: 'Somente dígitos (DDD + número).' },
          endereco: { type: 'string', nullable: true },
          email: { type: 'string', format: 'email' },
          tipoUsuario: { type: 'object', properties: { id: { type: 'integer' }, nome: { type: 'string' } } },
          criadoEm: { type: 'string', format: 'date-time' },
          atualizadoEm: { type: 'string', format: 'date-time' }
        }
      },
      PaginaUsuarios: {
        type: 'object',
        properties: {
          dados: { type: 'array', items: ref('Usuario') },
          paginacao: {
            type: 'object',
            properties: { pagina: { type: 'integer' }, limite: { type: 'integer' }, total: { type: 'integer' }, totalPaginas: { type: 'integer' } }
          }
        }
      },
      CadastroRequisicao: {
        type: 'object',
        additionalProperties: false,
        required: ['nome', 'cpf', 'telefone', 'email', 'senha', 'tipoUsuarioId'],
        properties: {
          nome: { type: 'string', minLength: 3, maxLength: 120, example: 'Maria da Silva' },
          cpf: { type: 'string', description: 'CPF válido, com ou sem pontuação.', example: '123.456.789-09' },
          telefone: { type: 'string', description: 'DDD + número (10 ou 11 dígitos).', example: '(86) 99999-1234' },
          endereco: { type: 'string', minLength: 5, maxLength: 200, example: 'Rua das Flores, 120 - Teresina, PI' },
          email: { type: 'string', format: 'email', maxLength: 254, example: 'maria@teste.com' },
          senha: {
            type: 'string',
            minLength: 8,
            maxLength: 72,
            description: 'De 8 a 72 bytes, com maiúscula, minúscula, número e símbolo.',
            example: 'Senha@1234'
          },
          tipoUsuarioId: { type: 'integer', minimum: 1, description: 'Veja os tipos em GET /tipos-usuario/publicos.', example: 1 }
        }
      },
      CadastroResposta: {
        type: 'object',
        properties: {
          mensagem: { type: 'string', example: 'Cadastro realizado com sucesso! Faça login para continuar.' },
          usuario: ref('Usuario')
        }
      },
      AtualizarUsuarioRequisicao: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          nome: { type: 'string', minLength: 3, maxLength: 120 },
          telefone: { type: 'string' },
          endereco: { type: 'string', nullable: true },
          email: { type: 'string', format: 'email' },
          tipoUsuarioId: { type: 'integer', minimum: 1, description: 'Somente administrador.' }
        }
      },
      AlterarSenhaRequisicao: {
        type: 'object',
        additionalProperties: false,
        required: ['senhaAtual', 'novaSenha'],
        properties: {
          senhaAtual: { type: 'string' },
          novaSenha: { type: 'string', minLength: 8, maxLength: 72, description: 'Mesma política de senha do cadastro.' }
        }
      },

      LoginRequisicao: {
        type: 'object',
        additionalProperties: false,
        required: ['email', 'senha'],
        properties: {
          email: { type: 'string', format: 'email' },
          senha: { type: 'string' },
          modo: { type: 'string', enum: ['cookie', 'token'], default: 'cookie', description: '`cookie`: tokens em cookies HttpOnly (web). `token`: tokens no corpo (mobile).' }
        }
      },
      RenovarRequisicao: {
        type: 'object',
        additionalProperties: false,
        properties: {
          modo: { type: 'string', enum: ['cookie', 'token'], default: 'cookie' },
          refreshToken: { type: 'string', minLength: 20, maxLength: 200, description: 'Só no modo `token` (no modo `cookie` ele vem do cookie).' }
        }
      },
      LoginRespostaCookie: {
        type: 'object',
        description: 'Modo `cookie`: nenhum token no corpo (eles vão nos cookies HttpOnly).',
        additionalProperties: false,
        required: ['usuario', 'acessoExpiraEmMinutos'],
        properties: { usuario: ref('Usuario'), acessoExpiraEmMinutos: { type: 'integer', example: 15 } }
      },
      LoginRespostaToken: {
        type: 'object',
        description: 'Modo `token`: os tokens vêm no corpo.',
        additionalProperties: false,
        required: ['tipoToken', 'token', 'refreshToken', 'acessoExpiraEmMinutos', 'usuario'],
        properties: {
          tipoToken: { type: 'string', example: 'Bearer' },
          token: { type: 'string', description: 'Token de acesso (JWT), válido por 15 minutos.' },
          refreshToken: { type: 'string', description: 'Token de renovação. Guarde no armazenamento seguro do aparelho.' },
          acessoExpiraEmMinutos: { type: 'integer', example: 15 },
          usuario: ref('Usuario')
        }
      }
    }
  }
};

// Junta a documentação dos painéis (tutor, profissional e administrador).
const paineis = require('./openapiPaineis');

module.exports = {
  ...base,
  tags: [...base.tags, ...paineis.tags],
  paths: { ...base.paths, ...paineis.paths },
  components: {
    ...base.components,
    parameters: { ...base.components.parameters, ...paineis.components.parameters },
    responses: { ...base.components.responses, ...paineis.components.responses },
    schemas: { ...base.components.schemas, ...paineis.components.schemas }
  }
};
