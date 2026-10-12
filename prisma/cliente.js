'use strict';
require('dotenv/config'); // lê o arquivo .env (DATABASE_URL etc.)

// Se o Prisma Client ainda não foi gerado (npx prisma generate), avisa em vez de mostrar um erro confuso.
let PrismaClient;
try {
  ({ PrismaClient } = require('@prisma/client'));
} catch (erro) {
  if (/Cannot find module|did not initialize/i.test(erro.message)) {
    console.error('\nFalha ao iniciar: o Prisma Client ainda não foi gerado. Rode: npx prisma generate\n');
    process.exit(1);
  }
  throw erro;
}
const { PrismaPg } = require('@prisma/adapter-pg');

// O Neon derruba conexões paradas. Sem este aviso, o erro derrubaria o servidor inteiro.
const avisar = (erro) => {
  if (process.env.NODE_ENV !== 'test') console.warn(`Conexão com o banco encerrada (${erro.message}). Uma nova será aberta quando precisar.`);
};

const adapter = new PrismaPg(
  {
    connectionString: process.env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 20000, // dá tempo do Neon "acordar"
    idleTimeoutMillis: 30000
  },
  { schema: process.env.BANCO_SCHEMA || undefined, onPoolError: avisar, onConnectionError: avisar }
);

// Uma única conexão compartilhada por todo o projeto.
const prisma = new PrismaClient({ adapter });

module.exports = { prisma };
