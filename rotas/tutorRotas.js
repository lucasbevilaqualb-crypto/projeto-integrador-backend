'use strict';
const { Router } = require('express');
const { idDto, idVacinaDto } = require('../dtos/campos');
const { criarPetDto, atualizarPetDto, criarVacinaDto } = require('../dtos/petDto');
const { agendarDto, alterarAgendamentoDto, consultaAgendamentosDto, consultaDataDto, consultaAtividadesDto } = require('../dtos/agendamentoDto');
const painelServico = require('../servicos/painelServico');
const petServico = require('../servicos/petServico');
const crecheServico = require('../servicos/crecheServico');
const agendamentoServico = require('../servicos/agendamentoServico');
const { autenticar, autorizar } = require('./protecao');

const rotas = Router();

// CAMADAS 1 e 2: precisa estar logado E ser tutor. O administrador NÃO entra aqui.
// CAMADA 3 (dono do dado): todas as chamadas abaixo usam req.usuario.id, nunca um id vindo do cliente.
rotas.use(autenticar, autorizar('tutor'));

// ---- Resumo da tela inicial ----
rotas.get('/painel', async (req, res) => {
  res.json(await painelServico.tutor(req.usuario.id));
});

// ---- Pets ----
rotas.get('/pets', async (req, res) => {
  res.json(await petServico.listar(req.usuario.id));
});

rotas.post('/pets', async (req, res) => {
  const dados = criarPetDto.parse(req.body ?? {});
  res.status(201).json(await petServico.criar(req.usuario.id, dados));
});

rotas.get('/pets/:id', async (req, res) => {
  const { id } = idDto.parse(req.params);
  res.json(await petServico.buscar(req.usuario.id, id));
});

rotas.put('/pets/:id', async (req, res) => {
  const { id } = idDto.parse(req.params);
  const dados = atualizarPetDto.parse(req.body ?? {});
  res.json(await petServico.atualizar(req.usuario.id, id, dados));
});

rotas.delete('/pets/:id', async (req, res) => {
  const { id } = idDto.parse(req.params);
  await petServico.remover(req.usuario.id, id);
  res.status(204).end();
});

// ---- Vacinas do pet ----
rotas.post('/pets/:id/vacinas', async (req, res) => {
  const { id } = idDto.parse(req.params);
  const dados = criarVacinaDto.parse(req.body ?? {});
  res.status(201).json(await petServico.adicionarVacina(req.usuario.id, id, dados));
});

rotas.delete('/pets/:id/vacinas/:vacinaId', async (req, res) => {
  const { id, vacinaId } = idVacinaDto.parse(req.params);
  await petServico.removerVacina(req.usuario.id, id, vacinaId);
  res.status(204).end();
});

// ---- Creches e vagas ----
rotas.get('/creches', async (req, res) => {
  const { data } = consultaDataDto.parse(req.query);
  res.json(await crecheServico.listarComVagas(data));
});

// ---- Agendamentos ----
rotas.get('/agendamentos', async (req, res) => {
  const consulta = consultaAgendamentosDto.parse(req.query);
  res.json(await agendamentoServico.listarDoTutor(req.usuario.id, consulta));
});

rotas.post('/agendamentos', async (req, res) => {
  const dados = agendarDto.parse(req.body ?? {});
  res.status(201).json(await agendamentoServico.agendar(req.usuario.id, dados));
});

rotas.get('/agendamentos/:id', async (req, res) => {
  const { id } = idDto.parse(req.params);
  res.json(await agendamentoServico.buscarDoTutor(req.usuario.id, id));
});

rotas.put('/agendamentos/:id', async (req, res) => {
  const { id } = idDto.parse(req.params);
  const dados = alterarAgendamentoDto.parse(req.body ?? {});
  res.json(await agendamentoServico.alterar(req.usuario.id, id, dados));
});

rotas.post('/agendamentos/:id/cancelar', async (req, res) => {
  const { id } = idDto.parse(req.params);
  res.json(await agendamentoServico.cancelar(req.usuario.id, id));
});

// ---- Acompanhar o atendimento (o front consulta de tempos em tempos, com ?depois=) ----
rotas.get('/agendamentos/:id/atividades', async (req, res) => {
  const { id } = idDto.parse(req.params);
  const consulta = consultaAtividadesDto.parse(req.query);
  res.json(await agendamentoServico.listarAtividadesDoTutor(req.usuario.id, id, consulta));
});

module.exports = rotas;
