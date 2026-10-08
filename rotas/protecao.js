'use strict';
const jwt = require('jsonwebtoken');
const usuarioRepositorio = require('../repositorios/usuarioRepositorio');
const sessaoRepositorio = require('../repositorios/sessaoRepositorio');
const vinculoRepositorio = require('../repositorios/vinculoRepositorio');
const { JWT_OPCOES } = require('../servicos/autenticacaoServico');
const { erros } = require('../erros');

const COOKIE_ACESSO = 'token_acesso';
const COOKIE_RENOVACAO = 'token_renovacao';
const METODOS_SEGUROS = ['GET', 'HEAD', 'OPTIONS']; // não alteram dados

// Sites (front-end) autorizados a falar com a API. Usado pelo CORS e pela defesa contra CSRF.
function origensPermitidas() {
  return (process.env.ORIGENS_PERMITIDAS || 'http://localhost:5500,http://127.0.0.1:5500').split(',').map((o) => o.trim());
}

// Lê um cookie do pedido (sem precisar de biblioteca extra).
function lerCookie(req, nome) {
  for (const par of (req.headers.cookie || '').split(';')) {
    const [chave, ...resto] = par.trim().split('=');
    if (chave === nome) return decodeURIComponent(resto.join('='));
  }
  return null;
}

// Defesa contra CSRF: quando o pedido usa COOKIE, conferimos de qual site ele veio.
// O navegador anexa o cookie sozinho, então um site malicioso poderia disparar pedidos em nome da pessoa.
function origemConfiavel(req) {
  return origensPermitidas().includes(req.headers.origin);
}

// Exige um token de acesso válido: no cabeçalho "Authorization: Bearer" (mobile) ou no cookie (navegador).
// Depois de conferir a assinatura, CONFIRMA NO BANCO que a SESSÃO continua ativa (logout e troca de senha
// valem na hora) e que a pessoa ainda existe, e lê o tipo ATUAL dela.
async function autenticar(req, res, proximo) {
  const [esquema, tokenDoCabecalho] = (req.headers.authorization || '').split(' ');
  let token = esquema === 'Bearer' && tokenDoCabecalho ? tokenDoCabecalho : null;
  let viaCookie = false;
  if (!token) {
    token = lerCookie(req, COOKIE_ACESSO);
    viaCookie = Boolean(token);
  }
  if (!token) throw erros.naoAutenticado();

  if (viaCookie && !METODOS_SEGUROS.includes(req.method) && !origemConfiavel(req)) {
    throw erros.acessoNegado('Origem não autorizada.');
  }

  let carga;
  try {
    carga = jwt.verify(token, process.env.JWT_SEGREDO, {
      algorithms: ['HS256'], // só aceita HS256 (recusa "alg: none")
      issuer: JWT_OPCOES.emissor,
      audience: JWT_OPCOES.publico
    });
  } catch {
    throw erros.naoAutenticado('Token inválido ou expirado.');
  }

  // Token sem sessão (sid) não é aceito, e a sessão precisa ser da mesma pessoa.
  if (typeof carga.sid !== 'string') throw erros.naoAutenticado('Token inválido ou expirado.');
  const sessao = await sessaoRepositorio.buscarAtiva(carga.sid);
  if (!sessao || sessao.usuarioId !== Number(carga.sub)) throw erros.naoAutenticado('Token inválido ou expirado.');

  const usuario = await usuarioRepositorio.buscarPorId(sessao.usuarioId);
  if (!usuario) throw erros.naoAutenticado('Token inválido ou expirado.');

  req.usuario = { id: usuario.id, tipo: usuario.tipoUsuario.nome.toLowerCase(), sessaoId: sessao.id };
  proximo();
}

// Controle por tipo de usuário: autorizar('administrador')
function autorizar(...tiposPermitidos) {
  return (req, res, proximo) => {
    if (!tiposPermitidos.includes(req.usuario.tipo)) throw erros.acessoNegado();
    proximo();
  };
}

// Só para o PROFISSIONAL: o painel dele só abre depois que a administração o vincula a uma creche.
// Sem vínculo, a conta está "em análise" (403 VINCULO_PENDENTE). Com vínculo, req.crecheId fica disponível.
async function exigirVinculo(req, res, proximo) {
  const vinculo = await vinculoRepositorio.buscarPorUsuario(req.usuario.id);
  if (!vinculo) throw erros.vinculoPendente();
  req.crecheId = vinculo.crecheId;
  proximo();
}

module.exports = { autenticar, autorizar, exigirVinculo, lerCookie, origemConfiavel, origensPermitidas, COOKIE_ACESSO, COOKIE_RENOVACAO };
