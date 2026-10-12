'use strict';
const { prisma } = require('../prisma/cliente');

// Sessão = um "login aberto" (um navegador ou aparelho). É aqui que fica o controle para o logout de verdade.

function criar({ usuarioId, refreshHash, expiraEm }, db = prisma) {
  return db.sessao.create({ data: { usuarioId, refreshHash, expiraEm } });
}

// Procura pelo token de renovação, tanto o ATUAL quanto o ANTERIOR (o anterior serve para detectar reutilização).
function buscarPorRefresh(hash, db = prisma) {
  return db.sessao.findFirst({ where: { OR: [{ refreshHash: hash }, { refreshAnteriorHash: hash }] } });
}

// Sessão válida = não foi revogada e ainda não expirou.
function buscarAtiva(id, db = prisma) {
  return db.sessao.findFirst({ where: { id, revogadaEm: null, expiraEm: { gt: new Date() } } });
}

// Troca o token de renovação por um novo. Só troca se o token atual ainda for o que foi apresentado
// (evita que dois pedidos simultâneos usem o mesmo token).
async function rotacionar(id, hashAtual, { novoHash, expiraEm }, db = prisma) {
  const resultado = await db.sessao.updateMany({
    where: { id, refreshHash: hashAtual, revogadaEm: null },
    data: { refreshHash: novoHash, refreshAnteriorHash: hashAtual, expiraEm }
  });
  return resultado.count > 0;
}

function revogar(id, db = prisma) {
  return db.sessao.updateMany({ where: { id, revogadaEm: null }, data: { revogadaEm: new Date() } });
}

// Usada ao trocar a senha: encerra as sessões do usuário, menos a atual (se informada).
function revogarOutrasDoUsuario(usuarioId, sessaoAtualId, db = prisma) {
  const where = { usuarioId, revogadaEm: null };
  if (sessaoAtualId) where.NOT = { id: sessaoAtualId };
  return db.sessao.updateMany({ where, data: { revogadaEm: new Date() } });
}

module.exports = { criar, buscarPorRefresh, buscarAtiva, rotacionar, revogar, revogarOutrasDoUsuario };
