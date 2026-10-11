'use strict';
const petRepositorio = require('../repositorios/petRepositorio');
const agendamentoRepositorio = require('../repositorios/agendamentoRepositorio');
const atividadeRepositorio = require('../repositorios/atividadeRepositorio');
const crecheRepositorio = require('../repositorios/crecheRepositorio');
const vinculoRepositorio = require('../repositorios/vinculoRepositorio');
const tipoUsuarioRepositorio = require('../repositorios/tipoUsuarioRepositorio');
const { hoje } = require('../datas');

// Cada painel devolve um RESUMO pronto para a tela inicial. O id vem sempre de quem está logado.

async function tutor(tutorId) {
  const [pets, proximosAgendamentos, emAndamento] = await Promise.all([
    petRepositorio.contarDoTutor(tutorId),
    agendamentoRepositorio.proximosDoTutor(tutorId, hoje(), 5),
    agendamentoRepositorio.emAndamentoDoTutor(tutorId)
  ]);
  return { pets, proximosAgendamentos, emAndamento };
}

async function profissional(crecheId) {
  const data = hoje();
  const creche = await crecheRepositorio.buscarPorId(crecheId);
  const [porStatus, ocupadas, proximos, atividadesHoje] = await Promise.all([
    agendamentoRepositorio.contarPorStatus({ crecheId, data }),
    crecheRepositorio.contarOcupadas(crecheId, data),
    agendamentoRepositorio.proximosDaCreche(crecheId, data, 5),
    atividadeRepositorio.contarDaCrecheNaData(crecheId, data)
  ]);
  return {
    creche: { id: creche.id, nome: creche.nome },
    hoje: { data, porStatus, vagas: { capacidade: creche.capacidade, ocupadas, livres: Math.max(0, creche.capacidade - ocupadas) } },
    proximos,
    atividadesHoje
  };
}

async function administrador() {
  const data = hoje();
  const [usuariosPorTipo, profissionaisPendentes, creches, agendamentosHoje, agendamentosPorStatus] = await Promise.all([
    tipoUsuarioRepositorio.contarUsuariosPorTipo(),
    vinculoRepositorio.contarPendentes(),
    crecheRepositorio.contar(),
    agendamentoRepositorio.contarPorStatus({ data }),
    agendamentoRepositorio.contarPorStatus({})
  ]);
  return { usuariosPorTipo, profissionaisPendentes, creches, agendamentosHoje: { data, porStatus: agendamentosHoje }, agendamentosPorStatus };
}

module.exports = { tutor, profissional, administrador };
