'use strict';

// Datas de agendamento são guardadas SEM hora ("AAAA-MM-DD"). "Hoje" é o dia no fuso da creche,
// e não o do servidor (um servidor em outro fuso trocaria o dia às 21h).
const FUSO = process.env.FUSO_HORARIO || 'America/Fortaleza';

function hoje() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

const paraBanco = (texto) => new Date(`${texto}T00:00:00.000Z`);   // "2026-10-05" -> Date
const doBanco = (data) => data.toISOString().slice(0, 10);         // Date -> "2026-10-05"

module.exports = { hoje, paraBanco, doBanco };
