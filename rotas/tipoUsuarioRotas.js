'use strict';
const { Router } = require('express');
const { idDto } = require('../dtos/campos');
const { criarTipoDto, atualizarTipoDto } = require('../dtos/tipoUsuarioDto');
const tipoUsuarioServico = require('../servicos/tipoUsuarioServico');
const { autenticar, autorizar } = require('./protecao');

const rotas = Router();

// Pública: usada pela tela "Criar Conta" para mostrar as opções de cadastro.
rotas.get('/publicos', async (req, res) => {
  res.json(await tipoUsuarioServico.listarPublicos());
});

// Tudo abaixo: somente administrador.
rotas.use(autenticar, autorizar('administrador'));

rotas.get('/', async (req, res) => {
  res.json(await tipoUsuarioServico.listar());
});

rotas.post('/', async (req, res) => {
  const dados = criarTipoDto.parse(req.body ?? {});
  res.status(201).json(await tipoUsuarioServico.criar(dados));
});

rotas.get('/:id', async (req, res) => {
  const { id } = idDto.parse(req.params);
  res.json(await tipoUsuarioServico.buscarPorId(id));
});

rotas.put('/:id', async (req, res) => {
  const { id } = idDto.parse(req.params);
  const dados = atualizarTipoDto.parse(req.body ?? {});
  res.json(await tipoUsuarioServico.atualizar(id, dados));
});

rotas.delete('/:id', async (req, res) => {
  const { id } = idDto.parse(req.params);
  await tipoUsuarioServico.remover(id);
  res.status(204).end();
});

module.exports = rotas;
