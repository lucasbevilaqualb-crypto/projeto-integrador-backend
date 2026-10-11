'use strict';
const bcrypt = require('bcryptjs');
const { prisma } = require('../prisma/cliente');
const usuarioRepositorio = require('../repositorios/usuarioRepositorio');
const loginRepositorio = require('../repositorios/loginRepositorio');
const tipoRepositorio = require('../repositorios/tipoUsuarioRepositorio');
const sessaoRepositorio = require('../repositorios/sessaoRepositorio');
const { erros } = require('../erros');

const ADMINISTRADOR = 'administrador';
const CUSTO_BCRYPT = Number(process.env.BCRYPT_CUSTO) || 12;
const MENSAGEM_DUPLICADO = 'E-mail ou CPF já cadastrado no sistema';

const ehAdministrador = (solicitante) => solicitante.tipo === ADMINISTRADOR;

function traduzirErroDeBanco(erro) {
  // Segunda linha de defesa: se dois cadastros iguais chegarem ao mesmo tempo,
  // a restrição UNIQUE do banco (erro P2002 do Prisma) barra o segundo.
  if (erro && erro.code === 'P2002') return erros.conflito(MENSAGEM_DUPLICADO);
  return erro;
}

// Regra de acesso: administrador acessa qualquer usuário; os demais, só o próprio.
function exigirAcesso(solicitante, idAlvo) {
  if (!ehAdministrador(solicitante) && solicitante.id !== idAlvo) {
    throw erros.acessoNegado();
  }
}

async function garantirQueNaoRemoveUltimoAdmin(usuarioAtual, novoTipoNome) {
  const eraAdmin = usuarioAtual.tipoUsuario.nome.toLowerCase() === ADMINISTRADOR;
  const continuaAdmin = novoTipoNome !== null && novoTipoNome.toLowerCase() === ADMINISTRADOR;
  if (eraAdmin && !continuaAdmin && (await usuarioRepositorio.contarPorNomeDoTipo(ADMINISTRADOR)) <= 1) {
    throw erros.conflito('Não é possível remover o último administrador do sistema.');
  }
}

// ---------------------------------------------------------------
// CADASTRO: cria o usuário E o login (e-mail + senha criptografada)
// dentro de UMA transação: ou grava os dois, ou não grava nada.
// ---------------------------------------------------------------
async function registrar(dados) {
  if ((await usuarioRepositorio.buscarPorCpf(dados.cpf)) || (await loginRepositorio.buscarPorEmail(dados.email))) {
    throw erros.conflito(MENSAGEM_DUPLICADO);
  }

  const senhaHash = await bcrypt.hash(dados.senha, CUSTO_BCRYPT); // a senha em texto some aqui

  try {
    const novoId = await prisma.$transaction(async (tx) => {
      const usuarioId = await usuarioRepositorio.criar({
        tipoUsuarioId: dados.tipoUsuarioId,
        nome: dados.nome,
        cpf: dados.cpf,
        telefone: dados.telefone,
        endereco: dados.endereco
      }, tx);
      await loginRepositorio.criar({ usuarioId, email: dados.email, senhaHash }, tx);
      return usuarioId;
    });
    return await usuarioRepositorio.buscarPorId(novoId);
  } catch (erro) {
    throw traduzirErroDeBanco(erro);
  }
}

// Cadastro aberto ao público (tela "Criar Conta"): só tipos com cadastroPublico = true.
async function cadastrarPublico(dados) {
  const tipo = await tipoRepositorio.buscarPorId(dados.tipoUsuarioId);
  if (!tipo) throw erros.requisicaoInvalida('Tipo de usuário inexistente.');
  if (!tipo.cadastroPublico) {
    throw erros.acessoNegado('Este tipo de usuário não permite cadastro público.');
  }
  return registrar(dados);
}

// Cadastro feito por um administrador: qualquer tipo existente.
async function criarComoAdministrador(dados) {
  const tipo = await tipoRepositorio.buscarPorId(dados.tipoUsuarioId);
  if (!tipo) throw erros.requisicaoInvalida('Tipo de usuário inexistente.');
  return registrar(dados);
}

