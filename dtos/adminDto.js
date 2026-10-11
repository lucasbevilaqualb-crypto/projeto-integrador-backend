'use strict';
const { z } = require('zod');
const campos = require('./campos');

const vincularDto = z.object({ crecheId: campos.idNoCorpo }).strict();

const consultaProfissionaisDto = z.object({
  status: z.enum(['pendente', 'ativo', 'todos'], { errorMap: () => ({ message: 'Use "pendente", "ativo" ou "todos".' }) }).default('todos')
}).strict();

module.exports = { vincularDto, consultaProfissionaisDto };
