---
title: Domínio e HTTPS
description: Servir o basedb em um domínio, em HTTPS, atrás do proxy Caddy fornecido.
---

Em produção, o basedb deve ser servido em **HTTPS**: seus cookies de sessão são `Secure` e
têm o prefixo `__Host-`, e um navegador só os aceita em HTTP em `localhost`.

A imagem já serve tudo em um único endereço — a interface, a API em `/api`, o servidor MCP
em `/mcp`. Só falta colocá-la atrás de um proxy HTTPS: o `docker-compose.yml`
fornece um, o **Caddy**, que obtém e renova sozinho seu certificado Let’s Encrypt.

## Configuração

1. Aponte o DNS do seu domínio para o servidor; abra as portas 80 e 443.
2. No `.env`:

   ```bash
   BASEDB_DOMAIN=basedb.example.com
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

3. Inicie com o perfil `https`:

   ```bash
   docker compose --profile https up -d
   ```

A porta 3000 continua publicada somente em `127.0.0.1`: todo o tráfego externo passa pelo Caddy.

## Por que essas variáveis

- `BASEDB_DOMAIN`: o domínio para o qual o Caddy solicita o certificado.
- `BASEDB_PUBLIC_URL`: o endereço de retorno de um login OIDC, comparado caractere por
  caractere com o registrado no provedor de identidade.
- O Caddy define `X-Forwarded-For` a partir do endereço real do visitante, e o basedb o mantém quando
  ele vem de uma rede privada: os limites de taxa da API (login, formulários compartilhados)
  passam então a contar por visitante.

## Outro proxy

Nginx, Traefik ou um balanceador de carga também servem: envie **todo** o tráfego do
domínio para a porta 3000 do contêiner, sem buffering das respostas (o servidor MCP e o
tempo real transmitem suas respostas à medida que são geradas), e garanta que o proxy **substitua**
`X-Forwarded-For` em vez de complementá-lo.
