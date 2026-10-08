'use strict';
const { Router } = require('express');
const { idDto } = require('../dtos/campos');
const { cadastroDto } = require('../dtos/autenticacaoDto');
const { consultaDto, atualizarUsuarioDto, alterarSenhaDto } = require('../dtos/usuarioDto');
const usuarioServico = require('../servicos/usuarioServico');
const { autenticar, autorizar } = require('./protecao');

const rotas = Router();

// Todas as rotas de usuário exigem login.
rotas.use(autenticar);

// Meu perfil
rotas.get('/eu', async (req, res) => {
  res.json(await usuarioServico.obterPerfil(req.usuario));
});

// Lista paginada (só administrador)
rotas.get('/', autorizar('administrador'), async (req, res) => {
  const consulta = consultaDto.parse(req.query);
  res.json(await usuarioServico.listar(consulta));
});

// Cria usuário de qualquer tipo (só administrador)
rotas.post('/', autorizar('administrador'), async (req, res) => {
  const dados = cadastroDto.parse(req.body ?? {});
  res.status(201).json(await usuarioServico.criarComoAdministrador(dados));
});

// Busca / atualiza / troca a senha / remove: o próprio usuário ou um administrador
// (o serviço confere quem pode; aqui só validamos o formato dos dados)
rotas.get('/:id', async (req, res) => {
  const { id } = idDto.parse(req.params);
  res.json(await usuarioServico.buscarPorId(req.usuario, id));
});

rotas.put('/:id', async (req, res) => {
  const { id } = idDto.parse(req.params);
  const dados = atualizarUsuarioDto.parse(req.body ?? {});
  res.json(await usuarioServico.atualizar(req.usuario, id, dados));
});

rotas.put('/:id/senha', async (req, res) => {
  const { id } = idDto.parse(req.params);
  const dados = alterarSenhaDto.parse(req.body ?? {});
  await usuarioServico.alterarSenha(req.usuario, id, dados);
  res.json({ mensagem: 'Senha alterada com sucesso.' });
});

rotas.delete('/:id', async (req, res) => {
  const { id } = idDto.parse(req.params);
  await usuarioServico.remover(req.usuario, id);
  res.status(204).end();
});

module.exports = rotas;
