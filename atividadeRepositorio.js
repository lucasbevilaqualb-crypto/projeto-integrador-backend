'use strict';
const { prisma } = require('../prisma/cliente');
const { paraBanco } = require('../datas');

const paraAtividade = (a) => ({ id: a.id, descricao: a.descricao, registradaEm: a.registradaEm });

async function criar({ agendamentoId, profissionalId, descricao }, db = prisma) {
  return paraAtividade(await db.atividade.create({ data: { agendamentoId, profissionalId, descricao } }));
}

// "depois": devolve só o que foi registrado depois deste horário (o front consulta de tempos em tempos).
async function listarDoAgendamento(agendamentoId, depois, db = prisma) {
  const lista = await db.atividade.findMany({
    where: { agendamentoId, ...(depois ? { registradaEm: { gt: new Date(depois) } } : {}) },
    orderBy: { registradaEm: 'asc' }
  });
  return lista.map(paraAtividade);
}

// Atividades registradas nos agendamentos de uma creche numa data
function contarDaCrecheNaData(crecheId, data, db = prisma) {
  return db.atividade.count({ where: { agendamento: { crecheId, data: paraBanco(data) } } });
}

module.exports = { criar, listarDoAgendamento, contarDaCrecheNaData };
