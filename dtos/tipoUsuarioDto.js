'use strict';
const { z } = require('zod');

const nomeTipo = z.string({ required_error: 'Informe o nome do tipo.' }).trim()
  .min(3, 'O nome do tipo deve ter no mínimo 3 caracteres.').max(40, 'O nome do tipo deve ter no máximo 40 caracteres.')
  .regex(/^[\p{L}][\p{L}\s_-]*$/u, 'O nome do tipo contém caracteres inválidos.');

const descricaoTipo = z.string().trim().max(200, 'A descrição deve ter no máximo 200 caracteres.');
const booleano = z.boolean({ invalid_type_error: 'cadastroPublico deve ser verdadeiro ou falso.' });

const criarTipoDto = z.object({
  nome: nomeTipo,
  descricao: descricaoTipo.optional(),
  cadastroPublico: booleano.default(false)
}).strict();

const atualizarTipoDto = z.object({
  nome: nomeTipo.optional(),
  descricao: descricaoTipo.nullable().optional(),
  cadastroPublico: booleano.optional()
}).strict().refine((dados) => Object.keys(dados).length > 0, { message: 'Informe ao menos um campo para atualizar.' });

module.exports = { criarTipoDto, atualizarTipoDto };
