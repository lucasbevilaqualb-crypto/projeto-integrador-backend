'use strict';
// ============================================================
// Documentação dos PAINÉIS (tutor, profissional e administrador).
// Este arquivo é juntado ao docs/openapi.js, que entrega tudo ao Swagger UI.
// ============================================================
const protegido = [{ bearerAuth: [] }, { cookieAuth: [] }];

const ref = (nome) => ({ $ref: `#/components/schemas/${nome}` });
const resp = (nome) => ({ $ref: `#/components/responses/${nome}` });
const json = (schema, exemplo) => ({ 'application/json': exemplo ? { schema, example: exemplo } : { schema } });
const lista = (nome) => ({ type: 'array', items: ref(nome) });
const param = (nome) => ({ $ref: `#/components/parameters/${nome}` });

const exemploData = '2026-10-05';
const exemploCreche = { id: 1, nome: 'Creche Patinhas', endereco: 'Av. Frei Serafim, 1200 - Teresina', telefone: '8632221000', capacidade: 20, criadoEm: '2026-10-01T21:47:23.034Z', atualizadoEm: '2026-10-01T21:47:23.034Z' };
const exemploPet = { id: 1, nome: 'Thor', raca: 'Labrador', idade: 3, castrado: true, vacinas: [{ id: 1, produto: 'V10', dose: '1ª dose', data: '2026-08-10' }], criadoEm: '2026-10-01T21:47:24.847Z', atualizadoEm: '2026-10-01T21:47:24.847Z' };
const exemploAgendamento = { id: 1, data: exemploData, horaInicio: '08:00', horaFim: '17:00', status: 'agendado', pet: { id: 1, nome: 'Thor', raca: 'Labrador', castrado: true }, creche: { id: 1, nome: 'Creche Patinhas' } };

// As rotas de cada painel só aceitam o tipo certo de usuário
const SO_TUTOR = 'Painel do **tutor**: só quem é tutor entra. O administrador **não** entra.';
const SO_ADMIN = 'Painel do **administrador**: tutor e profissional recebem `403`.';
const SO_PROFISSIONAL = 'Painel do **profissional**: precisa estar **vinculado a uma creche**. Sem vínculo, a resposta é `403 VINCULO_PENDENTE` (conta em análise).';

const base = (tag, resumo, extra) => ({ tags: [tag], summary: resumo, security: protegido, ...extra });

