'use strict';

// Erro "esperado" da aplicação: carrega o status HTTP e uma mensagem segura para o cliente.
// Qualquer outro erro vira "500 - Erro interno" (sem vazar detalhes).
class ErroHttp extends Error {
  constructor(status, codigo, mensagem, detalhes) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}

const erros = {
  requisicaoInvalida: (mensagem = 'Dados inválidos.', detalhes) => new ErroHttp(400, 'REQUISICAO_INVALIDA', mensagem, detalhes),
  naoAutenticado: (mensagem = 'Autenticação necessária.') => new ErroHttp(401, 'NAO_AUTENTICADO', mensagem),
  credenciaisInvalidas: (mensagem) => new ErroHttp(401, 'CREDENCIAIS_INVALIDAS', mensagem),
  acessoNegado: (mensagem = 'Você não tem permissão para realizar esta ação.') => new ErroHttp(403, 'ACESSO_NEGADO', mensagem),
  naoEncontrado: (mensagem = 'Recurso não encontrado.') => new ErroHttp(404, 'NAO_ENCONTRADO', mensagem),
  conflito: (mensagem) => new ErroHttp(409, 'CONFLITO', mensagem),
  vinculoPendente: () =>
    new ErroHttp(403, 'VINCULO_PENDENTE', 'Sua conta está em análise: aguarde a administração vincular você a uma creche.'),
  muitasRequisicoes: (mensagem = 'Muitas requisições. Tente novamente mais tarde.') => new ErroHttp(429, 'MUITAS_REQUISICOES', mensagem)
};

module.exports = { ErroHttp, erros };
