'use strict';
const { z } = require('zod');
const campos = require('./campos');

const consultaDto = z.object({
  pagina: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1)).default('1'),
  limite: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).default('20'),
  tipoUsuarioId: campos.id.optional()
}).strict();

const atualizarUsuarioDto = z.object({
  nome: campos.nome.optional(),
  telefone: campos.telefone.optional(),
  endereco: campos.endereco.nullable().optional(),
  email: campos.email.optional(),
  tipoUsuarioId: campos.idNoCorpo.optional()
}).strict().refine((dados) => Object.keys(dados).length > 0, { message: 'Informe ao menos um campo para atualizar.' });

const alterarSenhaDto = z.object({
  senhaAtual: z.string({ required_error: 'Informe a senha atual.' }).min(1).max(200),
  novaSenha: campos.senha
}).strict();

module.exports = { consultaDto, atualizarUsuarioDto, alterarSenhaDto };
