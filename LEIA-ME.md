# Creche Pet: Backend (Node.js + Express + Prisma + Neon)

API de **usuários, tipos de usuário, login e painéis (tutor, profissional e administrador)**. JavaScript puro, banco PostgreSQL (Neon) acessado pelo Prisma.
O token fica em **cookie HttpOnly** (web), com token de acesso curto, renovação com rotação e **logout de verdade**.

## Estrutura
```
Backend/
├── server.js          # liga tudo e inicia o servidor
├── prisma.config.js   # configuração do Prisma CLI
├── prisma/            # schema.prisma (tabelas), migrations/, cliente.js e seed.js
├── dtos/              # formato dos dados aceitos pelas rotas (zod)
├── repositorios/      # falam com o banco (Prisma)
├── servicos/          # regras do sistema (bcryptjs e jsonwebtoken são usados aqui)
├── rotas/             # endereços da API (rota + controller); protecao.js confere o token
├── docs/              # openapi.js (documentação Swagger) e requisicoes.http (exemplos)
├── erros.js           # erros padronizados
└── testes/            # testes automatizados
```
Caminho de um pedido: **rota → DTO (zod) → serviço → repositório → Prisma → Neon**.

## Como rodar
Requisitos: **Node 22.12+** e uma URL de conexão do **Neon**.

```bash
npm install
cp .env.example .env     # no Windows: copy .env.example .env
```
Abra o `.env` e preencha:
- `JWT_SEGREDO`: gere com `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
- `DATABASE_URL`: a URL do Neon (painel do Neon > Connect). Mantenha as aspas.
- `ADMIN_SENHA`: uma senha forte para o administrador inicial.

```bash
npx prisma generate       # gera o Prisma Client
npx prisma migrate deploy # cria as tabelas no Neon
npm start                 # http://localhost:3000
```
Se você já tinha rodado o `migrate deploy` antes, rode de novo: ele aplica só a migração nova (tabela `sessao`).
Na primeira subida a API cria os tipos `tutor`, `profissional`, `administrador` e o administrador do `.env`.

| Comando | O que faz |
|---|---|
| `npm start` | sobe a API |
| `npm run dev` | sobe a API reiniciando a cada alteração |
| `npm test` | roda os 61 testes (em um schema temporário do banco; suas tabelas não são tocadas) |

## Documentação interativa (Swagger)
Com a API rodando, abra **http://localhost:3000/docs**: você vê todas as rotas, os formatos de entrada e saída, e pode **testar pelo navegador**.
O documento bruto (OpenAPI 3) fica em `http://localhost:3000/docs.json`.

**Como testar as rotas protegidas no Swagger**
1. Em **POST /autenticacao/login**, clique em *Try it out* e envie `"modo": "token"` (já vem no exemplo).
2. Copie o `token` da resposta.
3. Clique em **Authorize** (cadeado), cole o token em `bearerAuth` e confirme.
4. As rotas com cadeado passam a funcionar. Para as de administrador, entre com `admin@crechepet.com`.

Use o modo `token` no Swagger: pedidos que alteram dados com **cookie** só são aceitos vindo do front-end listado em `ORIGENS_PERMITIDAS` (defesa contra CSRF).

- A documentação fica **ligada fora de produção**. Em produção só aparece com `DOCS_ATIVADO=true` no `.env` (não exponha o mapa da API sem necessidade).
- O Swagger **não guarda o token** no navegador.
- Criou ou mudou uma rota? Atualize `docs/openapi.js`: um teste falha se alguma rota da API estiver sem documentação.

## Painéis por tipo de usuário
Depois do login, o front leva cada pessoa ao painel do **seu** tipo (`usuario.tipoUsuario.nome` vem na resposta do login; `GET /usuarios/eu` diz quem está logado depois de recarregar a página).
Cada pessoa tem **um tipo só** e **o administrador não entra nos painéis dos outros**.

**Como a API confere se a pessoa é a certa (3 camadas)**
1. **Autenticação:** `autenticar` confere o token e a sessão no banco (`401` se faltar).
2. **Papel:** `autorizar('tutor')`, `autorizar('profissional')` ou `autorizar('administrador')` em cada pasta de rotas (`403` para o tipo errado).
3. **Dono do dado:** o serviço usa sempre o id de quem está logado, nunca um id enviado pelo cliente. O pet ou o agendamento de outra pessoa responde `404` (não `403`), para não revelar que ele existe.

