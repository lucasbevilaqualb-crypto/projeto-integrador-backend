'use strict';
const { prisma } = require('../prisma/cliente');

// Vínculo = a ligação do profissional com a creche. Sem vínculo, a conta está "em análise".

function buscarPorUsuario(usuarioId, db = prisma) {
  return db.vinculoProfissional.findUnique({ where: { usuarioId }, include: { creche: true } });
}

// Cria o vínculo ou troca a creche (cada profissional tem UMA creche).
function definir(usuarioId, crecheId, db = prisma) {
  return db.vinculoProfissional.upsert({
    where: { usuarioId },
    create: { usuarioId, crecheId },
    update: { crecheId }
  });
}

async function remover(usuarioId, db = prisma) {
  return (await db.vinculoProfissional.deleteMany({ where: { usuarioId } })).count > 0;
}

const EH_PROFISSIONAL = { tipoUsuario: { nome: { equals: 'profissional', mode: 'insensitive' } } };

async function listarProfissionais({ status }, db = prisma) {
  const filtro = status === 'pendente' ? { vinculo: { is: null } } : status === 'ativo' ? { vinculo: { isNot: null } } : {};
  const usuarios = await db.usuario.findMany({
    where: { ...EH_PROFISSIONAL, ...filtro },
    include: { login: { select: { email: true } }, vinculo: { include: { creche: { select: { id: true, nome: true } } } } },
    orderBy: { id: 'asc' }
  });
  return usuarios.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.login ? u.login.email : null,
    telefone: u.telefone,
    status: u.vinculo ? 'ativo' : 'pendente',
    creche: u.vinculo ? u.vinculo.creche : null
  }));
}

function contarPendentes(db = prisma) {
  return db.usuario.count({ where: { ...EH_PROFISSIONAL, vinculo: { is: null } } });
}

module.exports = { buscarPorUsuario, definir, remover, listarProfissionais, contarPendentes };
