---
title: Instalação
description: Instalar o basedb com Docker Compose ou iniciar o ambiente de desenvolvimento.
---

O basedb cabe em **uma única imagem Docker**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb)
(amd64 e arm64): a **interface**, a **API** e o **servidor MCP**, servidos em um único
endereço. Ela precisa de um banco **PostgreSQL 16**, que o `docker-compose.yml` fornece.

## Com Docker Compose (recomendado)

Pré-requisitos: Docker com Compose v2. Dois arquivos bastam, sem precisar do código:

```bash
mkdir basedb && cd basedb
curl -fsSLO https://raw.githubusercontent.com/eodia/basedb/main/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/eodia/basedb/main/.env.example -o .env
```

Abra o `.env` e preencha os dois únicos valores obrigatórios:

```bash
POSTGRES_PASSWORD=un-mot-de-passe-solide
# gerada uma vez por todas: openssl rand -base64 32
BASEDB_ENCRYPTION_KEY=…
```

Depois, inicie:

```bash
docker compose up -d
```

Na primeira inicialização, o basedb cria o catálogo. Em seguida, abra
[http://localhost:3000](http://localhost:3000): a primeira página pede que você **crie a
conta de administrador**, com seu nome, seu endereço de e-mail e a senha que escolher, e
você já entra conectado em seguida.

:::caution[A primeira visita cria o administrador]
Enquanto não existir nenhum administrador, a primeira pessoa que abrir a interface o cria.
Crie-o **antes** de tornar a instância acessível a outras pessoas — em um domínio ou com uma
porta publicada em todas as interfaces.
:::

Para uma instalação sem intervenção, indique o administrador no `.env` com
`BASEDB_ADMIN_EMAIL`: o basedb o cria na primeira inicialização e exibe a senha dele **uma
única vez** nos seus logs (`docker compose logs basedb`), a menos que você a defina
com `BASEDB_ADMIN_PASSWORD`.

| Endereço | Função |
|---|---|
| http://localhost:3000 | a interface |
| http://localhost:3000/api | a API REST e sua documentação |
| http://localhost:3000/mcp | o servidor MCP, para os agentes |
| localhost:5432 | PostgreSQL, para o `psql` e suas ferramentas |

As portas são publicadas somente em `127.0.0.1`. Para servir o basedb em um domínio, veja
[Domínio e HTTPS](/basedb/pt-br/hebergement/https/).

## Com o seu próprio PostgreSQL

A imagem sozinha basta, com um banco PostgreSQL 16 ou superior (papel proprietário do banco,
extensões `pg_trgm` e `unaccent` disponíveis):

```bash
docker run -d --name basedb -p 3000:3000 -v basedb-files:/data \
  -e DATABASE_URL=postgres://basedb:secret@db.example.com:5432/basedb \
  -e BASEDB_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  eodia/basedb
```

Guarde a chave gerada: veja o quadro abaixo.

:::caution[A chave da instância]
`BASEDB_ENCRYPTION_KEY` assina as sessões e criptografa os segredos salvos (chaves de IA,
segredos de webhooks, cabeçalhos secretos das automações, links de formulários). Alterá-la
desconecta todo mundo e torna esses segredos ilegíveis. Gere-a uma vez e faça backup dela
junto com o banco.
:::

## Para desenvolver

Pré-requisitos: Node 22 ou superior, Docker e `corepack enable`.

```bash
corepack pnpm install
corepack pnpm exec tsc -b packages/naming packages/contracts packages/catalog-schema packages/core apps/api apps/mcp
corepack pnpm start
```

`pnpm start` escolhe portas livres, inicia um PostgreSQL 16 descartável, aplica o catálogo,
cria um administrador de desenvolvimento (`admin@basedb.local` / `developpement-basedb`,
endereço pré-preenchido no login) e depois inicia a API, o servidor MCP e a interface em modo
de desenvolvimento. `Ctrl+C` encerra tudo, incluindo o contêiner.

## E depois?

- [Primeiros passos](/basedb/pt-br/guides/premiers-pas/): uma base, uma tabela, uma visão, um formulário.
- [Variáveis de ambiente](/basedb/pt-br/hebergement/variables/): arquivos, IA, endereços.
