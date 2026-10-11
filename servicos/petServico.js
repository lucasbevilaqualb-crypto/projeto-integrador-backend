'use strict';
const petRepositorio = require('../repositorios/petRepositorio');
const { erros } = require('../erros');
const { hoje } = require('../datas');

// O tutor NUNCA informa o próprio id: o serviço sempre recebe o id de quem está logado.
async function buscar(tutorId, id) {
  const pet = await petRepositorio.buscarDoTutor(tutorId, id);
  if (!pet) throw erros.naoEncontrado('Pet não encontrado.'); // pet de outra pessoa = "não existe" (404, não 403)
  return pet;
}

function listar(tutorId) {
  return petRepositorio.listarDoTutor(tutorId);
}

function criar(tutorId, dados) {
  return petRepositorio.criar(tutorId, dados);
}

async function atualizar(tutorId, id, dados) {
  await buscar(tutorId, id);
  return petRepositorio.atualizar(id, dados);
}

async function remover(tutorId, id) {
  await buscar(tutorId, id);
  if ((await petRepositorio.contarAgendamentosEmAberto(id)) > 0) {
    throw erros.conflito('Este pet tem agendamentos em aberto. Cancele-os antes de apagar.');
  }
  await petRepositorio.remover(id);
}

async function adicionarVacina(tutorId, petId, dados) {
  await buscar(tutorId, petId);
  if (dados.data > hoje()) {
    throw erros.requisicaoInvalida('Dados inválidos.', [{ campo: 'data', mensagem: 'A data da vacina não pode estar no futuro.' }]);
  }
  await petRepositorio.criarVacina(petId, dados);
  return buscar(tutorId, petId);
}

async function removerVacina(tutorId, petId, vacinaId) {
  await buscar(tutorId, petId);
  if (!(await petRepositorio.removerVacina(petId, vacinaId))) throw erros.naoEncontrado('Vacina não encontrada.');
}

module.exports = { listar, buscar, criar, atualizar, remover, adicionarVacina, removerVacina };
