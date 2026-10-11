'use strict';
const { z } = require('zod');
const campos = require('./campos');

const status = z.enum(['agendado', 'em_andamento', 'concluido', 'cancelado'], {
  errorMap: () => ({ message: 'Status inválido.' })
});

const ordemDasHoras = { message: 'O horário de saída deve ser depois do horário de entrada.', path: ['horaFim'] };

const agendarDto = z.object({
  petId: campos.idNoCorpo,
  crecheId: campos.idNoCorpo,
  data: campos.dataIso,
  horaInicio: campos.hora,
  horaFim: campos.hora
}).strict().refine((d) => d.horaFim > d.horaInicio, ordemDasHoras);

const alterarAgendamentoDto = z.object({
  data: campos.dataIso.optional(),
  horaInicio: campos.hora.optional(),
  horaFim: campos.hora.optional()
}).strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'Informe ao menos um campo para atualizar.' })
  .refine((d) => !(d.horaInicio && d.horaFim) || d.horaFim > d.horaInicio, ordemDasHoras);

const consultaAgendamentosDto = z.object({ status: status.optional() }).strict();
const consultaDataDto = z.object({ data: campos.dataIso.optional() }).strict();

// O profissional só avança o atendimento: iniciar ou concluir.
const mudarStatusDto = z.object({
  status: z.enum(['em_andamento', 'concluido'], { errorMap: () => ({ message: 'Use "em_andamento" ou "concluido".' }) })
}).strict();

const criarAtividadeDto = z.object({
  descricao: z.string({ required_error: 'Descreva a atividade.' }).trim()
    .min(3, 'A descrição deve ter no mínimo 3 caracteres.').max(300, 'A descrição deve ter no máximo 300 caracteres.')
}).strict();

// Para "acompanhar em tempo real": o front pergunta "o que houve DEPOIS deste horário?"
const consultaAtividadesDto = z.object({
  depois: z.string().datetime({ message: 'Use uma data e hora ISO, por exemplo 2026-10-05T14:30:00.000Z.' }).optional()
}).strict();

module.exports = { agendarDto, alterarAgendamentoDto, consultaAgendamentosDto, consultaDataDto, mudarStatusDto, criarAtividadeDto, consultaAtividadesDto };
