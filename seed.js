'use strict';
const bcrypt = require('bcryptjs');
const { prisma } = require('./cliente');
const { cpfValido, somenteDigitos, senha: dtoSenha } = require('../dtos/campos');

// Dados iniciais do sistema. Pode rodar quantas vezes quiser: só cria o que ainda não existe.
// Roda sozinho quando o servidor inicia (veja server.js) e também com:  node prisma/seed.js
async function semear() {
  // 1) Tipos base de usuário
  await prisma.tipoUsuario.createMany({
    data: [
      { nome: 'tutor', descricao: 'Dono de Pet', cadastroPublico: true },
      { nome: 'profissional', descricao: 'Profissional Acolhedor', cadastroPublico: true },
      { nome: 'administrador', descricao: 'Administração da plataforma', cadastroPublico: false }
    ],
    skipDuplicates: true
  });

  // 2) Administrador inicial: os dados vêm do .env (a senha NUNCA fica no código)
  const { ADMIN_NOME, ADMIN_EMAIL, ADMIN_CPF, ADMIN_TELEFONE, ADMIN_SENHA } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_SENHA) {
    console.warn('ADMIN_EMAIL/ADMIN_SENHA não definidos no .env: o administrador inicial não foi criado.');
    return;
  }
  const email = ADMIN_EMAIL.toLowerCase();
  if (await prisma.login.findUnique({ where: { email } })) return; // já existe

  if (!dtoSenha.safeParse(ADMIN_SENHA).success) {
    throw new Error('ADMIN_SENHA fraca: use 8+ caracteres com maiúscula, minúscula, número e símbolo.');
  }
  if (!cpfValido(ADMIN_CPF)) throw new Error('ADMIN_CPF inválido.');

  const tipo = await prisma.tipoUsuario.findFirst({ where: { nome: 'administrador' } });
  const senhaHash = await bcrypt.hash(ADMIN_SENHA, Number(process.env.BCRYPT_CUSTO) || 12);

  await prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: {
        tipoUsuarioId: tipo.id,
        nome: ADMIN_NOME || 'Administrador',
        cpf: somenteDigitos(ADMIN_CPF),
        telefone: somenteDigitos(ADMIN_TELEFONE || '')
      }
    });
    await tx.login.create({ data: { usuarioId: usuario.id, email, senhaHash } });
  });
  console.log(`Administrador inicial criado (${email}).`);
}

module.exports = { semear };

// Se o arquivo for executado diretamente (node prisma/seed.js):
if (require.main === module) {
  semear()
    .catch((erro) => { console.error(erro.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