O **profissional** ainda precisa de **vínculo com uma creche** (feito pela administração). Sem vínculo, a conta está "em análise": `GET /profissional/vinculo` responde `pendente`
e as demais rotas respondem `403 VINCULO_PENDENTE`. Quando a administração vincula, o **mesmo token** passa a funcionar, sem novo login.

| Painel | Rotas (prefixo `/api`) |
|---|---|
| **Tutor** `/tutor` | `GET /painel`; pets: `GET, POST /pets`, `GET, PUT, DELETE /pets/:id`; vacinas: `POST /pets/:id/vacinas`, `DELETE /pets/:id/vacinas/:vacinaId`; `GET /creches?data=` (com vagas livres); agendamentos: `GET, POST /agendamentos`, `GET, PUT /agendamentos/:id`, `POST /agendamentos/:id/cancelar`; acompanhar: `GET /agendamentos/:id/atividades?depois=` |
| **Profissional** `/profissional` | `GET /vinculo` (funciona sem vínculo); `GET /painel`; `GET /agenda?data=`; `GET /agendamentos/:id`; `PUT /agendamentos/:id/status`; `POST /agendamentos/:id/atividades` |
| **Administrador** `/admin` | `GET /painel`; creches: `GET, POST /creches`, `GET, PUT, DELETE /creches/:id`; `GET /profissionais?status=`; `PUT, DELETE /profissionais/:usuarioId/vinculo` |

**Regras principais**
- **Vagas:** cada creche tem `capacidade` vagas **por dia**. Agendamento cancelado libera a vaga. A conferência acontece numa transação que **trava a creche**: cinco pessoas disputando a última vaga ao mesmo tempo, só uma consegue (`409 Não há vagas nesta data.`).
- **Agendar:** não aceita data passada, horário de saída antes da entrada, o mesmo pet duas vezes no dia nem pet de outra pessoa.
- **Status do agendamento:** `agendado` → `em_andamento` (só no dia agendado, pelo profissional) → `concluido`. O tutor pode alterar ou cancelar enquanto estiver `agendado`.
- **Atividades:** o profissional registra durante o atendimento. O tutor acompanha consultando de tempos em tempos com `?depois=<horário da última recebida>` (só vêm as novas).
- **Datas:** `AAAA-MM-DD` e horários `HH:MM`. "Hoje" é o dia no fuso `FUSO_HORARIO` (padrão `America/Fortaleza`).
- Apagar um usuário apaga em cascata seus pets, vacinas e agendamentos.

## Rotas (`/api`)
| Método | Rota | Quem pode |
|---|---|---|
| GET | `/saude` | qualquer um |
| POST | `/autenticacao/cadastro` | qualquer um (só tipos públicos) |
| POST | `/autenticacao/login` | qualquer um (abre a sessão) |
| POST | `/autenticacao/renovar` | quem tem a sessão (troca os tokens) |
| POST | `/autenticacao/logout` | quem tem a sessão (encerra de verdade) |
| GET | `/tipos-usuario/publicos` | qualquer um |
| GET, POST | `/tipos-usuario` | administrador |
| GET, PUT, DELETE | `/tipos-usuario/:id` | administrador |
| GET | `/usuarios/eu` | logado |
| GET, POST | `/usuarios` | administrador |
| GET, PUT, DELETE | `/usuarios/:id` | o próprio ou administrador |
| PUT | `/usuarios/:id/senha` | o próprio |

## Como o login funciona (cookies e sessões)
| | Web (padrão, `"modo": "cookie"`) | Mobile (`"modo": "token"`) |
|---|---|---|
| Token de acesso | cookie `token_acesso` (HttpOnly, dura 15 min) | no corpo da resposta (`token`), enviado em `Authorization: Bearer` |
| Token de renovação | cookie `token_renovacao` (HttpOnly, Path `/api/autenticacao`, dura 7 dias) | no corpo (`refreshToken`); guarde no armazenamento seguro do aparelho |
| Renovar | `POST /autenticacao/renovar` (o cookie vai sozinho) | `POST /autenticacao/renovar` com `{ "modo": "token", "refreshToken": "..." }` |
| Sair | `POST /autenticacao/logout` (apaga os cookies) | `POST /autenticacao/logout` com `{ "modo": "token", "refreshToken": "..." }` |

