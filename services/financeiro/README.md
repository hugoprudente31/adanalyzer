# adAnalyzer OS — Financeiro module (Phase 1)

Segundo módulo do "adAnalyzer OS", no mesmo molde do [`services/crm`](../crm): NestJS + TypeScript + Prisma, **read-only**, coexistindo com o app Express na raiz do repositório.

## De onde vem o dado real (e por que não é óbvio)

O dado real de venda **não vive no adanalyzer**. Ele está na tabela `agendamentos` de um projeto Railway completamente separado — o "sistema de agendamento 7.2" — misturado com os campos de agendamento (não é uma tabela financeira dedicada).

Antes de chegar nisso, investiguei a tabela `faturamentos` desse mesmo banco, que tem a cara certa (loja, vendedor, valor_total, forma_pagamento, status_pagamento) — mas está **vazia**, só um registro de teste ("Loja Teste", "Vendedor Teste"). `metas_desempenho`, `agendamento_negociacao` e `historico_os` também estão vazias. Nenhuma delas é usada.

`src/jobs/syncFinanceiro.js` (na raiz do repositório) sincroniza diariamente as colunas financeiro-relevantes de `agendamentos` (filtrando `excluido_em IS NULL`) para a tabela `financeiro_vendas` no Postgres do próprio adanalyzer — este módulo só lê essa cópia local, nunca acessa o outro projeto diretamente.

**Importante**: não existe campo de forma/status de pagamento no dado real (só existia na `faturamentos` morta) — por isso este módulo cobre **Receita**, não fluxo de caixa ou conciliação de pagamento.

## Fora de escopo nesta fase (e por quê)

| Item | Por quê |
|---|---|
| **Lucro / Margem** | Não existe custo real (folha, aluguel, CMV) em lugar nenhum do sistema. Subtrair o gasto de anúncio da receita e chamar de "lucro" seria enganoso — nunca fazer essa conta. O endpoint de comparativo devolve receita e gasto de anúncio como dois números separados, nunca subtraídos (testado em `comparativo.service.spec.ts` como trava de regressão). |
| **Fluxo de caixa / conciliação de pagamento** | Sem campo de forma/status de pagamento no dado real. |
| **Metas / Projeções** | `metas_desempenho` existe no banco de origem mas está vazia (0 linhas). |
| **RBAC / autenticação multi-usuário** | Mesma decisão do módulo CRM — `ApiKeyGuard` é um placeholder. |
| **GraphQL / WebSocket / BullMQ / Redis** | Sem necessidade real ainda. |
| Escrita de volta no banco do "sistema de agendamento", em `faturamentos` ou `metas_desempenho` | Este módulo (e o job de sync) são estritamente leitura. |

## Arquitetura

```
src/
├── main.ts, app.module.ts
├── health/                  # GET /health — sem auth
├── prisma/                  # PrismaService/PrismaModule
├── common/                  # guard/filter/interceptor/dto — mesmo padrão do services/crm
└── financeiro/
    ├── controllers/         # vendas.controller.ts, comparativo.controller.ts
    ├── services/            # vendas.service.ts, comparativo.service.ts
    ├── repositories/
    │   ├── vendas.repository.ts    # Prisma model direto (financeiro_vendas tem PK simples)
    │   └── ad-spend.repository.ts  # $queryRaw nas tabelas de marketing (fora do domínio deste módulo)
    └── dto/
```

Sem pasta `entities/` (diferente do CRM) — a única lógica de negócio real aqui é "desconto médio calculado só sobre vendas com desconto > 0" e "ticket médio sem NaN/Infinity quando não há vendas", cobertas como métodos testáveis dentro dos services, sem justificar uma camada de domínio própria.

### Tabelas de marketing não são modeladas no Prisma

`googleads_custom_report_banco_de_dados` e `facebook_campaign_insights` vivem no mesmo Postgres (replicadas pelo Kondado) mas pertencem a outro domínio — não entram em `schema.prisma` (mesma decisão do módulo CRM), são lidas via `$queryRaw` em `ad-spend.repository.ts`, reaproveitando as mesmas queries já usadas e verificadas em `src/services/marketingDb.service.js` na raiz do repositório.

## Autenticação

`ApiKeyGuard` — header `x-api-key` contra `FINANCEIRO_SERVICE_API_KEY`, comparação em tempo constante. Segredo **próprio e novo**, não reaproveitar `CRM_SERVICE_API_KEY` nem `ADANALYZER_SYNC_KEY`.

## Endpoints

Prefixo: `api/financeiro/v1`. Todos exigem `x-api-key`, exceto `/health`.

| Método | Rota | O que devolve |
|---|---|---|
| GET | `/health` | status de conexão, sem auth |
| GET | `/api/financeiro/v1/vendas/resumo?since=&until=` | receita total, qtd de vendas, ticket médio |
| GET | `/api/financeiro/v1/vendas/por-loja?since=&until=` | receita agrupada por loja |
| GET | `/api/financeiro/v1/vendas/por-vendedor?since=&until=&agrupar=vendedor\|consultor` | receita agrupada por vendedor ou consultor responsável |
| GET | `/api/financeiro/v1/vendas/descontos?since=&until=` | total e média de desconto (só sobre vendas com desconto > 0) |
| GET | `/api/financeiro/v1/comparativo/receita-vs-anuncios?since=&until=` | receita real e gasto real de anúncio (Google + Facebook), nunca subtraídos |
| GET | `/api/financeiro/v1/vendas?since=&until=&page=&limit=` | listagem paginada |

Exemplo:

```bash
curl -H "x-api-key: $FINANCEIRO_SERVICE_API_KEY" \
  "https://<url-do-servico>.up.railway.app/api/financeiro/v1/vendas/resumo"
```

## Rodando localmente

```bash
cd services/financeiro
npm install
cp .env.example .env   # preencher DATABASE_URL (mesmo Postgres do app Express) e FINANCEIRO_SERVICE_API_KEY
npm run prisma:generate
npm run start:dev
```

## Testes

```bash
npm test
```

11 testes cobrindo: autenticação (guard), ticket médio (incl. 0 vendas sem NaN), agrupamento com bucket "Não informado" pra loja nula/vazia, desconto médio só sobre vendas com desconto, e uma trava de regressão garantindo que a resposta do comparativo nunca ganha um campo `lucro`/`margem`.

## Deploy

Mesmo padrão do CRM: novo serviço Railway dentro do projeto `adanalyzer`, Root Directory `services/financeiro`, `DATABASE_URL` via referência cross-service, sem domínio público. **Não é criado/deployado automaticamente** — fica pendente de confirmação explícita antes do primeiro `railway up`.
