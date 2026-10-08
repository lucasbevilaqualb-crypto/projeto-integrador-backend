'use strict';
const { Router } = require('express');
const { idDto } = require('../dtos/campos');
const { consultaDataDto, mudarStatusDto, criarAtividadeDto } = require('../dtos/agendamentoDto');
const painelServico = require('../servicos/painelServico');
const vinculoServico = require('../servicos/vinculoServico');
const agendamentoServico = require('../servicos/agendamentoServico');
const { autenticar, autorizar, exigirVinculo } = require('./protecao');

const rotas = Router();

// CAMADAS 1 e 2: precisa estar logado E ser profissional.
rotas.use(autenticar, autorizar('profissional'));

// Esta rota funciona MESMO sem vínculo: é a que a tela "conta em análise" consulta ("Verificar liberação").
rotas.get('/vinculo', async (req, res) => {
  res.json(await vinculoServico.consultar(req.usuario.id));
});

// DAQUI PARA BAIXO: só com vínculo ativo. Sem ele, 403 VINCULO_PENDENTE. A creche vem do vínculo (req.crecheId),
// nunca do cliente: o profissional só enxerga a PRÓPRIA creche.
rotas.use(exigirVinculo);

rotas.get('/painel', async (req, res) => {
  res.json(await painelServico.profissional(req.crecheId));
});

rotas.get('/agenda', async (req, res) => {
  const { data } = consultaDataDto.parse(req.query);
  res.json(await agendamentoServico.agenda(req.crecheId, data));
});

rotas.get('/agendamentos/:id', async (req, res) => {
  const { id } = idDto.parse(req.params);
  res.json(await agendamentoServico.detalharDaCreche(req.crecheId, id));
});

rotas.put('/agendamentos/:id/status', async (req, res) => {
  const { id } = idDto.parse(req.params);
  const { status } = mudarStatusDto.parse(req.body ?? {});
  res.json(await agendamentoServico.mudarStatus(req.crecheId, id, status));
});

rotas.post('/agendamentos/:id/atividades', async (req, res) => {
  const { id } = idDto.parse(req.params);
  const dados = criarAtividadeDto.parse(req.body ?? {});
  res.status(201).json(await agendamentoServico.registrarAtividade(req.crecheId, req.usuario.id, id, dados));
});

module.exports = rotas;
