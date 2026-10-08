'use strict';
// ============================================================
// server.js: conecta tudo e inicia o servidor.
// ============================================================
require('dotenv/config'); // lê o arquivo .env
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { ZodError } = require('zod');
const swaggerUi = require('swagger-ui-express');

const { prisma } = require('./prisma/cliente');
const { semear } = require('./prisma/seed');
const { ErroHttp, erros } = require('./erros');
const autenticacaoRotas = require('./rotas/autenticacaoRotas');
const usuarioRotas = require('./rotas/usuarioRotas');
const tipoUsuarioRotas = require('./rotas/tipoUsuarioRotas');
const tutorRotas = require('./rotas/tutorRotas');
const profissionalRotas = require('./rotas/profissionalRotas');
const adminRotas = require('./rotas/adminRotas');
const { origensPermitidas } = require('./rotas/protecao');
const especificacao = require('./docs/openapi');

const app = express();
const emTeste = process.env.NODE_ENV === 'test';

app.disable('x-powered-by'); // não anuncia que é Express
if (process.env.CONFIAR_PROXY === 'true') app.set('trust proxy', 1);

// 1) Cabeçalhos de segurança HTTP
app.use(helmet());

// 2) CORS: só os endereços do front-end listados no .env. "credentials" deixa o navegador enviar os cookies.
app.use(cors({
  origin: (origem, retorno) => retorno(null, !origem || origensPermitidas().includes(origem)), // sem "origem" = curl/Postman
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600
}));

// 3) Registro simples de cada pedido (só método, rota e status: nunca corpo nem cabeçalhos)
if (!emTeste) {
  app.use((req, res, proximo) => {
    const caminho = req.originalUrl.split('?')[0];
    if (!caminho.startsWith('/docs')) res.on('finish', () => console.log(`${req.method} ${caminho} -> ${res.statusCode}`));
    proximo();
  });
}

// 4) Limite geral de pedidos por IP
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LIMITE_GERAL) || 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res, proximo) => proximo(erros.muitasRequisicoes())
}));

// 5) Corpo JSON de no máximo 10 KB
app.use(express.json({ limit: '10kb' }));

