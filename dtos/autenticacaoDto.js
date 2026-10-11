'use strict';
const { z } = require('zod');
const campos = require('./campos');

// DTO = "formato dos dados que a rota aceita".
// .strict() faz o zod RECUSAR campos desconhecidos (barra o ataque de "mass assignment").

const cadastroDto = z.object({
  nome: campos.nome,
  cpf: campos.cpf,
  telefone: campos.telefone,
  endereco: campos.endereco.optional(),
  email: campos.email,
  senha: campos.senha,
  tipoUsuarioId: campos.idNoCorpo
}).strict();

// "cookie" (padrão): os tokens vão em cookies HttpOnly (navegador).
// "token": os tokens vêm no corpo da resposta (app mobile, que guarda no armazenamento seguro do aparelho).
const modo = z.enum(['cookie', 'token'], { errorMap: () => ({ message: 'modo deve ser "cookie" ou "token".' }) }).default('cookie');

const loginDto = z.object({
  email: campos.email,
  // No login NÃO aplicamos a política de força: só limitamos o tamanho.
  senha: z.string({ required_error: 'Informe a senha.', invalid_type_error: 'Senha inválida.' }).min(1).max(200),
  modo
}).strict();

// Usado por /renovar e /logout. No modo "cookie" o token de renovação vem do cookie; no modo "token", do corpo.
const renovarDto = z.object({
  modo,
  refreshToken: z.string().min(20, 'Token de renovação inválido.').max(200, 'Token de renovação inválido.').optional()
}).strict();

module.exports = { cadastroDto, loginDto, renovarDto };
