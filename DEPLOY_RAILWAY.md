# Implantação no Railway

## 1. Enviar o código

Substitua os arquivos do projeto pelos arquivos desta versão e faça o deploy normal.

## 2. Conferir variáveis

Use `.env.example` somente como lista de nomes. Não faça upload de um `.env` real.

As variáveis obrigatórias para Google Ads são:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_ADS_DEVELOPER_TOKEN`
- `GOOGLE_ADS_LOGIN_CUSTOMER_ID`
- os quatro `GOOGLE_ADS_CUSTOMER_ID_*`

O `GOOGLE_ADS_REFRESH_TOKEN` será obtido na primeira autorização.

## 3. Autorizar

1. Abra `https://ads.oticastgt.com.br`.
2. Acesse **Integrações**.
3. No bloco Google Ads, clique em **Autorizar Google Ads**.
4. Entre com o usuário que acessa o MCC.
5. Autorize o acesso solicitado.
6. Copie o refresh token mostrado na página de retorno diretamente para a variável `GOOGLE_ADS_REFRESH_TOKEN` no Railway.
7. Faça novo deploy.

## 4. Validar

No bloco Google Ads, o status deve mostrar **Conectado**, quatro contas e a versão da API. Clique em **Sincronizar** para carregar os últimos 30 dias.

Se uma loja falhar, o painel retorna o erro daquela conta sem descartar as demais.

## Segurança

- Não envie tokens por conversa ou print.
- Não grave segredos no GitHub.
- Mantenha `BASIC_AUTH_USER` e `BASIC_AUTH_PASSWORD` ativos.
- A integração não possui nenhuma operação de criação ou alteração de campanhas.
