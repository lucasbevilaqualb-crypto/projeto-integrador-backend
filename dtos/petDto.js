'use strict';
const { z } = require('zod');
const campos = require('./campos');

const nome = z.string({ required_error: 'Informe o nome do pet.' }).trim()
  .min(2, 'O nome deve ter no mínimo 2 caracteres.').max(60, 'O nome deve ter no máximo 60 caracteres.')
  .regex(/^[\p{L}][\p{L}\p{N}\s'.-]*$/u, 'O nome contém caracteres inválidos.');
const raca = z.string({ required_error: 'Informe a raça.' }).trim()
  .min(2, 'A raça deve ter no mínimo 2 caracteres.').max(60, 'A raça deve ter no máximo 60 caracteres.');
const idade = z.number({ required_error: 'Informe a idade.', invalid_type_error: 'A idade deve ser um número.' })
  .int('A idade deve ser um número inteiro (em anos).').min(0, 'Idade inválida.').max(40, 'Idade inválida.');
const castrado = z.boolean({ invalid_type_error: 'castrado deve ser verdadeiro ou falso.' });

const criarPetDto = z.object({ nome, raca, idade, castrado: castrado.default(false) }).strict();

const atualizarPetDto = z.object({ nome: nome.optional(), raca: raca.optional(), idade: idade.optional(), castrado: castrado.optional() })
  .strict().refine((dados) => Object.keys(dados).length > 0, { message: 'Informe ao menos um campo para atualizar.' });

const criarVacinaDto = z.object({
  produto: z.string({ required_error: 'Informe o produto.' }).trim().min(2, 'Informe o produto.').max(80, 'Produto muito longo.'),
  dose: z.string({ required_error: 'Informe a dose.' }).trim().min(1, 'Informe a dose.').max(40, 'Dose muito longa.'),
  data: campos.dataIso
}).strict();

module.exports = { criarPetDto, atualizarPetDto, criarVacinaDto };
