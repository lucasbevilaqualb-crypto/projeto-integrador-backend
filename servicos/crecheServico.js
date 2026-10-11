'use strict';
const crecheRepositorio = require('../repositorios/crecheRepositorio');
const { erros } = require('../erros');
const { hoje } = require('../datas');

const DUPLICADA = 'Já existe uma creche com esse nome.';

function listar() {
  return crecheRepositorio.listar();
}

async function buscar(id) {
  const creche = await crecheRepositorio.buscarPorId(id);
  if (!creche) throw erros.naoEncontrado('Creche não encontrada.');
  return creche;
}

async function criar(dados) {
  if (await crecheRepositorio.buscarPorNome(dados.nome)) throw erros.conflito(DUPLICADA);
  try {
    return await crecheRepositorio.criar(dados);
  } catch (erro) {
    throw erro.code === 'P2002' ? erros.conflito(DUPLICADA) : erro;
  }
}

async function atualizar(id, dados) {
  await buscar(id);
  if (dados.nome !== undefined) {
    const existente = await crecheRepositorio.buscarPorNome(dados.nome);
    if (existente && existente.id !== id) throw erros.conflito(DUPLICADA);
  }
  return crecheRepositorio.atualizar(id, dados);
}

async function remover(id) {
  await buscar(id);
  if ((await crecheRepositorio.contarAgendamentos(id)) > 0) {
    throw erros.conflito('Esta creche tem agendamentos e não pode ser apagada.');
  }
  await crecheRepositorio.remover(id); // os vínculos dos profissionais vão junto: eles voltam a "em análise"
}

// Para o tutor escolher onde agendar: cada creche com as vagas livres NA DATA.
async function listarComVagas(data = hoje()) {
  const [creches, ocupadasPorCreche] = await Promise.all([crecheRepositorio.listar(), crecheRepositorio.contarOcupadasPorCreche(data)]);
  return creches.map((c) => {
    const ocupadas = ocupadasPorCreche[c.id] || 0;
    return {
      id: c.id,
      nome: c.nome,
      endereco: c.endereco,
      telefone: c.telefone,
      data,
      vagas: { capacidade: c.capacidade, ocupadas, livres: Math.max(0, c.capacidade - ocupadas) }
    };
  });
}

module.exports = { listar, buscar, criar, atualizar, remover, listarComVagas };
