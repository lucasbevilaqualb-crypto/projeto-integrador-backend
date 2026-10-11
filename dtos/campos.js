'use strict';
const { z } = require('zod');

// Peças reutilizáveis de validação. Tudo que o cliente envia passa por aqui ANTES de chegar ao serviço.

// ---- CPF: confere os dois dígitos verificadores ----
const somenteDigitos = (valor) => String(valor).replace(/\D/g, '');

function cpfValido(valor) {
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false; // tamanho errado ou todos os dígitos iguais
  const digito = (quantidade) => {
    let soma = 0;
    for (let i = 0; i < quantidade; i++) soma += Number(cpf[i]) * (quantidade + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

// ---- Campos ----
const id = z.string().regex(/^\d+$/, 'O identificador deve ser um número inteiro positivo.')
  .transform(Number).pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER));
const idNoCorpo = z.number({ invalid_type_error: 'Informe um identificador numérico.' }).int().positive();
const idDto = z.object({ id }).strict(); // para rotas como /usuarios/:id

const nome = z.string({ required_error: 'Informe o nome.', invalid_type_error: 'Nome inválido.' }).trim()
  .min(3, 'O nome deve ter no mínimo 3 caracteres.').max(120, 'O nome deve ter no máximo 120 caracteres.')
  .regex(/^[\p{L}][\p{L}\s'.-]*$/u, 'O nome contém caracteres inválidos.');

const email = z.string({ required_error: 'Informe o e-mail.', invalid_type_error: 'E-mail inválido.' }).trim().toLowerCase()
  .max(254, 'O e-mail é muito longo.').email('Formato de e-mail inválido.');

const cpf = z.string({ required_error: 'Informe o CPF.', invalid_type_error: 'CPF inválido.' })
  .transform(somenteDigitos).refine(cpfValido, 'CPF inválido.');

const telefone = z.string({ required_error: 'Informe o telefone.', invalid_type_error: 'Telefone inválido.' })
  .transform(somenteDigitos).refine((v) => v.length === 10 || v.length === 11, 'Telefone inválido (use DDD + número).');

const endereco = z.string({ invalid_type_error: 'Endereço inválido.' }).trim()
  .min(5, 'O endereço deve ter no mínimo 5 caracteres.').max(200, 'O endereço deve ter no máximo 200 caracteres.');

// Política de senha. O limite de 72 BYTES existe porque o bcrypt ignora o que passa disso.
const senha = z.string({ required_error: 'Informe a senha.', invalid_type_error: 'Senha inválida.' })
  .min(8, 'A senha deve ter no mínimo 8 caracteres.')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'A senha deve ter no máximo 72 bytes.')
  .refine((v) => /[a-z]/.test(v), 'A senha deve ter ao menos uma letra minúscula.')
  .refine((v) => /[A-Z]/.test(v), 'A senha deve ter ao menos uma letra maiúscula.')
  .refine((v) => /\d/.test(v), 'A senha deve ter ao menos um número.')
  .refine((v) => /[^A-Za-z0-9]/.test(v), 'A senha deve ter ao menos um caractere especial.');

// ---- Datas e horas dos agendamentos ----
const dataIso = z.string({ required_error: 'Informe a data.', invalid_type_error: 'Data inválida.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.')
  .refine((v) => {
    // O zod roda esta conferência mesmo quando o formato acima já falhou: sem o teste de "Invalid Date", o toISOString estouraria (500).
    const d = new Date(`${v}T00:00:00.000Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v; // também recusa 2026-02-30
  }, 'Data inválida.');

const hora = z.string({ required_error: 'Informe o horário.', invalid_type_error: 'Horário inválido.' })
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use o formato HH:MM (24 horas).');

// Rotas com mais de um parâmetro: /pets/:id/vacinas/:vacinaId  e  /profissionais/:usuarioId/vinculo
const idVacinaDto = z.object({ id, vacinaId: id }).strict();
const usuarioIdDto = z.object({ usuarioId: id }).strict();

module.exports = { somenteDigitos, cpfValido, id, idNoCorpo, idDto, idVacinaDto, usuarioIdDto, dataIso, hora, nome, email, cpf, telefone, endereco, senha };