module.exports = {
  tags: [
    { name: 'Painel do tutor', description: 'Pets, vacinas, creches com vagas, agendamentos e acompanhamento. Só o tutor entra.' },
    { name: 'Painel do profissional', description: 'Agenda da creche, atendimento e atividades. Só o profissional **vinculado** entra.' },
    { name: 'Painel do administrador', description: 'Creches, vínculo dos profissionais e métricas. Só o administrador entra.' }
  ],

  paths: {
    // ================================================================ TUTOR
    '/tutor/painel': {
      get: base('Painel do tutor', 'Resumo da tela inicial do tutor', {
        description: SO_TUTOR,
        responses: { 200: { description: 'Quantidade de pets, próximos agendamentos e atendimentos em andamento (com as últimas atividades).', content: json(ref('PainelTutor')) }, 401: resp('NaoAutenticado'), 403: resp('Proibido') }
      })
    },
    '/tutor/pets': {
      get: base('Painel do tutor', 'Lista os meus pets', {
        description: SO_TUTOR,
        responses: { 200: { description: 'Só os pets de quem está logado.', content: json(lista('Pet')) }, 401: resp('NaoAutenticado'), 403: resp('Proibido') }
      }),
      post: base('Painel do tutor', 'Cadastra um pet', {
        description: SO_TUTOR + ' O dono é sempre quem está logado: não existe campo para escolher outro dono.',
        requestBody: { required: true, content: json(ref('CriarPetRequisicao'), { nome: 'Thor', raca: 'Labrador', idade: 3, castrado: true }) },
        responses: { 201: { description: 'Pet criado.', content: json(ref('Pet'), exemploPet) }, 400: resp('Invalido'), 401: resp('NaoAutenticado'), 403: resp('Proibido') }
      })
    },
    '/tutor/pets/{id}': {
      parameters: [param('Id')],
      get: base('Painel do tutor', 'Busca um dos meus pets (com as vacinas)', {
        description: SO_TUTOR + ' Pet de **outra pessoa** responde `404` (e não `403`), para não revelar que ele existe.',
        responses: { 200: { description: 'O pet.', content: json(ref('Pet'), exemploPet) }, 400: resp('Invalido'), 401: resp('NaoAutenticado'), 403: resp('Proibido'), 404: resp('NaoEncontrado') }
      }),
      put: base('Painel do tutor', 'Atualiza um dos meus pets', {
        description: SO_TUTOR,
        requestBody: { required: true, content: json(ref('AtualizarPetRequisicao'), { idade: 4, castrado: false }) },
        responses: { 200: { description: 'Pet atualizado.', content: json(ref('Pet'), exemploPet) }, 400: resp('Invalido'), 401: resp('NaoAutenticado'), 403: resp('Proibido'), 404: resp('NaoEncontrado') }
      }),
      delete: base('Painel do tutor', 'Apaga um dos meus pets', {
        description: SO_TUTOR + ' Não apaga pet com agendamento **em aberto** (`409`): cancele antes. As vacinas vão junto.',
        responses: { 204: { description: 'Pet apagado.' }, 400: resp('Invalido'), 401: resp('NaoAutenticado'), 403: resp('Proibido'), 404: resp('NaoEncontrado'), 409: resp('Conflito') }
      })
    },
    '/tutor/pets/{id}/vacinas': {
      parameters: [param('Id')],
      post: base('Painel do tutor', 'Registra uma vacina do pet', {
        description: SO_TUTOR + ' A data da vacina não pode estar no futuro.',
        requestBody: { required: true, content: json(ref('CriarVacinaRequisicao'), { produto: 'V10', dose: '1ª dose', data: '2026-08-10' }) },
        responses: { 201: { description: 'O pet, já com a vacina na lista.', content: json(ref('Pet'), exemploPet) }, 400: resp('Invalido'), 401: resp('NaoAutenticado'), 403: resp('Proibido'), 404: resp('NaoEncontrado') }
      })
    },
    '/tutor/pets/{id}/vacinas/{vacinaId}': {
      parameters: [param('Id'), param('VacinaId')],
      delete: base('Painel do tutor', 'Remove uma vacina do pet', {
        description: SO_TUTOR,
        responses: { 204: { description: 'Vacina removida.' }, 400: resp('Invalido'), 401: resp('NaoAutenticado'), 403: resp('Proibido'), 404: resp('NaoEncontrado') }
      })
    },
    '/tutor/creches': {
      get: base('Painel do tutor', 'Lista as creches com as vagas livres de uma data', {
        description: SO_TUTOR + ' Se `data` não for informada, usa o dia de hoje.',
        parameters: [param('DataConsulta')],
        responses: { 200: { description: 'Cada creche com as vagas (capacidade, ocupadas e livres) na data.', content: json(lista('CrecheComVagas')) }, 400: resp('Invalido'), 401: resp('NaoAutenticado'), 403: resp('Proibido') }
      })
    },
    '/tutor/agendamentos': {
      get: base('Painel do tutor', 'Lista os meus agendamentos', {
        description: SO_TUTOR,
        parameters: [{ name: 'status', in: 'query', description: 'Filtra por status.', schema: { $ref: '#/components/schemas/StatusAgendamento' } }],
        responses: { 200: { description: 'Os agendamentos dos meus pets.', content: json(lista('AgendamentoTutor')) }, 400: resp('Invalido'), 401: resp('NaoAutenticado'), 403: resp('Proibido') }
      }),
      post: base('Painel do tutor', 'Agenda um dia na creche', {
        description: SO_TUTOR + '\n\nRecusa: data passada, horário de saída antes da entrada, pet de outra pessoa (`404`), mesmo pet duas vezes no dia (`409`) e **dia sem vagas** (`409`). ' +
          'A conferência das vagas acontece numa transação que **trava** a creche: cinco pessoas disputando a última vaga ao mesmo tempo, só uma consegue.',
        requestBody: { required: true, content: json(ref('AgendarRequisicao'), { petId: 1, crecheId: 1, data: exemploData, horaInicio: '08:00', horaFim: '17:00' }) },
        responses: {
          201: { description: 'Agendado.', content: json(ref('AgendamentoTutor'), exemploAgendamento) },
          400: resp('Invalido'), 401: resp('NaoAutenticado'), 403: resp('Proibido'), 404: resp('NaoEncontrado'),
          409: { description: 'Não há vagas nesta data, ou o pet já tem agendamento no dia.', content: json(ref('Erro')) }
        }
      })
    },
    '/tutor/agendamentos/{id}': {
      parameters: [param('Id')],
      get: base('Painel do tutor', 'Busca um agendamento (com as atividades)', {
        description: SO_TUTOR,
        responses: { 200: { description: 'O agendamento.', content: json(ref('AgendamentoTutor'), exemploAgendamento) }, 400: resp('Invalido'), 401: resp('NaoAutenticado'), 403: resp('Proibido'), 404: resp('NaoEncontrado') }
      }),
      put: base('Painel do tutor', 'Altera a data e/ou os horários', {
        description: SO_TUTOR + ' Só enquanto o status for `agendado`. Mudar de dia confere as vagas da nova data.',
        requestBody: { required: true, content: json(ref('AlterarAgendamentoRequisicao'), { data: exemploData, horaInicio: '09:00', horaFim: '16:00' }) },
        responses: { 200: { description: 'Agendamento alterado.', content: json(ref('AgendamentoTutor'), exemploAgendamento) }, 400: resp('Invalido'), 401: resp('NaoAutenticado'), 403: resp('Proibido'), 404: resp('NaoEncontrado'), 409: resp('Conflito') }
      })
    },
    '/tutor/agendamentos/{id}/cancelar': {
      parameters: [param('Id')],
      post: base('Painel do tutor', 'Cancela o agendamento', {
        description: SO_TUTOR + ' Só enquanto o status for `agendado`. A vaga volta a ficar livre.',
        responses: { 200: { description: 'Agendamento cancelado.', content: json(ref('AgendamentoTutor')) }, 400: resp('Invalido'), 401: resp('NaoAutenticado'), 403: resp('Proibido'), 404: resp('NaoEncontrado'), 409: resp('Conflito') }
      })
    },
    '/tutor/agendamentos/{id}/atividades': {
      parameters: [param('Id')],
      get: base('Painel do tutor', 'Acompanha as atividades do atendimento', {
        description: SO_TUTOR + ' Para "tempo real", o front consulta de tempos em tempos enviando `depois` com o horário da última atividade recebida: só vêm as novas.',
        parameters: [{ name: 'depois', in: 'query', description: 'Data e hora ISO (por exemplo 2026-10-05T14:30:00.000Z).', schema: { type: 'string', format: 'date-time' } }],
        responses: { 200: { description: 'Atividades registradas pelo profissional, da mais antiga para a mais nova.', content: json(lista('Atividade')) }, 400: resp('Invalido'), 401: resp('NaoAutenticado'), 403: resp('Proibido'), 404: resp('NaoEncontrado') }
      })
    },

    // ================================================================ PROFISSIONAL
    '/profissional/vinculo': {
      get: base('Painel do profissional', 'Consulta se a minha conta já foi vinculada a uma creche', {
        description: 'Funciona **mesmo sem vínculo**: é a rota da tela "conta em análise" (botão *Verificar liberação*). Só profissionais.',
        responses: { 200: { description: '`pendente` (aguardando a administração) ou `ativo` (com a creche).', content: json(ref('VinculoStatus')) }, 401: resp('NaoAutenticado'), 403: resp('Proibido') }
      })
    },
    '/profissional/painel': {
      get: base('Painel do profissional', 'Resumo da tela inicial do profissional', {
        description: SO_PROFISSIONAL,
        responses: { 200: { description: 'A creche, os números de hoje (por status e vagas), os próximos agendamentos e as atividades de hoje.', content: json(ref('PainelProfissional')) }, 401: resp('NaoAutenticado'), 403: resp('ProibidoOuVinculoPendente') }
      })
    },
    '/profissional/agenda': {
      get: base('Painel do profissional', 'Agenda da minha creche num dia, com as vagas', {
        description: SO_PROFISSIONAL + ' A creche vem do **vínculo**, nunca do pedido: o profissional só enxerga a própria.',
        parameters: [param('DataConsulta')],
        responses: { 200: { description: 'Os agendamentos do dia (com pet e tutor) e as vagas.', content: json(ref('AgendaProfissional')) }, 400: resp('Invalido'), 401: resp('NaoAutenticado'), 403: resp('ProibidoOuVinculoPendente') }
      })
    },
    '/profissional/agendamentos/{id}': {
      parameters: [param('Id')],
      get: base('Painel do profissional', 'Detalhes de um agendamento (pet, vacinas, castrado e tutor)', {
        description: SO_PROFISSIONAL + ' Agendamento de **outra creche** responde `404`.',
        responses: { 200: { description: 'O agendamento, com tudo o que o profissional precisa saber do pet.', content: json(ref('AgendamentoDetalhe')) }, 400: resp('Invalido'), 401: resp('NaoAutenticado'), 403: resp('ProibidoOuVinculoPendente'), 404: resp('NaoEncontrado') }
      })
    },
    '/profissional/agendamentos/{id}/status': {
      parameters: [param('Id')],
      put: base('Painel do profissional', 'Inicia ou conclui o atendimento', {
        description: SO_PROFISSIONAL + '\n\nTransições permitidas: `agendado` → `em_andamento` (só **no dia agendado**) e `em_andamento` → `concluido`.',
        requestBody: { required: true, content: json(ref('MudarStatusRequisicao'), { status: 'em_andamento' }) },
        responses: { 200: { description: 'Agendamento com o novo status.', content: json(ref('AgendamentoDetalhe')) }, 400: resp('Invalido'), 401: resp('NaoAutenticado'), 403: resp('ProibidoOuVinculoPendente'), 404: resp('NaoEncontrado'), 409: resp('Conflito') }
      })
    },
    '/profissional/agendamentos/{id}/atividades': {
      parameters: [param('Id')],
      post: base('Painel do profissional', 'Registra uma atividade do dia', {
        description: SO_PROFISSIONAL + ' Só durante o atendimento (status `em_andamento`). O tutor acompanha pelo painel dele.',
        requestBody: { required: true, content: json(ref('CriarAtividadeRequisicao'), { descricao: 'Passeio no jardim' }) },
        responses: { 201: { description: 'Atividade registrada.', content: json(ref('Atividade'), { id: 1, descricao: 'Passeio no jardim', registradaEm: '2026-10-05T14:30:00.000Z' }) }, 400: resp('Invalido'), 401: resp('NaoAutenticado'), 403: resp('ProibidoOuVinculoPendente'), 404: resp('NaoEncontrado'), 409: resp('Conflito') }
      })
    },

    // ================================================================ ADMINISTRADOR
    '/admin/painel': {
      get: base('Painel do administrador', 'Métricas da tela inicial da administração', {
        description: SO_ADMIN,
        responses: { 200: { description: 'Usuários por tipo, profissionais em análise, creches e agendamentos.', content: json(ref('PainelAdmin')) }, 401: resp('NaoAutenticado'), 403: resp('Proibido') }
      })
    },
    '/admin/creches': {
      get: base('Painel do administrador', 'Lista as creches', {
        description: SO_ADMIN,
        responses: { 200: { description: 'Todas as creches.', content: json(lista('Creche')) }, 401: resp('NaoAutenticado'), 403: resp('Proibido') }
      }),
      post: base('Painel do administrador', 'Cria uma creche', {
        description: SO_ADMIN + ' O nome é único (sem diferenciar maiúsculas). `capacidade` = vagas **por dia**.',
        requestBody: { required: true, content: json(ref('CriarCrecheRequisicao'), { nome: 'Creche Patinhas', endereco: 'Av. Frei Serafim, 1200 - Teresina', telefone: '(86) 3222-1000', capacidade: 20 }) },
        responses: { 201: { description: 'Creche criada.', content: json(ref('Creche'), exemploCreche) }, 400: resp('Invalido'), 401: resp('NaoAutenticado'), 403: resp('Proibido'), 409: resp('Conflito') }
      })
    },
    '/admin/creches/{id}': {
      parameters: [param('Id')],
      get: base('Painel do administrador', 'Busca uma creche', {
        description: SO_ADMIN,
        responses: { 200: { description: 'A creche.', content: json(ref('Creche'), exemploCreche) }, 400: resp('Invalido'), 401: resp('NaoAutenticado'), 403: resp('Proibido'), 404: resp('NaoEncontrado') }
      }),
      put: base('Painel do administrador', 'Atualiza uma creche', {
        description: SO_ADMIN,
        requestBody: { required: true, content: json(ref('AtualizarCrecheRequisicao'), { capacidade: 25 }) },
        responses: { 200: { description: 'Creche atualizada.', content: json(ref('Creche'), exemploCreche) }, 400: resp('Invalido'), 401: resp('NaoAutenticado'), 403: resp('Proibido'), 404: resp('NaoEncontrado'), 409: resp('Conflito') }
      }),
      delete: base('Painel do administrador', 'Apaga uma creche', {
        description: SO_ADMIN + ' Não apaga creche com agendamentos (`409`). Os profissionais vinculados voltam para "em análise".',
        responses: { 204: { description: 'Creche apagada.' }, 400: resp('Invalido'), 401: resp('NaoAutenticado'), 403: resp('Proibido'), 404: resp('NaoEncontrado'), 409: resp('Conflito') }
      })
    },
    '/admin/profissionais': {
      get: base('Painel do administrador', 'Lista os profissionais (em análise ou ativos)', {
        description: SO_ADMIN,
        parameters: [{ name: 'status', in: 'query', description: 'Padrão: `todos`.', schema: { type: 'string', enum: ['pendente', 'ativo', 'todos'], default: 'todos' } }],
        responses: { 200: { description: 'Os profissionais, com o status e a creche (se vinculados).', content: json(lista('ProfissionalResumo')) }, 400: resp('Invalido'), 401: resp('NaoAutenticado'), 403: resp('Proibido') }
      })
    },
    '/admin/profissionais/{usuarioId}/vinculo': {
      parameters: [param('UsuarioId')],
      put: base('Painel do administrador', 'Vincula o profissional a uma creche (ou troca a creche)', {
        description: SO_ADMIN + ' Só aceita usuários do tipo profissional. A conta sai de "em análise" **na hora**, sem precisar de novo login.',
        requestBody: { required: true, content: json(ref('VincularRequisicao'), { crecheId: 1 }) },
        responses: { 200: { description: 'O vínculo atual.', content: json(ref('VinculoStatus')) }, 400: resp('Invalido'), 401: resp('NaoAutenticado'), 403: resp('Proibido'), 404: resp('NaoEncontrado') }
      }),
      delete: base('Painel do administrador', 'Remove o vínculo (a conta volta para "em análise")', {
        description: SO_ADMIN,
        responses: { 204: { description: 'Vínculo removido.' }, 400: resp('Invalido'), 401: resp('NaoAutenticado'), 403: resp('Proibido'), 404: resp('NaoEncontrado') }
      })
    }
  },

  components: {
    parameters: {
      VacinaId: { name: 'vacinaId', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } },
      UsuarioId: { name: 'usuarioId', in: 'path', required: true, description: 'Id do usuário (profissional).', schema: { type: 'integer', minimum: 1 } },
      DataConsulta: { name: 'data', in: 'query', description: 'Dia no formato AAAA-MM-DD. Padrão: hoje.', schema: { type: 'string', format: 'date' } }
    },

    responses: {
      ProibidoOuVinculoPendente: {
        description: 'Sem permissão (`ACESSO_NEGADO`) ou profissional ainda sem creche (`VINCULO_PENDENTE`: conta em análise).',
        content: json(ref('Erro'), { erro: { codigo: 'VINCULO_PENDENTE', mensagem: 'Sua conta está em análise: aguarde a administração vincular você a uma creche.' } })
      }
    },

    schemas: {
      StatusAgendamento: { type: 'string', enum: ['agendado', 'em_andamento', 'concluido', 'cancelado'] },
      Vagas: {
        type: 'object',
        required: ['capacidade', 'ocupadas', 'livres'],
        properties: { capacidade: { type: 'integer' }, ocupadas: { type: 'integer' }, livres: { type: 'integer' } }
      },
      PorStatus: {
        type: 'object',
        required: ['agendado', 'em_andamento', 'concluido', 'cancelado'],
        properties: { agendado: { type: 'integer' }, em_andamento: { type: 'integer' }, concluido: { type: 'integer' }, cancelado: { type: 'integer' } }
      },

      // ---------------- Creche e vínculo
      Creche: {
        type: 'object',
        required: ['id', 'nome', 'endereco', 'telefone', 'capacidade', 'criadoEm', 'atualizadoEm'],
        properties: {
          id: { type: 'integer' }, nome: { type: 'string' }, endereco: { type: 'string' }, telefone: { type: 'string', nullable: true },
          capacidade: { type: 'integer', description: 'Vagas por dia.' },
          criadoEm: { type: 'string', format: 'date-time' }, atualizadoEm: { type: 'string', format: 'date-time' }
        }
      },
      CriarCrecheRequisicao: {
        type: 'object', additionalProperties: false, required: ['nome', 'endereco', 'capacidade'],
        properties: {
          nome: { type: 'string', minLength: 3, maxLength: 80 }, endereco: { type: 'string', minLength: 5, maxLength: 200 },
          telefone: { type: 'string', description: 'DDD + número.' }, capacidade: { type: 'integer', minimum: 1, maximum: 500 }
        }
      },
      AtualizarCrecheRequisicao: {
        type: 'object', additionalProperties: false, minProperties: 1,
        properties: {
          nome: { type: 'string', minLength: 3, maxLength: 80 }, endereco: { type: 'string', minLength: 5, maxLength: 200 },
          telefone: { type: 'string', nullable: true }, capacidade: { type: 'integer', minimum: 1, maximum: 500 }
        }
      },
      CrecheComVagas: {
        type: 'object',
        required: ['id', 'nome', 'endereco', 'telefone', 'data', 'vagas'],
        properties: {
          id: { type: 'integer' }, nome: { type: 'string' }, endereco: { type: 'string' }, telefone: { type: 'string', nullable: true },
          data: { type: 'string', format: 'date' }, vagas: ref('Vagas')
        }
      },
      VincularRequisicao: { type: 'object', additionalProperties: false, required: ['crecheId'], properties: { crecheId: { type: 'integer', minimum: 1 } } },
      ProfissionalResumo: {
        type: 'object',
        required: ['id', 'nome', 'email', 'telefone', 'status', 'creche'],
        properties: {
          id: { type: 'integer' }, nome: { type: 'string' }, email: { type: 'string', nullable: true }, telefone: { type: 'string' },
          status: { type: 'string', enum: ['pendente', 'ativo'] },
          creche: { type: 'object', nullable: true, properties: { id: { type: 'integer' }, nome: { type: 'string' } } }
        }
      },
      VinculoStatus: {
        oneOf: [
          {
            type: 'object', additionalProperties: false, required: ['status', 'mensagem'],
            description: 'Conta em análise: a administração ainda não vinculou o profissional a uma creche.',
            properties: { status: { type: 'string', enum: ['pendente'] }, mensagem: { type: 'string' } }
          },
          {
            type: 'object', additionalProperties: false, required: ['status', 'creche'],
            description: 'Conta liberada.',
            properties: {
              status: { type: 'string', enum: ['ativo'] },
              creche: {
                type: 'object', required: ['id', 'nome', 'endereco', 'telefone'],
                properties: { id: { type: 'integer' }, nome: { type: 'string' }, endereco: { type: 'string' }, telefone: { type: 'string', nullable: true } }
              }
            }
          }
        ]
      },

      // ---------------- Pets e vacinas
      Vacina: {
        type: 'object', required: ['id', 'produto', 'dose', 'data'],
        properties: { id: { type: 'integer' }, produto: { type: 'string' }, dose: { type: 'string' }, data: { type: 'string', format: 'date' } }
      },
      Pet: {
        type: 'object', required: ['id', 'nome', 'raca', 'idade', 'castrado', 'vacinas', 'criadoEm', 'atualizadoEm'],
        properties: {
          id: { type: 'integer' }, nome: { type: 'string' }, raca: { type: 'string' }, idade: { type: 'integer', description: 'Em anos.' },
          castrado: { type: 'boolean' }, vacinas: lista('Vacina'),
          criadoEm: { type: 'string', format: 'date-time' }, atualizadoEm: { type: 'string', format: 'date-time' }
        }
      },
      CriarPetRequisicao: {
        type: 'object', additionalProperties: false, required: ['nome', 'raca', 'idade'],
        properties: {
          nome: { type: 'string', minLength: 2, maxLength: 60 }, raca: { type: 'string', minLength: 2, maxLength: 60 },
          idade: { type: 'integer', minimum: 0, maximum: 40 }, castrado: { type: 'boolean', default: false }
        }
      },
      AtualizarPetRequisicao: {
        type: 'object', additionalProperties: false, minProperties: 1,
        properties: {
          nome: { type: 'string', minLength: 2, maxLength: 60 }, raca: { type: 'string', minLength: 2, maxLength: 60 },
          idade: { type: 'integer', minimum: 0, maximum: 40 }, castrado: { type: 'boolean' }
        }
      },
      CriarVacinaRequisicao: {
        type: 'object', additionalProperties: false, required: ['produto', 'dose', 'data'],
        properties: {
          produto: { type: 'string', minLength: 2, maxLength: 80 }, dose: { type: 'string', minLength: 1, maxLength: 40 },
          data: { type: 'string', format: 'date', description: 'AAAA-MM-DD, não pode estar no futuro.' }
        }
      },

      // ---------------- Agendamentos e atividades
      Atividade: {
        type: 'object', required: ['id', 'descricao', 'registradaEm'],
        properties: { id: { type: 'integer' }, descricao: { type: 'string' }, registradaEm: { type: 'string', format: 'date-time' } }
      },
      CriarAtividadeRequisicao: {
        type: 'object', additionalProperties: false, required: ['descricao'],
        properties: { descricao: { type: 'string', minLength: 3, maxLength: 300 } }
      },
      MudarStatusRequisicao: {
        type: 'object', additionalProperties: false, required: ['status'],
        properties: { status: { type: 'string', enum: ['em_andamento', 'concluido'] } }
      },
      AgendarRequisicao: {
        type: 'object', additionalProperties: false, required: ['petId', 'crecheId', 'data', 'horaInicio', 'horaFim'],
        properties: {
          petId: { type: 'integer', minimum: 1 }, crecheId: { type: 'integer', minimum: 1 },
          data: { type: 'string', format: 'date', description: 'AAAA-MM-DD, de hoje em diante.' },
          horaInicio: { type: 'string', example: '08:00', description: 'HH:MM (24 horas).' },
          horaFim: { type: 'string', example: '17:00', description: 'HH:MM, depois do horário de entrada.' }
        }
      },
      AlterarAgendamentoRequisicao: {
        type: 'object', additionalProperties: false, minProperties: 1,
        properties: { data: { type: 'string', format: 'date' }, horaInicio: { type: 'string', example: '08:00' }, horaFim: { type: 'string', example: '17:00' } }
      },
      AgendamentoTutor: {
        type: 'object', required: ['id', 'data', 'horaInicio', 'horaFim', 'status', 'pet', 'creche'],
        properties: {
          id: { type: 'integer' }, data: { type: 'string', format: 'date' }, horaInicio: { type: 'string' }, horaFim: { type: 'string' },
          status: ref('StatusAgendamento'),
          pet: { type: 'object', properties: { id: { type: 'integer' }, nome: { type: 'string' }, raca: { type: 'string' }, castrado: { type: 'boolean' } } },
          creche: { type: 'object', properties: { id: { type: 'integer' }, nome: { type: 'string' } } },
          atividades: { ...lista('Atividade'), description: 'Só no detalhe do agendamento (e as 3 últimas no painel).' }
        }
      },
      AgendamentoAgenda: {
        type: 'object', required: ['id', 'data', 'horaInicio', 'horaFim', 'status', 'pet', 'tutor'],
        properties: {
          id: { type: 'integer' }, data: { type: 'string', format: 'date' }, horaInicio: { type: 'string' }, horaFim: { type: 'string' },
          status: ref('StatusAgendamento'),
          pet: { type: 'object', properties: { id: { type: 'integer' }, nome: { type: 'string' }, raca: { type: 'string' }, castrado: { type: 'boolean' } } },
          tutor: { type: 'object', properties: { id: { type: 'integer' }, nome: { type: 'string' }, telefone: { type: 'string' } } }
        }
      },
      AgendamentoDetalhe: {
        type: 'object', required: ['id', 'data', 'horaInicio', 'horaFim', 'status', 'pet', 'tutor', 'creche', 'atividades'],
        properties: {
          id: { type: 'integer' }, data: { type: 'string', format: 'date' }, horaInicio: { type: 'string' }, horaFim: { type: 'string' },
          status: ref('StatusAgendamento'),
          pet: {
            type: 'object', required: ['id', 'nome', 'raca', 'castrado', 'idade', 'vacinas'],
            properties: {
              id: { type: 'integer' }, nome: { type: 'string' }, raca: { type: 'string' }, castrado: { type: 'boolean' },
              idade: { type: 'integer' }, vacinas: lista('Vacina')
            }
          },
          tutor: { type: 'object', properties: { id: { type: 'integer' }, nome: { type: 'string' }, telefone: { type: 'string' } } },
          creche: { type: 'object', properties: { id: { type: 'integer' }, nome: { type: 'string' } } },
          atividades: lista('Atividade')
        }
      },
      AgendaProfissional: {
        type: 'object', required: ['data', 'creche', 'vagas', 'agendamentos'],
        properties: {
          data: { type: 'string', format: 'date' },
          creche: { type: 'object', properties: { id: { type: 'integer' }, nome: { type: 'string' } } },
          vagas: ref('Vagas'), agendamentos: lista('AgendamentoAgenda')
        }
      },

      // ---------------- Painéis (resumos)
      PainelTutor: {
        type: 'object', required: ['pets', 'proximosAgendamentos', 'emAndamento'],
        properties: { pets: { type: 'integer' }, proximosAgendamentos: lista('AgendamentoTutor'), emAndamento: lista('AgendamentoTutor') }
      },
      PainelProfissional: {
        type: 'object', required: ['creche', 'hoje', 'proximos', 'atividadesHoje'],
        properties: {
          creche: { type: 'object', properties: { id: { type: 'integer' }, nome: { type: 'string' } } },
          hoje: { type: 'object', required: ['data', 'porStatus', 'vagas'], properties: { data: { type: 'string', format: 'date' }, porStatus: ref('PorStatus'), vagas: ref('Vagas') } },
          proximos: lista('AgendamentoAgenda'), atividadesHoje: { type: 'integer' }
        }
      },
      PainelAdmin: {
        type: 'object', required: ['usuariosPorTipo', 'profissionaisPendentes', 'creches', 'agendamentosHoje', 'agendamentosPorStatus'],
        properties: {
          usuariosPorTipo: { type: 'array', items: { type: 'object', properties: { tipo: { type: 'string' }, total: { type: 'integer' } } } },
          profissionaisPendentes: { type: 'integer', description: 'Contas em análise, aguardando vínculo.' },
          creches: { type: 'integer' },
          agendamentosHoje: { type: 'object', properties: { data: { type: 'string', format: 'date' }, porStatus: ref('PorStatus') } },
          agendamentosPorStatus: ref('PorStatus')
        }
      }
    }
  }
};
