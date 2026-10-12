'use strict';
const { prisma } = require('../prisma/cliente');

// Repositório = ÚNICA camada que conversa com o banco (via Prisma).
// O Prisma monta consultas parametrizadas: nada é concatenado, então não há SQL Injection.
// O último parâmetro "db" permite rodar a mesma função DENTRO de uma transação (tx).

function listar(db = prisma) {
  return db.tipoUsuario.findMany({ orderBy: { id: 'asc' } });
}

function listarPublicos(db = prisma) {
  return db.tipoUsuario.findMany({ where: { cadastroPublico: true }, orderBy: { id: 'asc' } });
}

function buscarPorId(id, db = prisma) {
  return db.tipoUsuario.findUnique({ where: { id } });
}

// Sem diferenciar maiúsculas de minúsculas: "Veterinario" e "veterinario" são o mesmo tipo.
function buscarPorNome(nome, db = prisma) {
  return db.tipoUsuario.findFirst({ where: { nome: { equals: nome, mode: 'insensitive' } } });
}

function criar({ nome, descricao, cadastroPublico }, db = prisma) {
  return db.tipoUsuario.create({
    data: { nome, descricao: descricao ?? null, cadastroPublico: Boolean(cadastroPublico) }
  });
}

function atualizar(id, { nome, descricao, cadastroPublico }, db = prisma) {
  const data = {};
  if (nome !== undefined) data.nome = nome;
  if (descricao !== undefined) data.descricao = descricao;
  if (cadastroPublico !== undefined) data.cadastroPublico = cadastroPublico;
  return db.tipoUsuario.update({ where: { id }, data });
}

async function remover(id, db = prisma) {
  const resultado = await db.tipoUsuario.deleteMany({ where: { id } });
  return resultado.count > 0;
}

function contarUsuarios(id, db = prisma) {
  return db.usuario.count({ where: { tipoUsuarioId: id } });
}

async function contarUsuariosPorTipo(db = prisma) {
  const tipos = await db.tipoUsuario.findMany({ select: { nome: true, _count: { select: { usuarios: true } } }, orderBy: { id: 'asc' } });
  return tipos.map((t) => ({ tipo: t.nome, total: t._count.usuarios }));
}

module.exports = {
  contarUsuariosPorTipo,
  listar,
  listarPublicos,
  buscarPorId,
  buscarPorNome,
  criar,
  atualizar,
  remover,
  contarUsuarios
};
