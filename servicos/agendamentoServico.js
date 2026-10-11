'use strict';
const { prisma } = require('../prisma/cliente');
const agendamentoRepositorio = require('../repositorios/agendamentoRepositorio');
const atividadeRepositorio = require('../repositorios/atividadeRepositorio');
const petRepositorio = require('../repositorios/petRepositorio');
const crecheRepositorio = require('../repositorios/crecheRepositorio');
const { erros } = require('../erros');
const { hoje } = require('../datas');

const NAO_ENCONTRADO = 'Agendamento não encontrado.';

function exigirDataNaoPassada(data) {
  if (data < hoje()) {
    throw erros.requisicaoInvalida('Dados inválidos.', [{ campo: 'data', mensagem: 'A data não pode estar no passado.' }]);
  }
}

// Regras que valem ao agendar e ao mudar a data. Roda DENTRO da transação, com a creche "travada".
async function exigirPossibilidade({ pet, creche, data, excetoId }, tx) {
  if ((await agendamentoRepositorio.contarDoPetNaData(pet.id, data, excetoId, tx)) > 0) {
    throw erros.conflito('Este pet já tem agendamento neste dia.');
  }
  if ((await crecheRepositorio.contarOcupadas(creche.id, data, excetoId, tx)) >= creche.capacidade) {
    throw erros.conflito('Não há vagas nesta data.');
  }
}

// ======================================================================
//  TUTOR
// ======================================================================
function listarDoTutor(tutorId, consulta) {
  return agendamentoRepositorio.listarDoTutor(tutorId, consulta);
}

async function buscarDoTutor(tutorId, id) {
  const agendamento = await agendamentoRepositorio.buscarDoTutor(tutorId, id);
  if (!agendamento) throw erros.naoEncontrado(NAO_ENCONTRADO);
  return agendamento;
}

async function agendar(tutorId, dados) {
  exigirDataNaoPassada(dados.data);

  const pet = await petRepositorio.buscarDoTutor(tutorId, dados.petId); // só o pet do próprio tutor
  if (!pet) throw erros.naoEncontrado('Pet não encontrado.');
  const creche = await crecheRepositorio.buscarPorId(dados.crecheId);
  if (!creche) throw erros.naoEncontrado('Creche não encontrada.');

  // Transação: "trava" a creche, confere as vagas e grava. Dois pedidos para a última vaga: só um passa.
  const id = await prisma.$transaction(async (tx) => {
    await crecheRepositorio.travar(creche.id, tx);
    await exigirPossibilidade({ pet, creche, data: dados.data }, tx);
    return agendamentoRepositorio.criar({ petId: pet.id, crecheId: creche.id, data: dados.data, horaInicio: dados.horaInicio, horaFim: dados.horaFim }, tx);
  });
  return buscarDoTutor(tutorId, id);
}

async function alterar(tutorId, id, dados) {
  const atual = await buscarDoTutor(tutorId, id);
  if (atual.status !== 'agendado') throw erros.conflito('Só é possível alterar agendamentos com status "agendado".');

  const novo = { data: dados.data ?? atual.data, horaInicio: dados.horaInicio ?? atual.horaInicio, horaFim: dados.horaFim ?? atual.horaFim };
  if (novo.horaFim <= novo.horaInicio) {
    throw erros.requisicaoInvalida('Dados inválidos.', [{ campo: 'horaFim', mensagem: 'O horário de saída deve ser depois do horário de entrada.' }]);
  }
  if (dados.data !== undefined) exigirDataNaoPassada(novo.data);

  const creche = await crecheRepositorio.buscarPorId(atual.creche.id);
  await prisma.$transaction(async (tx) => {
    await crecheRepositorio.travar(creche.id, tx);
    // O agendamento atual não conta contra si mesmo ("excetoId").
    await exigirPossibilidade({ pet: { id: atual.pet.id }, creche, data: novo.data, excetoId: id }, tx);
    await agendamentoRepositorio.atualizar(id, novo, tx);
  });
  return buscarDoTutor(tutorId, id);
}

async function cancelar(tutorId, id) {
  const atual = await buscarDoTutor(tutorId, id);
  if (atual.status !== 'agendado') throw erros.conflito('Só é possível cancelar agendamentos com status "agendado".');
  await agendamentoRepositorio.atualizar(id, { status: 'cancelado' }); // a vaga volta a ficar livre
  return buscarDoTutor(tutorId, id);
}

// "Acompanhar em tempo real": o front pergunta de tempos em tempos o que houve DEPOIS do último horário recebido.
async function listarAtividadesDoTutor(tutorId, id, { depois }) {
  await buscarDoTutor(tutorId, id); // confere que o agendamento é do tutor
  return atividadeRepositorio.listarDoAgendamento(id, depois);
}

// ======================================================================
//  PROFISSIONAL (sempre limitado à CRECHE dele)
// ======================================================================
async function agenda(crecheId, data = hoje()) {
  const creche = await crecheRepositorio.buscarPorId(crecheId);
  const agendamentos = await agendamentoRepositorio.listarDaCreche(crecheId, data);
  const ocupadas = agendamentos.filter((a) => a.status !== 'cancelado').length;
  return {
    data,
    creche: { id: creche.id, nome: creche.nome },
    vagas: { capacidade: creche.capacidade, ocupadas, livres: Math.max(0, creche.capacidade - ocupadas) },
    agendamentos
  };
}

async function detalharDaCreche(crecheId, id) {
  const agendamento = await agendamentoRepositorio.buscarDaCreche(crecheId, id);
  if (!agendamento) throw erros.naoEncontrado(NAO_ENCONTRADO); // agendamento de outra creche = "não existe"
  return agendamento;
}

async function mudarStatus(crecheId, id, novoStatus) {
  const atual = await detalharDaCreche(crecheId, id);

  if (atual.status === 'agendado' && novoStatus === 'em_andamento') {
    if (atual.data !== hoje()) throw erros.conflito('Só é possível iniciar o atendimento no dia agendado.');
  } else if (!(atual.status === 'em_andamento' && novoStatus === 'concluido')) {
    throw erros.conflito(`Não é possível passar de "${atual.status}" para "${novoStatus}".`);
  }
  await agendamentoRepositorio.atualizar(id, { status: novoStatus });
  return detalharDaCreche(crecheId, id);
}

async function registrarAtividade(crecheId, profissionalId, id, { descricao }) {
  const atual = await detalharDaCreche(crecheId, id);
  if (atual.status !== 'em_andamento') {
    throw erros.conflito('Só é possível registrar atividades durante o atendimento (status "em_andamento").');
  }
  return atividadeRepositorio.criar({ agendamentoId: id, profissionalId, descricao });
}

module.exports = {
  listarDoTutor, buscarDoTutor, agendar, alterar, cancelar, listarAtividadesDoTutor,
  agenda, detalharDaCreche, mudarStatus, registrarAtividade
};
