'use strict';
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const loginRepositorio = require('../repositorios/loginRepositorio');
const usuarioRepositorio = require('../repositorios/usuarioRepositorio');
const sessaoRepositorio = require('../repositorios/sessaoRepositorio');
const { erros } = require('../erros');

const CUSTO_BCRYPT = Number(process.env.BCRYPT_CUSTO) || 12;
const MAX_TENTATIVAS = Number(process.env.MAX_TENTATIVAS_LOGIN) || 5;
const BLOQUEIO_MINUTOS = Number(process.env.BLOQUEIO_MINUTOS) || 15;
const ACESSO_MINUTOS = Number(process.env.ACESSO_EXPIRA_MINUTOS) || 15; // token de acesso: CURTO
const RENOVACAO_DIAS = Number(process.env.REFRESH_EXPIRA_DIAS) || 7;    // token de renovação: dura a sessão
const MENSAGEM_LOGIN = 'E-mail ou senha inválidos'; // a MESMA para e-mail inexistente e senha errada

// "Quem emitiu" e "para quem" o token vale. O middleware de proteção confere os mesmos valores.
const JWT_OPCOES = { emissor: 'creche-pet-api', publico: 'creche-pet-app' };

// Hash de mentira, calculado uma vez. Quando o e-mail não existe, comparamos a senha com ele
// para gastar o MESMO tempo de um login real (senão dá para descobrir quem tem conta medindo o tempo).
const hashFalso = bcrypt.hash('senha-falsa-para-igualar-o-tempo', CUSTO_BCRYPT);

// ---- Ferramentas de token ----
const sha256 = (texto) => crypto.createHash('sha256').update(texto).digest('hex');
const novoTokenDeRenovacao = () => crypto.randomBytes(48).toString('base64url'); // aleatório, sem significado
const expiracaoDaSessao = () => new Date(Date.now() + RENOVACAO_DIAS * 24 * 60 * 60 * 1000);

// O token de acesso leva QUEM é a pessoa (sub) e a QUAL sessão pertence (sid).
// As permissões são lidas do banco a cada pedido.
function gerarTokenDeAcesso(usuarioId, sessaoId) {
  return jwt.sign({ sub: String(usuarioId), sid: sessaoId }, process.env.JWT_SEGREDO, {
    algorithm: 'HS256', // fixado: bloqueia o ataque do "alg: none"
    issuer: JWT_OPCOES.emissor,
    audience: JWT_OPCOES.publico,
    expiresIn: `${ACESSO_MINUTOS}m`
  });
}

// ---------------------------------------------------------------
// LOGIN: confere e-mail e senha NA TABELA "login" e abre uma sessão.
// ---------------------------------------------------------------
async function login({ email, senha }) {
  const registro = await loginRepositorio.buscarPorEmail(email);

  // 1) E-mail inexistente
  if (!registro) {
    await bcrypt.compare(senha, await hashFalso);
    throw erros.credenciaisInvalidas(MENSAGEM_LOGIN);
  }

  // 2) Conta bloqueada por excesso de tentativas
  if (registro.bloqueadoAte && registro.bloqueadoAte > new Date()) {
    throw erros.muitasRequisicoes('Conta temporariamente bloqueada por excesso de tentativas. Tente novamente mais tarde.');
  }

  // 3) Compara a senha digitada com o HASH guardado
  const senhaCorreta = await bcrypt.compare(senha, registro.senhaHash);
  if (!senhaCorreta) {
    const tentativas = registro.tentativasFalhas + 1;
    if (tentativas >= MAX_TENTATIVAS) {
      const ate = new Date(Date.now() + BLOQUEIO_MINUTOS * 60 * 1000);
      await loginRepositorio.registrarFalha(registro.usuarioId, 0, ate); // bloqueia e zera o contador
    } else {
      await loginRepositorio.registrarFalha(registro.usuarioId, tentativas, null);
    }
    throw erros.credenciaisInvalidas(MENSAGEM_LOGIN);
  }

  // 4) Deu certo: zera as falhas e abre uma sessão (guardamos só o HASH do token de renovação)
  await loginRepositorio.registrarSucesso(registro.usuarioId);
  const usuario = await usuarioRepositorio.buscarPorId(registro.usuarioId);
  const refreshToken = novoTokenDeRenovacao();
  const sessao = await sessaoRepositorio.criar({
    usuarioId: usuario.id,
    refreshHash: sha256(refreshToken),
    expiraEm: expiracaoDaSessao()
  });

  return {
    usuario,
    token: gerarTokenDeAcesso(usuario.id, sessao.id),
    refreshToken,
    acessoExpiraEmMinutos: ACESSO_MINUTOS
  };
}

// ---------------------------------------------------------------
// RENOVAR: troca o token de renovação por um par novo (ROTAÇÃO).
// Cada token de renovação só pode ser usado UMA vez.
// ---------------------------------------------------------------
async function renovar(refreshToken) {
  const negar = () => erros.naoAutenticado('Sessão inválida ou expirada. Faça login novamente.');

  const hash = sha256(refreshToken);
  const sessao = await sessaoRepositorio.buscarPorRefresh(hash);
  if (!sessao || sessao.revogadaEm || sessao.expiraEm <= new Date()) throw negar();

  // Apresentaram um token ANTIGO de novo: alguém copiou o token. Encerramos a sessão inteira.
  if (sessao.refreshHash !== hash) {
    await sessaoRepositorio.revogar(sessao.id);
    throw negar();
  }

  const novoRefresh = novoTokenDeRenovacao();
  const trocou = await sessaoRepositorio.rotacionar(sessao.id, hash, {
    novoHash: sha256(novoRefresh),
    expiraEm: expiracaoDaSessao()
  });
  if (!trocou) throw negar();

  const usuario = await usuarioRepositorio.buscarPorId(sessao.usuarioId);
  if (!usuario) throw negar();

  return {
    usuario,
    token: gerarTokenDeAcesso(usuario.id, sessao.id),
    refreshToken: novoRefresh,
    acessoExpiraEmMinutos: ACESSO_MINUTOS
  };
}

// ---------------------------------------------------------------
// LOGOUT: revoga a sessão. O token de acesso e o de renovação deixam de valer NA HORA.
// ---------------------------------------------------------------
async function sair(refreshToken) {
  if (!refreshToken) return; // nada para revogar (o logout é idempotente)
  const sessao = await sessaoRepositorio.buscarPorRefresh(sha256(refreshToken));
  if (sessao) await sessaoRepositorio.revogar(sessao.id);
}

module.exports = { login, renovar, sair, JWT_OPCOES, ACESSO_MINUTOS, RENOVACAO_DIAS };
