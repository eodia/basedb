---
title: Docker Compose
description: A imagem, os serviços, os volumes e a operação do dia a dia.
---

O basedb é publicado em **uma única imagem**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb),
para amd64 e arm64. O `docker-compose.yml` do repositório a combina com o PostgreSQL. Toda a
configuração passa por um arquivo `.env` (veja
[Variáveis de ambiente](/basedb/pt-br/hebergement/variables/)).

## A imagem

Ela contém os três processos do basedb e os serve em **uma única porta, 3000**:

| Caminho | Processo |
|---|---|
| `/api/*`, `/auth/*`, `/healthz` | a API REST, o login, o trabalho em segundo plano |
| `/mcp` | o servidor MCP, para os agentes |
| todo o resto — `/`, `/f/…`, `/v/…` | a interface |

Na inicialização, a API vai primeiro: em um banco vazio, ela aplica o catálogo e cria o
primeiro administrador; nas inicializações seguintes, as duas coisas não têm efeito. O servidor MCP inicia
assim que ela responde. Se um dos processos parar, o contêiner inteiro para, e a política
de reinicialização o reinicia inteiro.

A imagem roda com o usuário `node`, no Node 22, declara uma verificação de saúde
(`/healthz`) e um volume, `/data`, para os arquivos dos campos Arquivo e Imagem.

| Tag | Conteúdo |
|---|---|
| `latest` | a última versão publicada |
| `0.6` | a última versão 0.6.x |
| `0.6.1` | exatamente esta versão |

## Os serviços

| Serviço | Imagem | Porta (em 127.0.0.1) | Volume |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | `db-data` |
| `basedb` | `eodia/basedb` | 3000 | `files` → `/data` |
| `proxy` (opcional) | `caddy:2-alpine` | 80, 443 | `caddy-data`, `caddy-config` |

## Comandos úteis

```bash
docker compose up -d                # baixar a imagem e iniciar
docker compose logs -f basedb       # acompanhar o basedb (senha do admin na 1ª inicialização)
docker compose ps                   # estado e saúde dos serviços
docker compose restart basedb       # reiniciar o basedb
docker compose down                 # parar (os volumes permanecem)
```

A partir de um clone do repositório, `docker compose up -d --build` constrói a imagem a partir do código
em vez de baixá-la.

## Atrás de um gateway, sob um caminho

Quando o basedb é publicado sob um caminho — `https://passerelle.example.com/basedb/` em vez de
na raiz de um domínio —, indique esse caminho:

```bash
BASEDB_PUBLIC_URL=https://passerelle.example.com/basedb
# ou, sem endereço público:
BASEDB_BASE_PATH=/basedb
```

Tudo passa então sob `/basedb`: a interface, `/basedb/api`, `/basedb/mcp`, os links de
compartilhamento e os dos e-mails. O gateway pode **manter o caminho** ao repassar a
requisição, ou **retirá-lo**: o basedb aceita os dois. `BASEDB_BASE_PATH=/` força a raiz.

A imagem é a mesma para todos os endereços: o caminho é escrito na interface na
inicialização do contêiner, e mudar de caminho só exige uma reinicialização.

## Mudar as portas

```bash
BASEDB_PORT=3100
POSTGRES_PORT=5433
```

## Um banco PostgreSQL existente

Defina `DATABASE_URL`: o basedb se conecta a ele em vez do contêiner `db` (que inicia mesmo assim,
sem uso — remova-o em um arquivo `docker-compose.override.yml` se preferir). É preciso
PostgreSQL 16 ou superior, um papel proprietário do banco e as extensões `pg_trgm` e `unaccent`
disponíveis. A imagem sozinha basta então — veja [Instalação](/basedb/pt-br/guides/installation/).