// 6) Rotas
app.get('/api/saude', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`; // confere se o banco responde
    res.json({ status: 'ok', banco: 'ok', horario: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'erro', banco: 'indisponivel', horario: new Date().toISOString() });
  }
});
app.use('/api/autenticacao', autenticacaoRotas);
app.use('/api/usuarios', usuarioRotas);
app.use('/api/tipos-usuario', tipoUsuarioRotas);
app.use('/api/tutor', tutorRotas);               // painel do tutor
app.use('/api/profissional', profissionalRotas); // painel do profissional
app.use('/api/admin', adminRotas);               // painel do administrador

// 6b) Documentação interativa (Swagger UI) em /docs. Por padrão fica LIGADA só fora de produção:
//     em produção, só aparece se DOCS_ATIVADO=true (não exponha o mapa da API sem necessidade).
const docsAtivado = process.env.DOCS_ATIVADO ? process.env.DOCS_ATIVADO === 'true' : process.env.NODE_ENV !== 'production';
if (docsAtivado) {
  app.get('/docs.json', (req, res) => res.json(especificacao));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(especificacao, {
    customSiteTitle: 'Creche Pet API',
    swaggerOptions: { persistAuthorization: false } // não guarda o token no navegador
  }));
}

// 7) Rota inexistente
app.use((req, res, proximo) => proximo(erros.naoEncontrado('Rota não encontrada.')));

// 8) Tratamento de erros: ponto ÚNICO. O cliente só recebe mensagens seguras;
//    detalhes técnicos (stack, SQL, caminhos) ficam só no log do servidor.
const CODIGOS_BANCO_INDISPONIVEL = ['P1001', 'P1002', 'P1008', 'P1017', 'P2024']; // Prisma: "não consegui falar com o banco"

// eslint-disable-next-line no-unused-vars
app.use((erro, req, res, proximo) => {
  if (erro instanceof ErroHttp) {
    const corpo = { erro: { codigo: erro.codigo, mensagem: erro.message } };
    if (erro.detalhes) corpo.erro.detalhes = erro.detalhes;
    return res.status(erro.status).json(corpo);
  }

  // Dados inválidos (zod): devolve o campo e o motivo
  if (erro instanceof ZodError) {
    const detalhes = erro.issues.map((p) => (p.code === 'unrecognized_keys'
      ? { campo: p.keys.join(', '), mensagem: 'Campo não permitido.' }
      : { campo: p.path.join('.'), mensagem: p.message }));
    return res.status(400).json({ erro: { codigo: 'REQUISICAO_INVALIDA', mensagem: 'Dados inválidos.', detalhes } });
  }

  // JSON quebrado ou grande demais (erros do express.json)
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: { codigo: 'JSON_INVALIDO', mensagem: 'O corpo da requisição não é um JSON válido.' } });
  }
  if (erro.type === 'entity.too.large') {
    return res.status(413).json({ erro: { codigo: 'CORPO_MUITO_GRANDE', mensagem: 'O corpo da requisição é grande demais.' } });
  }

  // Banco fora do ar (ou Neon "acordando"): 503 em vez de 500
  if (CODIGOS_BANCO_INDISPONIVEL.includes(erro.code)) {
    if (!emTeste) console.warn(`Banco indisponível em ${req.method} ${req.originalUrl.split('?')[0]} (${erro.code})`);
    return res.status(503).json({
      erro: { codigo: 'BANCO_INDISPONIVEL', mensagem: 'Banco de dados temporariamente indisponível. Tente novamente em instantes.' }
    });
  }

  // Qualquer outro erro: 500 genérico para o cliente, detalhes só no log
  if (!emTeste) {
    const resumo = String(erro.message || '').split('\n').map((l) => l.trim()).filter(Boolean).pop();
    console.error(`Erro inesperado em ${req.method} ${req.originalUrl.split('?')[0]}: [${erro.code || erro.name}] ${resumo}`);
  }
  return res.status(500).json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno do servidor.' } });
});

// ------------------------------------------------------------
// Inicialização: confere a configuração, o banco e sobe o servidor
// ------------------------------------------------------------
async function iniciar() {
  if (!process.env.JWT_SEGREDO || process.env.JWT_SEGREDO.length < 32) {
    throw new Error('JWT_SEGREDO ausente ou curto demais (mínimo 32 caracteres). Veja o .env.example.');
  }
  const sameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  if (!['lax', 'strict', 'none'].includes(sameSite)) throw new Error('COOKIE_SAMESITE deve ser lax, strict ou none.');
  if (sameSite === 'none' && process.env.COOKIE_SECURE === 'false') throw new Error('COOKIE_SAMESITE=none exige COOKIE_SECURE=true (HTTPS).');
  if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL || '') || /USUARIO:SENHA/.test(process.env.DATABASE_URL)) {
    throw new Error('DATABASE_URL ausente ou ainda com o valor de exemplo. Cole no .env a URL de conexão do Neon.');
  }

  try {
    await prisma.tipoUsuario.count(); // testa a conexão e se as tabelas existem
    await prisma.sessao.count();       // (a tabela "sessao" veio numa migração posterior)
    await prisma.agendamento.count();  // (e as dos painéis, na terceira)
  } catch (erro) {
    if (erro.code === 'P2021') throw new Error('Conectou ao banco, mas faltam tabelas. Rode: npx prisma migrate deploy');
    const motivo = String(erro.message || erro).split('\n').filter(Boolean).pop();
    throw new Error(`Não foi possível conectar ao banco de dados (o Neon pode levar alguns segundos para "acordar"). Detalhe: ${motivo}`);
  }

  await semear(); // cria os tipos base e o administrador inicial, se ainda não existirem

  const porta = Number(process.env.PORTA) || 3000;
  const servidor = app.listen(porta, () => console.log(`Creche Pet API rodando em http://localhost:${porta}`));

  // Ctrl+C: fecha o servidor e a conexão com o banco
  const encerrar = () => servidor.close(async () => { await prisma.$disconnect(); process.exit(0); });
  process.on('SIGINT', encerrar);
  process.on('SIGTERM', encerrar);
}

// Só inicia se o arquivo for executado diretamente (npm start). Os testes importam apenas o "app".
if (require.main === module) {
  iniciar().catch((erro) => {
    console.error(`\nFalha ao iniciar: ${erro.message}\n`);
    process.exit(1);
  });
}

module.exports = { app };
