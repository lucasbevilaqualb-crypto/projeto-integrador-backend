'use strict';
const { prisma } = require('../prisma/cliente');

// Tabela "login": e-mail + hash da senha. É aqui que a rota POST /login confere.

function paraObjeto(login) {
  if (!login) return null;
  return {
    id: login.id,
    usuarioId: login.usuarioId,
    email: login.email,
    senhaHash: login.senhaHash,
    tentativasFalhas: login.tentativasFalhas,
    bloqueadoAte: login.bloqueadoAte
  };
}

function criar({ usuarioId, email, senhaHash }, db = prisma) {
  return db.login.create({ data: { usuarioId, email, senhaHash } });
}

// Único ponto do sistema que devolve o hash da senha. O e-mail é guardado em minúsculas.
async function buscarPorEmail(email, db = prisma) {
  return paraObjeto(await db.login.findUnique({ where: { email: email.toLowerCase() } }));
}

async function buscarPorUsuarioId(usuarioId, db = prisma) {
  return paraObjeto(await db.login.findUnique({ where: { usuarioId } }));
}

function atualizarEmail(usuarioId, email, db = prisma) {
  return db.login.update({ where: { usuarioId }, data: { email } });
}

function atualizarSenha(usuarioId, senhaHash, db = prisma) {
  return db.login.update({ where: { usuarioId }, data: { senhaHash, tentativasFalhas: 0, bloqueadoAte: null } });
}

function registrarFalha(usuarioId, tentativasFalhas, bloqueadoAte, db = prisma) {
  return db.login.update({ where: { usuarioId }, data: { tentativasFalhas, bloqueadoAte } });
}

function registrarSucesso(usuarioId, db = prisma) {
  return db.login.update({
    where: { usuarioId },
    data: { tentativasFalhas: 0, bloqueadoAte: null, ultimoLoginEm: new Date() }
  });
}

module.exports = {
  criar,
  buscarPorEmail,
  buscarPorUsuarioId,
  atualizarEmail,
  atualizarSenha,
  registrarFalha,
  registrarSucesso
};
