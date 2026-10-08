'use strict';
// Configuração do Prisma CLI (migrate, generate). JavaScript puro, sem TypeScript.
// O Neon oferece dois endereços: o "pooled" (com -pooler no nome, bom para a aplicação)
// e o "direct" (sem -pooler, recomendado para migrações). Se DIRECT_URL existir, ela é
// usada nas migrações; senão, usa a DATABASE_URL.
require('dotenv/config');
const { defineConfig } = require('prisma/config');

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || 'postgresql://sem-url:sem-senha@localhost:5432/sem-banco'
  }
});
