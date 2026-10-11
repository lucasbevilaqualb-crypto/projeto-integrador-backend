'use strict';
const { z } = require('zod');
const campos = require('./campos');

const nome = z.string({ required_error: 'Informe o nome da creche.' }).trim()
  .min(3, 'O nome deve ter no mínimo 3 caracteres.').max(80, 'O nome deve ter no máximo 80 caracteres.');
const endereco = z.string({ required_error: 'Informe o endereço.' }).trim()
  .min(5, 'O endereço deve ter no mínimo 5 caracteres.').max(200, 'O endereço deve ter no máximo 200 caracteres.');
// Vagas por dia
const capacidade = z.number({ required_error: 'Informe a capacidade.', invalid_type_error: 'A capacidade deve ser um número.' })
  .int('A capacidade deve ser um número inteiro.').min(1, 'A capacidade mínima é 1 vaga.').max(500, 'A capacidade máxima é 500 vagas.');

const criarCrecheDto = z.object({
  nome, endereco, telefone: campos.telefone.optional(), capacidade
}).strict();

const atualizarCrecheDto = z.object({
  nome: nome.optional(), endereco: endereco.optional(), telefone: campos.telefone.nullable().optional(), capacidade: capacidade.optional()
}).strict().refine((dados) => Object.keys(dados).length > 0, { message: 'Informe ao menos um campo para atualizar.' });

module.exports = { criarCrecheDto, atualizarCrecheDto };
