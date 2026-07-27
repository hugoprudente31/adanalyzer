# adAnalyzer OS — CRM module (Phase 1)

Primeiro módulo do "adAnalyzer OS": um serviço NestJS + TypeScript + Prisma, **read-only**, que reimplementa a mesma capacidade real já existente em [`src/services/kommoDb.service.js`](../../src/services/kommoDb.service.js) (na raiz do repositório), mas com arquitetura em camadas (Controller/Service/Repository/DTO/Entity) — o padrão que os próximos módulos (Financeiro, Estoque, Laboratório...) vão seguir.

**Fase 1 de uma migração strangler-fig**: este serviço é uma implementação paralela dos mesmos dados reais, servida numa URL própria. Ele **não substitui** o app Express hoje — as rotas `/api/kommo/*` e a UI em `/studio` continuam sendo o caminho real de produção até uma fase futura decidir migrar o consumo pra cá.

## O que este serviço faz (e o que não faz)

- Lê as tabelas `kommo_pipelines`, `kommo_pipeline_statuses`, `kommo_contacts`, `kommo_leads` do **mesmo Postgres** já usado pelo app Express.
- **Não escreve nada.** Quem sincroniza os dados do Kommo continua sendo exclusivamente `src/jobs/syncKommoData.js` (cron diário 03:45 + trigger manual via `POST /api/kommo/sync` no app Express). Este serviço não tem endpoint de sync.
- **Não está ligado ao domínio público.** `ads.oticastgt.com.br` não muda. Este serviço só é acessível pela URL própria que o Railway atribuir a ele.

## Fora de escopo nesta fase (e por quê)

| Item | Por quê fica de fora agora |
|---|---|
| RBAC / autenticação multi-usuário | Decisão consciente: o primeiro módulo devia ser de negócio real, não infraestrutura de auth. Ver `ApiKeyGuard` abaixo — é um placeholder deliberado. |
| GraphQL / WebSocket / BullMQ / Redis | Nenhuma necessidade real ainda: 6 endpoints de leitura, sem job assíncrono próprio. Adicionar isso agora seria infraestrutura especulativa. |
| Receitas, Exames, Compras, Score de compra, Score IA | Não existe ERP/POS/exame integrado em lugar nenhum do sistema hoje. Mostrar isso agora significaria inventar dado — a regra que seguimos a sessão inteira é nunca mostrar dado fake. Entram quando houver uma fonte real. |
| Escrita de volta pro Kommo | Este módulo é estritamente leitura, igual ao `kommoDb.service.js` original. |

## Arquitetura

```
src/
├── main.ts                  # bootstrap, ValidationPipe, filtro de erro, interceptor de resposta
├── app.module.ts
├── health/                  # GET /health — sem auth, alvo do healthcheck do Railway
├── prisma/                  # PrismaService/PrismaModule — conexão única e global
├── common/
│   ├── guards/api-key.guard.ts          # autenticação deste serviço (ver seção Auth)
│   ├── filters/http-exception.filter.ts # { success:false, error }
│   ├── interceptors/response-envelope.interceptor.ts # { success:true, data }
│   └── dto/date-range-query.dto.ts      # ?since=&until= com validação
└── crm/
    ├── controllers/   # 1 controller por endpoint (status, funnel, leads, dashboard, pipelines)
    ├── services/      # regra de negócio, orquestra repositórios
    ├── repositories/  # única camada que fala com o Prisma
    ├── entities/      # KommoPipelineStatusEntity (isWon/isLost) e KommoLeadSummaryEntity
    │                  # (isHot/isAtRisk) — a única lógica de negócio real deste módulo
    ├── constants/      # WON_PATTERN/LOST_PATTERN, portados verbatim do original
    └── dto/            # formato de resposta de cada endpoint
```

### Por que `kommo_leads.status_id`/`pipeline_id`/`main_contact_id` não são relações do Prisma

Essas colunas não têm foreign key no banco real (confirmado em `ensureSchema()` de `src/jobs/syncKommoData.js`). Em vez de forçar uma relação do Prisma contra uma chave que o banco não garante, os JOINs que precisam disso (`funnel`, `dashboard/summary`, `pipelines/:id/board`) usam `$queryRaw` com o SQL exato do `kommoDb.service.js` original — ver `src/crm/repositories/kommo-lead.repository.ts`.

### Prisma 6, não 7

O `prisma.config`/adapter-obrigatório do Prisma 7 (datasource `url` não é mais aceito direto no schema) foi avaliado e descartado pra esta fase — adicionaria complexidade (driver adapter, `prisma.config.ts`) sem benefício real pra um serviço de leitura simples. Prisma 6.x ainda suporta o padrão clássico `datasource { url = env(...) }`, mais simples e mais documentado. Reavaliar quando houver motivo real pra migrar.

## Autenticação

Um único guard (`ApiKeyGuard`) checa o header `x-api-key` contra `CRM_SERVICE_API_KEY`, com comparação em tempo constante — mesma técnica do `safeEqual()` em `src/middleware/security.js` (Basic Auth do app Express). **Isso não é RBAC** — não há identidade de usuário nem papéis, é um placeholder até o módulo de permissões (fora de escopo aqui). Use um segredo **próprio e novo**, não reaproveite o `ADANALYZER_SYNC_KEY` do app Express (é de outra integração).

`GET /health` fica público, sem guard — é o alvo do healthcheck do Railway, que não envia headers customizados.

## Endpoints

Prefixo: `api/crm/v1`. Todos exigem `x-api-key`, exceto `/health`.

| Método | Rota | Porta de |
|---|---|---|
| GET | `/health` | novo |
| GET | `/api/crm/v1/status` | `getSyncStatus()` |
| GET | `/api/crm/v1/funnel?since=&until=` | `getFunnelSummary()` |
| GET | `/api/crm/v1/leads/by-source?since=&until=` | `getLeadsByUtmSource()` |
| GET | `/api/crm/v1/dashboard/summary` | `getDashboardSummary()` |
| GET | `/api/crm/v1/pipelines` | `getPipelinesWithStages()` |
| GET | `/api/crm/v1/pipelines/:id/board?sampleSize=25` | `getPipelineBoard()` |

Exemplo:

```bash
curl -H "x-api-key: $CRM_SERVICE_API_KEY" \
  "https://<url-do-servico>.up.railway.app/api/crm/v1/dashboard/summary"
```

**Diferença consciente de comportamento**: `GET /pipelines/:id/board` devolve `404` quando o `pipelineId` não corresponde a nenhum lead real (o serviço original só devolvia `null`/404 se a tabela inteira não existisse — cenário que não se aplica aqui, já que o schema do Prisma pressupõe a tabela existente).

## Rodando localmente

```bash
cd services/crm
npm install
cp .env.example .env   # preencher DATABASE_URL (mesmo Postgres do app Express) e CRM_SERVICE_API_KEY
npm run prisma:generate
npm run start:dev
```

## Testes

```bash
npm test
```

4 arquivos, cobrindo a lógica de negócio real do módulo (classificação won/lost, limites hot/at-risk, mapeamento de resposta, autenticação) — repositório sempre mockado, sem banco real no teste.

## Deploy

Novo serviço Railway **dentro do projeto `adanalyzer` já existente**, com Root Directory = `services/crm`. `DATABASE_URL` via referência cross-service do Railway (mesmo Postgres, sem copiar segredo). Builder Nixpacks.

**Este serviço não é criado/deployado automaticamente** — é um recurso novo (mesmo padrão de quando criamos o Postgres extra nesta sessão), então fica pendente de confirmação explícita antes do primeiro `railway up`.
