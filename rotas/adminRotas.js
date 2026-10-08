'use strict';
const { Router } = require('express');
const { idDto, usuarioIdDto } = require('../dtos/campos');
const { criarCrecheDto, atualizarCrecheDto } = require('../dtos/crecheDto');
const { vincularDto, consultaProfissionaisDto } = require('../dtos/adminDto');
const painelServico = require('../servicos/painelServico');
const crecheServico = require('../servicos/crecheServico');
const vinculoServico = require('../servicos/vinculoServico');
const { autenticar, autorizar } = require('./protecao');

const rotas = Router();

// Só o administrador. Tutor e profissional recebem 403 aqui.
rotas.use(autenticar, autorizar('administrador'));

rotas.get('/painel', async (req, res) => {
  res.json(await painelServico.administrador());
});

// ---- Creches ----
rotas.get('/creches', async (req, res) => {
  res.json(await crecheServico.listar());
});

rotas.post('/creches', async (req, res) => {
  const dados = criarCrecheDto.parse(req.body ?? {});
  res.status(201).json(await crecheServico.criar(dados));
});

rotas.get('/creches/:id', async (req, res) => {
  const { id } = idDto.parse(req.params);
  res.json(await crecheServico.buscar(id));
});

rotas.put('/creches/:id', async (req, res) => {
  const { id } = idDto.parse(req.params);
  const dados = atualizarCrecheDto.parse(req.body ?? {});
  res.json(await crecheServico.atualizar(id, dados));
});

rotas.delete('/creches/:id', async (req, res) => {
  const { id } = idDto.parse(req.params);
  await crecheServico.remover(id);
  res.status(204).end();
});

// ---- Profissionais: quem está "em análise" e o vínculo com a creche ----
rotas.get('/profissionais', async (req, res) => {
  const consulta = consultaProfissionaisDto.parse(req.query);
  res.json(await vinculoServico.listarProfissionais(consulta));
});

rotas.put('/profissionais/:usuarioId/vinculo', async (req, res) => {
  const { usuarioId } = usuarioIdDto.parse(req.params);
  const { crecheId } = vincularDto.parse(req.body ?? {});
  res.json(await vinculoServico.vincular(usuarioId, crecheId));
});

rotas.delete('/profissionais/:usuarioId/vinculo', async (req, res) => {
  const { usuarioId } = usuarioIdDto.parse(req.params);
  await vinculoServico.desvincular(usuarioId);
  res.status(204).end();
});

module.exports = rotas;