// ---------------------------- Leitura ----------------------------
async function listar({ pagina, limite, tipoUsuarioId }) {
  const total = await usuarioRepositorio.contar({ tipoUsuarioId });
  const dados = await usuarioRepositorio.listar({ limite, deslocamento: (pagina - 1) * limite, tipoUsuarioId });
  return { dados, paginacao: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) } };
}

async function buscarPorId(solicitante, id) {
  exigirAcesso(solicitante, id); // checa permissão ANTES de revelar se o id existe
  const usuario = await usuarioRepositorio.buscarPorId(id);
  if (!usuario) throw erros.naoEncontrado('Usuário não encontrado.');
  return usuario;
}

function obterPerfil(solicitante) {
  return usuarioRepositorio.buscarPorId(solicitante.id);
}

// --------------------------- Atualização --------------------------
async function atualizar(solicitante, id, dados) {
  exigirAcesso(solicitante, id);
  const atual = await usuarioRepositorio.buscarPorId(id);
  if (!atual) throw erros.naoEncontrado('Usuário não encontrado.');

  if (dados.tipoUsuarioId !== undefined) {
    // Impede escalonamento de privilégio: só administrador muda o tipo.
    if (!ehAdministrador(solicitante)) {
      throw erros.acessoNegado('Somente administradores podem alterar o tipo de usuário.');
    }
    const novoTipo = await tipoRepositorio.buscarPorId(dados.tipoUsuarioId);
    if (!novoTipo) throw erros.requisicaoInvalida('Tipo de usuário inexistente.');
    await garantirQueNaoRemoveUltimoAdmin(atual, novoTipo.nome);
  }

  if (dados.email !== undefined && dados.email !== atual.email) {
    const existente = await loginRepositorio.buscarPorEmail(dados.email);
    if (existente && existente.usuarioId !== id) throw erros.conflito(MENSAGEM_DUPLICADO);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await usuarioRepositorio.atualizar(id, dados, tx);
      if (dados.email !== undefined) await loginRepositorio.atualizarEmail(id, dados.email, tx);
    });
  } catch (erro) {
    throw traduzirErroDeBanco(erro);
  }
  return usuarioRepositorio.buscarPorId(id);
}

async function alterarSenha(solicitante, id, { senhaAtual, novaSenha }) {
  // Nem o administrador troca a senha de outra pessoa por esta rota.
  if (solicitante.id !== id) throw erros.acessoNegado();

  const login = await loginRepositorio.buscarPorUsuarioId(id);
  if (!login) throw erros.naoEncontrado('Usuário não encontrado.');

  if (!(await bcrypt.compare(senhaAtual, login.senhaHash))) {
    throw erros.requisicaoInvalida('Senha atual incorreta.', [{ campo: 'senhaAtual', mensagem: 'Senha atual incorreta.' }]);
  }
  if (senhaAtual === novaSenha) {
    throw erros.requisicaoInvalida('A nova senha deve ser diferente da atual.');
  }
  await loginRepositorio.atualizarSenha(id, await bcrypt.hash(novaSenha, CUSTO_BCRYPT));
  // Senha trocada: encerra as sessões abertas em OUTROS aparelhos (se a senha vazou, o ladrão é deslogado).
  await sessaoRepositorio.revogarOutrasDoUsuario(id, solicitante.sessaoId);
}

// ----------------------------- Exclusão ---------------------------
async function remover(solicitante, id) {
  exigirAcesso(solicitante, id);
  const atual = await usuarioRepositorio.buscarPorId(id);
  if (!atual) throw erros.naoEncontrado('Usuário não encontrado.');
  await garantirQueNaoRemoveUltimoAdmin(atual, null);
  await usuarioRepositorio.remover(id); // o login é apagado junto (onDelete: Cascade)
}

module.exports = {
  cadastrarPublico,
  criarComoAdministrador,
  listar,
  buscarPorId,
  obterPerfil,
  atualizar,
  alterarSenha,
  remover
};
