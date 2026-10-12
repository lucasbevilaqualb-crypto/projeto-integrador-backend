'use strict';
const { prisma } = require('../prisma/cliente');

// A consulta traz o tipo e o e-mail (da tabela login), mas NUNCA o senhaHash:
// o hash só existe no loginRepositorio, usado exclusivamente pelo serviço de autenticação.
const INCLUIR = {
  tipoUsuario: { select: { id: true, nome: true } },
  login: { select: { email: true } }
};

function paraObjeto(usuario) {
  if (!usuario) return null;
  return {
    id: usuario.id,
    nome: usuario.nome,
    cpf: usuario.cpf,
    telefone: usuario.telefone,
    endereco: usuario.endereco,
    email: usuario.login ? usuario.login.email : null,
    tipoUsuario: { id: usuario.tipoUsuario.id, nome: usuario.tipoUsuario.nome },
    criadoEm: usuario.criadoEm,
    atualizadoEm: usuario.atualizadoEm
  };
}

async function criar({ tipoUsuarioId, nome, cpf, telefone, endereco }, db = prisma) {
  const usuario = await db.usuario.create({
    data: { tipoUsuarioId, nome, cpf, telefone, endereco: endereco ?? null },
    select: { id: true }
  });
  return usuario.id;
}

async function buscarPorId(id, db = prisma) {
  return paraObjeto(await db.usuario.findUnique({ where: { id }, include: INCLUIR }));
}

async function buscarPorCpf(cpf, db = prisma) {
  return paraObjeto(await db.usuario.findUnique({ where: { cpf }, include: INCLUIR }));
}

async function listar({ limite, deslocamento, tipoUsuarioId }, db = prisma) {
  const usuarios = await db.usuario.findMany({
    where: tipoUsuarioId ? { tipoUsuarioId } : undefined,
    include: INCLUIR,
    orderBy: { id: 'asc' },
    skip: deslocamento,
    take: limite
  });
  return usuarios.map(paraObjeto);
}

function contar({ tipoUsuarioId } = {}, db = prisma) {
  return db.usuario.count({ where: tipoUsuarioId ? { tipoUsuarioId } : undefined });
}

function contarPorNomeDoTipo(nomeTipo, db = prisma) {
  return db.usuario.count({ where: { tipoUsuario: { nome: { equals: nomeTipo, mode: 'insensitive' } } } });
}

// Lista branca de campos atualizáveis: o cliente nunca decide QUAIS colunas mudam.
const CAMPOS_ATUALIZAVEIS = ['nome', 'telefone', 'endereco', 'tipoUsuarioId'];

function atualizar(id, dados, db = prisma) {
  const data = {};
  for (const campo of CAMPOS_ATUALIZAVEIS) {
    if (dados[campo] !== undefined) data[campo] = dados[campo];
  }
  if (Object.keys(data).length === 0) data.atualizadoEm = new Date(); // só o e-mail mudou
  return db.usuario.update({ where: { id }, data });
}

async function remover(id, db = prisma) {
  // onDelete: Cascade no schema apaga também a linha correspondente em "login".
  const resultado = await db.usuario.deleteMany({ where: { id } });
  return resultado.count > 0;
}

module.exports = { criar, buscarPorId, buscarPorCpf, listar, contar, contarPorNomeDoTipo, atualizar, remover };
