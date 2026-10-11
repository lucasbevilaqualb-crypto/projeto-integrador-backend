'use strict';
const tipoRepositorio = require('../repositorios/tipoUsuarioRepositorio');
const { erros } = require('../erros');

const ADMINISTRADOR = 'administrador';
// Tipos que o sistema cria no início (prisma/seed.js) e que não podem ser renomeados nem apagados.
const TIPOS_BASE = ['tutor', 'profissional', 'administrador'];

function ehBase(tipo) {
  return TIPOS_BASE.includes(tipo.nome.toLowerCase());
}

// Traduz os códigos de erro do Prisma para respostas amigáveis.
function traduzirErroDeBanco(erro) {
  if (erro && erro.code === 'P2002') return erros.conflito('Já existe um tipo de usuário com esse nome.');
  if (erro && erro.code === 'P2003') return erros.conflito('Existem usuários vinculados a este tipo.');
  return erro;
}

function listar() {
  return tipoRepositorio.listar();
}

// Rota pública: alimenta a tela "Criar Conta" (Dono de Pet / Profissional Acolhedor).
async function listarPublicos() {
  const tipos = await tipoRepositorio.listarPublicos();
  return tipos.map(({ id, nome, descricao }) => ({ id, nome, descricao }));
}

async function buscarPorId(id) {
  const tipo = await tipoRepositorio.buscarPorId(id);
  if (!tipo) throw erros.naoEncontrado('Tipo de usuário não encontrado.');
  return tipo;
}

async function criar(dados) {
  if (dados.nome.toLowerCase() === ADMINISTRADOR && dados.cadastroPublico) {
    throw erros.acessoNegado('O tipo administrador não pode ter cadastro público.');
  }
  // O banco compara nomes exatos; aqui garantimos a unicidade sem diferenciar maiúsculas.
  if (await tipoRepositorio.buscarPorNome(dados.nome)) {
    throw erros.conflito('Já existe um tipo de usuário com esse nome.');
  }
  try {
    return await tipoRepositorio.criar(dados);
  } catch (erro) {
    throw traduzirErroDeBanco(erro);
  }
}

async function atualizar(id, dados) {
  const atual = await buscarPorId(id);

  // Regras de proteção dos tipos base (o sistema depende deles).
  if (ehBase(atual) && dados.nome !== undefined && dados.nome.toLowerCase() !== atual.nome.toLowerCase()) {
    throw erros.acessoNegado('Tipos de usuário base não podem ser renomeados.');
  }
  if (atual.nome.toLowerCase() === ADMINISTRADOR && dados.cadastroPublico === true) {
    throw erros.acessoNegado('O tipo administrador não pode ter cadastro público.');
  }
  if (dados.nome !== undefined && dados.nome.toLowerCase() === ADMINISTRADOR
      && atual.nome.toLowerCase() !== ADMINISTRADOR) {
    throw erros.acessoNegado('O nome "administrador" é reservado.');
  }
  if (dados.nome !== undefined) {
    const existente = await tipoRepositorio.buscarPorNome(dados.nome);
    if (existente && existente.id !== id) throw erros.conflito('Já existe um tipo de usuário com esse nome.');
  }

  try {
    return await tipoRepositorio.atualizar(id, dados);
  } catch (erro) {
    throw traduzirErroDeBanco(erro);
  }
}

async function remover(id) {
  const atual = await buscarPorId(id);
  if (ehBase(atual)) throw erros.acessoNegado('Tipos de usuário base não podem ser removidos.');
  if ((await tipoRepositorio.contarUsuarios(id)) > 0) {
    throw erros.conflito('Existem usuários vinculados a este tipo.');
  }
  try {
    await tipoRepositorio.remover(id);
  } catch (erro) {
    throw traduzirErroDeBanco(erro);
  }
}

module.exports = { listar, listarPublicos, buscarPorId, criar, atualizar, remover };