- Cada login cria uma **sessão** (tabela `sessao`). O logout revoga a sessão: o token de acesso e o de renovação param de valer **na hora**.
- O token de renovação **gira a cada uso**. Se um token antigo for usado de novo (sinal de roubo), a sessão inteira é encerrada.
- No banco fica só o **hash** do token de renovação.
- **Trocar a senha** encerra as sessões dos outros aparelhos.
- **CSRF:** pedidos que alteram dados e usam cookie só são aceitos se o cabeçalho `Origin` estiver em `ORIGENS_PERMITIDAS`. Junto com `SameSite`, isso barra sites maliciosos.

### No front-end (web)
Todo `fetch` precisa de `credentials: 'include'` para o navegador enviar e receber os cookies:
```js
await fetch('http://localhost:3000/api/autenticacao/login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, senha })
});                                   // não guarde nada: os tokens ficam nos cookies

let r = await fetch('http://localhost:3000/api/usuarios/eu', { credentials: 'include' });
if (r.status === 401) {               // acesso venceu: tenta renovar UMA vez e repete o pedido
  const renovou = await fetch('http://localhost:3000/api/autenticacao/renovar', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}'
  });
  if (renovou.ok) r = await fetch('http://localhost:3000/api/usuarios/eu', { credentials: 'include' });
}
await fetch('http://localhost:3000/api/autenticacao/logout', {
  method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}'
});
```
Faça **uma renovação por vez** (duas abas renovando ao mesmo tempo com o mesmo token contam como reutilização e encerram a sessão).

Erros seguem o formato `{ "erro": { "codigo", "mensagem", "detalhes" } }`. Use `docs/requisicoes.http` (extensão REST Client do VS Code) para testar.

## Problemas comuns
| Sintoma | Solução |
|---|---|
| `403 VINCULO_PENDENTE` no painel do profissional | Conta em análise: a administração precisa vincular o profissional a uma creche (`PUT /admin/profissionais/:id/vinculo`). |
| `403` ao abrir um painel | Cada tipo só entra no próprio painel (o administrador também não entra nos outros). |
| `409 Não há vagas nesta data.` | A creche atingiu a capacidade do dia. Escolha outro dia ou outra creche. |
| `faltam tabelas` ao iniciar | Rode `npx prisma migrate deploy` (agora são 3 migrações). |
| `JWT_SEGREDO ausente ou curto demais` | Preencha `JWT_SEGREDO` no `.env` (mínimo 32 caracteres). |
| `DATABASE_URL ausente ou ainda com o valor de exemplo` | Cole a URL do Neon no `.env`. |
| `O Prisma Client não foi gerado` / erro ao iniciar | Rode `npx prisma generate`. |
| `as tabelas ainda não existem` | Rode `npx prisma migrate deploy`. |
| `Can't reach database server` (P1001) | URL errada ou Neon "acordando": tente de novo em alguns segundos. |
| `migrate deploy` falha com o pooler | Preencha `DIRECT_URL` com a URL *Direct* (sem `-pooler`). |
| Erro mencionando `channel_binding` | Remova `&channel_binding=require` da URL. |
| `/docs` dá 404 | A documentação está desligada (produção). Use `DOCS_ATIVADO=true` no `.env`. |
| Erro de CORS no navegador | Coloque o endereço do front em `ORIGENS_PERMITIDAS` e reinicie. |
| O cookie não é salvo/enviado | Use `credentials: 'include'` no `fetch`, e confira se o front está em `ORIGENS_PERMITIDAS`. No Safari em `http://localhost`, use `COOKIE_SECURE=false` só em desenvolvimento. |
| `403 Origem não autorizada` | O pedido com cookie veio de um site que não está em `ORIGENS_PERMITIDAS` (ou sem o cabeçalho `Origin`). |
| Front e API em domínios totalmente diferentes | Use `COOKIE_SAMESITE=none` (exige HTTPS) ou, melhor, coloque os dois no mesmo domínio raiz (`app.site.com` e `api.site.com`). |
| `429` no login | 5 erros de senha bloqueiam a conta por 15 min; há também limite por IP. |

## Observações
- `npm audit` aponta 4 avisos vindos do CLI do Prisma (ferramenta de desenvolvimento). O npm sugere rebaixar o Prisma para a v6, o que não recomendamos.
- Em produção use HTTPS (e `CONFIAR_PROXY=true` atrás de um proxy).
