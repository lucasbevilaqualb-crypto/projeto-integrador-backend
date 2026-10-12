'use strict';
const { prisma } = require('../prisma/cliente');
const { paraBanco, doBanco } = require('../datas');

const ABERTOS = ['agendado', 'em_andamento'];
const ORDEM = [{ data: 'asc' }, { horaInicio: 'asc' }, { id: 'asc' }];

const paraAtividade = (a) => ({ id: a.id, descricao: a.descricao, registradaEm: a.registradaEm });

// Formato curto: usado nas listas
function resumo(a) {
  return {
    id: a.id,
    data: doBanco(a.data),
    horaInicio: a.horaInicio,
    horaFim: a.horaFim,
    status: a.status,
    pet: a.pet ? { id: a.pet.id, nome: a.pet.nome, raca: a.pet.raca, castrado: a.pet.castrado } : undefined,
    tutor: a.pet && a.pet.tutor ? { id: a.pet.tutor.id, nome: a.pet.tutor.nome, telefone: a.pet.tutor.telefone } : undefined,
    creche: a.creche ? { id: a.creche.id, nome: a.creche.nome } : undefined,
    atividades: a.atividades ? a.atividades.map(paraAtividade) : undefined
  };
}

const PET_BASICO = { select: { id: true, nome: true, raca: true, castrado: true } };
const PET_COM_TUTOR = { select: { id: true, nome: true, raca: true, castrado: true, tutor: { select: { id: true, nome: true, telefone: true } } } };
const CRECHE_BASICA = { select: { id: true, nome: true } };

// Exclui o agendamento "exceto" da conta (usado ao alterar a data/hora do próprio agendamento).
const exceto = (id) => (id ? { id: { not: id } } : {});

function criar({ petId, crecheId, data, horaInicio, horaFim }, db = prisma) {
  return db.agendamento.create({ data: { petId, crecheId, data: paraBanco(data), horaInicio, horaFim }, select: { id: true } }).then((a) => a.id);
}

async function atualizar(id, dados, db = prisma) {
  const data = {};
  if (dados.data !== undefined) data.data = paraBanco(dados.data);
  for (const campo of ['horaInicio', 'horaFim', 'status']) if (dados[campo] !== undefined) data[campo] = dados[campo];
  await db.agendamento.update({ where: { id }, data });
}

// ---------------------------- Visão do TUTOR ----------------------------
// Sempre filtra pelo dono do pet: agendamento de outro tutor "não existe".
async function buscarDoTutor(tutorId, id, db = prisma) {
  const a = await db.agendamento.findFirst({
    where: { id, pet: { tutorId } },
    include: { pet: PET_BASICO, creche: CRECHE_BASICA, atividades: { orderBy: { registradaEm: 'asc' } } }
  });
  return a ? resumo(a) : null;
}

async function listarDoTutor(tutorId, { status }, db = prisma) {
  const lista = await db.agendamento.findMany({
    where: { pet: { tutorId }, ...(status ? { status } : {}) },
    include: { pet: PET_BASICO, creche: CRECHE_BASICA },
    orderBy: [{ data: 'desc' }, { horaInicio: 'asc' }]
  });
  return lista.map(resumo);
}

async function proximosDoTutor(tutorId, hoje, limite, db = prisma) {
  const lista = await db.agendamento.findMany({
    where: { pet: { tutorId }, status: { in: ABERTOS }, data: { gte: paraBanco(hoje) } },
    include: { pet: PET_BASICO, creche: CRECHE_BASICA },
    orderBy: ORDEM,
    take: limite
  });
  return lista.map(resumo);
}

// Atendimentos acontecendo agora, com as 3 últimas atividades de cada um
async function emAndamentoDoTutor(tutorId, db = prisma) {
  const lista = await db.agendamento.findMany({
    where: { pet: { tutorId }, status: 'em_andamento' },
    include: { pet: PET_BASICO, creche: CRECHE_BASICA, atividades: { orderBy: { registradaEm: 'desc' }, take: 3 } },
    orderBy: ORDEM
  });
  return lista.map(resumo);
}

// ---------------------------- Visão da CRECHE (profissional) ----------------------------
// Sempre filtra pela creche do profissional: agendamento de outra creche "não existe".
async function buscarDaCreche(crecheId, id, db = prisma) {
  const a = await db.agendamento.findFirst({
    where: { id, crecheId },
    include: {
      pet: { include: { tutor: { select: { id: true, nome: true, telefone: true } }, vacinas: { orderBy: [{ data: 'desc' }, { id: 'desc' }] } } },
      creche: CRECHE_BASICA,
      atividades: { orderBy: { registradaEm: 'asc' } }
    }
  });
  if (!a) return null;
  const base = resumo(a);
  base.pet = {
    ...base.pet,
    idade: a.pet.idade,
    vacinas: a.pet.vacinas.map((v) => ({ id: v.id, produto: v.produto, dose: v.dose, data: doBanco(v.data) }))
  };
  return base;
}

async function listarDaCreche(crecheId, data, db = prisma) {
  const lista = await db.agendamento.findMany({
    where: { crecheId, data: paraBanco(data) },
    include: { pet: PET_COM_TUTOR },
    orderBy: [{ horaInicio: 'asc' }, { id: 'asc' }]
  });
  return lista.map(resumo);
}

async function proximosDaCreche(crecheId, hoje, limite, db = prisma) {
  const lista = await db.agendamento.findMany({
    where: { crecheId, status: { in: ABERTOS }, data: { gte: paraBanco(hoje) } },
    include: { pet: PET_COM_TUTOR },
    orderBy: ORDEM,
    take: limite
  });
  return lista.map(resumo);
}

// ---------------------------- Regras e números ----------------------------
function contarDoPetNaData(petId, data, excetoId, db = prisma) {
  return db.agendamento.count({ where: { petId, data: paraBanco(data), status: { not: 'cancelado' }, ...exceto(excetoId) } });
}

// { agendado: 2, em_andamento: 1, concluido: 0, cancelado: 0 }
async function contarPorStatus(filtro, db = prisma) {
  const where = {};
  if (filtro.crecheId) where.crecheId = filtro.crecheId;
  if (filtro.data) where.data = paraBanco(filtro.data);
  const grupos = await db.agendamento.groupBy({ by: ['status'], where, _count: { _all: true } });
  const contagem = { agendado: 0, em_andamento: 0, concluido: 0, cancelado: 0 };
  for (const g of grupos) contagem[g.status] = g._count._all;
  return contagem;
}

module.exports = {
  criar, atualizar, buscarDoTutor, listarDoTutor, proximosDoTutor, emAndamentoDoTutor,
  buscarDaCreche, listarDaCreche, proximosDaCreche, contarDoPetNaData, contarPorStatus
};
