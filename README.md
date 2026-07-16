# AdAnalyzer — Óticas TGT

Painel de anúncios com integração segura e somente leitura para Meta Ads e Google Ads.

## Google Ads

A versão 1.1 adiciona:

- OAuth 2.0 executado no servidor;
- suporte ao MCC `3629216923`;
- consulta consolidada das contas Target, Enseada, Gonzaga e Pitangueiras;
- métricas de campanha dos últimos 30 dias;
- custo, impressões, cliques, conversões, valor de conversão, CTR, CPC, CPA e ROAS;
- segredos mantidos no Railway, sem armazenamento no HTML ou localStorage;
- consultas exclusivamente de leitura.

## Variáveis necessárias no Railway

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=https://ads.oticastgt.com.br/auth/google/callback
GOOGLE_ADS_DEVELOPER_TOKEN
GOOGLE_ADS_REFRESH_TOKEN
GOOGLE_ADS_LOGIN_CUSTOMER_ID=3629216923
GOOGLE_ADS_CUSTOMER_ID_TARGET=5679539198
GOOGLE_ADS_CUSTOMER_ID_ENSEADA=1420756198
GOOGLE_ADS_CUSTOMER_ID_GONZAGA=9212873095
GOOGLE_ADS_CUSTOMER_ID_PITANGUEIRAS=4121362472
GOOGLE_ADS_API_VERSION=v24
```

Nunca grave valores secretos no GitHub. `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_ADS_DEVELOPER_TOKEN` devem existir somente nas variáveis protegidas do Railway.

## Primeira autorização

1. Faça o deploy.
2. Abra **Integrações → Google Ads**.
3. Clique em **Autorizar Google Ads**.
4. Autorize com o usuário que possui acesso ao MCC.
5. Se a página de retorno mostrar um refresh token, copie-o diretamente para `GOOGLE_ADS_REFRESH_TOKEN` no Railway e faça novo deploy.
6. Volte ao painel e clique em **Sincronizar**.

## Endpoints

- `GET /api/google-ads/status`: mostra apenas o estado da configuração, nunca os segredos.
- `GET /auth/google-ads`: inicia o OAuth com o escopo `adwords`.
- `GET /auth/google-ads/callback`: recebe a autorização do Google.
- `GET /api/google-ads/campaigns`: consulta as quatro contas e consolida campanhas.

Quando `BASIC_AUTH_USER` e `BASIC_AUTH_PASSWORD` estiverem definidos, as rotas do Google Ads exigem autenticação administrativa.
