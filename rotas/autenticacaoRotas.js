'use strict';
const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { cadastroDto, loginDto, renovarDto } = require('../dtos/autenticacaoDto');
const usuarioServico = require('../servicos/usuarioServico');
const autenticacaoServico = require('../servicos/autenticacaoServico');
const { lerCookie, origemConfiavel, COOKIE_ACESSO, COOKIE_RENOVACAO } = require('./protecao');
const { erros } = require('../erros');

const { ACESSO_MINUTOS, RENOVACAO_DIAS } = autenticacaoServico;

// Limitadores de tentativas por IP (express-rate-limit), usados só onde fazem falta.
const JANELA = 15 * 60 * 1000; // 15 minutos
const comum = {
  windowMs: JANELA,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res, proximo) => proximo(erros.muitasRequisicoes())
};
const limiteCadastro = rateLimit({ ...comum, limit: Number(process.env.LIMITE_CADASTRO) || 10 });
const limiteLogin = rateLimit({ ...comum, limit: Number(process.env.LIMITE_LOGIN) || 10, skipSuccessfulRequests: true }); // conta só as falhas
const limiteRenovacao = rateLimit({ ...comum, limit: Number(process.env.LIMITE_RENOVACAO) || 60 });

// ---- Cookies dos tokens ----
// HttpOnly: o JavaScript da página NÃO consegue ler (um XSS não rouba o token).
// Secure: só viaja por HTTPS.  SameSite: o navegador não envia o cookie em pedidos vindos de outros sites.
const opcoesBase = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE !== 'false',
  sameSite: (process.env.COOKIE_SAMESITE || 'lax').toLowerCase()
};

function gravarCookies(res, { token, refreshToken }) {
  // O token de renovação só viaja para as rotas de autenticação (Path restrito).
  res.cookie(COOKIE_ACESSO, token, { ...opcoesBase, path: '/', maxAge: ACESSO_MINUTOS * 60 * 1000 });
  res.cookie(COOKIE_RENOVACAO, refreshToken, { ...opcoesBase, path: '/api/autenticacao', maxAge: RENOVACAO_DIAS * 24 * 60 * 60 * 1000 });
}

function limparCookies(res) {
  res.clearCookie(COOKIE_ACESSO, { ...opcoesBase, path: '/' });
  res.clearCookie(COOKIE_RENOVACAO, { ...opcoesBase, path: '/api/autenticacao' });
}

// Resposta do login/renovação: no modo "cookie" os tokens vão SÓ nos cookies; no modo "token", no corpo.
function responderComTokens(res, modo, resultado) {
  const { usuario, token, refreshToken, acessoExpiraEmMinutos } = resultado;
  if (modo === 'cookie') {
    gravarCookies(res, resultado);
    return res.json({ usuario, acessoExpiraEmMinutos });
  }
  return res.json({ tipoToken: 'Bearer', token, refreshToken, acessoExpiraEmMinutos, usuario });
}

const rotas = Router();

// POST /api/autenticacao/cadastro  -> cria usuario + login (público)
rotas.post('/cadastro', limiteCadastro, async (req, res) => {
  const dados = cadastroDto.parse(req.body ?? {});                 // 1) valida o que chegou
  const usuario = await usuarioServico.cadastrarPublico(dados);    // 2) regras + grava no banco
  res.status(201).json({ mensagem: 'Cadastro realizado com sucesso! Faça login para continuar.', usuario }); // 3) responde
});

// POST /api/autenticacao/login  -> confere e-mail/senha na tabela login e abre a sessão
rotas.post('/login', limiteLogin, async (req, res) => {
  const dados = loginDto.parse(req.body ?? {});
  const resultado = await autenticacaoServico.login(dados);
  responderComTokens(res, dados.modo, resultado);
});

// Descobre o token de renovação: do cookie (navegador) ou do corpo (mobile).
function obterRefreshToken(req, dados) {
  if (dados.modo === 'cookie') {
    if (!origemConfiavel(req)) throw erros.acessoNegado('Origem não autorizada.'); // defesa contra CSRF
    return lerCookie(req, COOKIE_RENOVACAO);
  }
  return dados.refreshToken;
}

// POST /api/autenticacao/renovar  -> troca o token de renovação por um par novo (rotação)
rotas.post('/renovar', limiteRenovacao, async (req, res) => {
  const dados = renovarDto.parse(req.body ?? {});
  const refreshToken = obterRefreshToken(req, dados);
  if (!refreshToken) throw erros.naoAutenticado('Sessão inválida ou expirada. Faça login novamente.');
  const resultado = await autenticacaoServico.renovar(refreshToken);
  responderComTokens(res, dados.modo, resultado);
});

// POST /api/autenticacao/logout  -> encerra a sessão (os dois tokens deixam de valer) e apaga os cookies
rotas.post('/logout', limiteRenovacao, async (req, res) => {
  const dados = renovarDto.parse(req.body ?? {});
  await autenticacaoServico.sair(obterRefreshToken(req, dados));
  if (dados.modo === 'cookie') limparCookies(res);
  res.status(204).end();
});

module.exports = rotas;
