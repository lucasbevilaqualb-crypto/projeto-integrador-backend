'use strict';
const { prisma } = require('../prisma/cliente');
const { paraBanco, doBanco } = require('../datas');

const COM_VACINAS = { vacinas: { orderBy: [{ data: 'desc' }, { id: 'desc' }] } };

const paraVacina = (v) => ({ id: v.id, produto: v.produto, dose: v.dose, data: doBanco(v.data) });

function paraPet(pet) {
  if (!pet) return null;
  return {
    id: pet.id,
    nome: pet.nome,
    raca: pet.raca,
    idade: pet.idade,
    castrado: pet.castrado,
    vacinas: pet.vacinas ? pet.vacinas.map(paraVacina) : undefined,
    criadoEm: pet.criadoEm,
    atualizadoEm: pet.atualizadoEm
  };
}

// TODA busca de pet filtra pelo TUTOR: o pet de outra pessoa simplesmente "não existe" para quem pergunta.
async function listarDoTutor(tutorId, db = prisma) {
  return (await db.pet.findMany({ where: { tutorId }, include: COM_VACINAS, orderBy: { id: 'asc' } })).map(paraPet);
}

async function buscarDoTutor(tutorId, id, db = prisma) {
  return paraPet(await db.pet.findFirst({ where: { id, tutorId }, include: COM_VACINAS }));
}

async function criar(tutorId, { nome, raca, idade, castrado }, db = prisma) {
  const pet = await db.pet.create({ data: { tutorId, nome, raca, idade, castrado }, include: COM_VACINAS });
  return paraPet(pet);
}

async function atualizar(id, dados, db = prisma) {
  const data = {};
  for (const campo of ['nome', 'raca', 'idade', 'castrado']) if (dados[campo] !== undefined) data[campo] = dados[campo];
  return paraPet(await db.pet.update({ where: { id }, data, include: COM_VACINAS }));
}

async function remover(id, db = prisma) {
  return (await db.pet.deleteMany({ where: { id } })).count > 0;
}

function contarDoTutor(tutorId, db = prisma) {
  return db.pet.count({ where: { tutorId } });
}

function contarAgendamentosEmAberto(petId, db = prisma) {
  return db.agendamento.count({ where: { petId, status: { in: ['agendado', 'em_andamento'] } } });
}

// ---------------------------- Vacinas ----------------------------
async function criarVacina(petId, { produto, dose, data }, db = prisma) {
  return paraVacina(await db.vacina.create({ data: { petId, produto, dose, data: paraBanco(data) } }));
}

async function removerVacina(petId, id, db = prisma) {
  return (await db.vacina.deleteMany({ where: { id, petId } })).count > 0;
}

module.exports = { listarDoTutor, buscarDoTutor, criar, atualizar, remover, contarDoTutor, contarAgendamentosEmAberto, criarVacina, removerVacina };
