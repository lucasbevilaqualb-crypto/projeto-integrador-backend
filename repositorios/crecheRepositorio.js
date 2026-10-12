'use strict';
const { prisma } = require('../prisma/cliente');
const { paraBanco } = require('../datas');

function listar(db = prisma) {
  return db.creche.findMany({ orderBy: { nome: 'asc' } });
}

function buscarPorId(id, db = prisma) {
  return db.creche.findUnique({ where: { id } });
}

function buscarPorNome(nome, db = prisma) {
  return db.creche.findFirst({ where: { nome: { equals: nome, mode: 'insensitive' } } });
}

function criar({ nome, endereco, telefone, capacidade }, db = prisma) {
  return db.creche.create({ data: { nome, endereco, telefone: telefone ?? null, capacidade } });
}

function atualizar(id, dados, db = prisma) {
  const data = {};
  for (const campo of ['nome', 'endereco', 'telefone', 'capacidade']) {
    if (dados[campo] !== undefined) data[campo] = dados[campo];
  }
  return db.creche.update({ where: { id }, data });
}

async function remover(id, db = prisma) {
  return (await db.creche.deleteMany({ where: { id } })).count > 0;
}

function contar(db = prisma) {
  return db.creche.count();
}

function contarAgendamentos(id, db = prisma) {
  return db.agendamento.count({ where: { crecheId: id } });
}

// ---------------------------- Vagas ----------------------------
// Uma vaga é ocupada por qualquer agendamento que NÃO foi cancelado.
function contarOcupadas(crecheId, data, exceto, db = prisma) {
  return db.agendamento.count({
    where: { crecheId, data: paraBanco(data), status: { not: 'cancelado' }, ...(exceto ? { id: { not: exceto } } : {}) }
  });
}

// Quantas vagas cada creche já ocupou numa data: { [crecheId]: total }
async function contarOcupadasPorCreche(data, db = prisma) {
  const grupos = await db.agendamento.groupBy({
    by: ['crecheId'],
    where: { data: paraBanco(data), status: { not: 'cancelado' } },
    _count: { _all: true }
  });
  return Object.fromEntries(grupos.map((g) => [g.crecheId, g._count._all]));
}

// "Trava" a creche até o fim da transação: um UPDATE bloqueia a linha, então dois agendamentos
// simultâneos esperam um pelo outro e a última vaga nunca é vendida duas vezes.
function travar(id, tx) {
  return tx.creche.update({ where: { id }, data: { atualizadoEm: new Date() } });
}

module.exports = { listar, buscarPorId, buscarPorNome, criar, atualizar, remover, contar, contarAgendamentos, contarOcupadas, contarOcupadasPorCreche, travar };
