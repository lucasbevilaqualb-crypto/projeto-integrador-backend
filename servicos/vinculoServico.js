'use strict';
const vinculoRepositorio = require('../repositorios/vinculoRepositorio');
const usuarioRepositorio = require('../repositorios/usuarioRepositorio');
const crecheRepositorio = require('../repositorios/crecheRepositorio');
const { erros } = require('../erros');

async function exigirProfissional(usuarioId) {
  const usuario = await usuarioRepositorio.buscarPorId(usuarioId);
  if (!usuario) throw erros.naoEncontrado('Usuário não encontrado.');
  if (usuario.tipoUsuario.nome.toLowerCase() !== 'profissional') {
    throw erros.requisicaoInvalida('Só profissionais podem ser vinculados a uma creche.');
  }
  return usuario;
}

function listarProfissionais(consulta) {
  return vinculoRepositorio.listarProfissionais(consulta);
}

// A administração vincula (ou troca a creche de) um profissional.
async function vincular(usuarioId, crecheId) {
  await exigirProfissional(usuarioId);
  if (!(await crecheRepositorio.buscarPorId(crecheId))) throw erros.naoEncontrado('Creche não encontrada.');
  await vinculoRepositorio.definir(usuarioId, crecheId);
  return consultar(usuarioId);
}

async function desvincular(usuarioId) {
  await exigirProfissional(usuarioId);
  await vinculoRepositorio.remover(usuarioId); // a conta volta para "em análise"
}

// Usado pela tela "conta em análise" (botão "Verificar liberação").
async function consultar(usuarioId) {
  const vinculo = await vinculoRepositorio.buscarPorUsuario(usuarioId);
  if (!vinculo) {
    return { status: 'pendente', mensagem: 'A administração ainda está associando você a uma creche. Aguarde a liberação.' };
  }
  const { id, nome, endereco, telefone } = vinculo.creche;
  return { status: 'ativo', creche: { id, nome, endereco, telefone } };
}

module.exports = { listarProfissionais, vincular, desvincular, consultar };
