---
title: Variáveis de ambiente
description: Todas as variáveis lidas pelo basedb e seus valores padrão.
---

Todas ficam no arquivo `.env`, ao lado do `docker-compose.yml`, que o `docker compose`
lê (o modelo completo e comentado é o `.env.example`). Com `docker run`, passe-as com `-e`. **Um valor vazio equivale a “não definido”.**

## Obrigatórias

| Variável | Função |
|---|---|
| `POSTGRES_PASSWORD` | senha do contêiner PostgreSQL |
| `BASEDB_ENCRYPTION_KEY` | chave da instância: assina as sessões, criptografa os segredos. `openssl rand -base64 32`, uma vez por todas |

## Banco de dados

| Variável | Padrão | Função |
|---|---|---|
| `POSTGRES_USER` | `basedb` | papel do PostgreSQL |
| `POSTGRES_DB` | `basedb` | banco PostgreSQL |
| `POSTGRES_PORT` | `5432` | porta publicada em 127.0.0.1 |
| `DATABASE_URL` | o contêiner `db` | um banco PostgreSQL 16+ seu |

## Primeira inicialização

| Variável | Padrão | Função |
|---|---|---|
| `BASEDB_MIGRATE` | `1` | aplica o catálogo em um banco vazio |
| `BASEDB_BOOTSTRAP` | `1` | prepara o primeiro administrador |
| `BASEDB_TENANT` | `t4z56fq` | referência do tenant, nas URLs da API |
| `BASEDB_ADMIN_EMAIL` | — | endereço do primeiro administrador, criado na inicialização; vazio, a primeira pessoa que abrir a interface o cria |
| `BASEDB_ADMIN_PASSWORD` | gerada, exibida uma vez | com `BASEDB_ADMIN_EMAIL`, a senha dele; se definida, é reaplicada ao administrador em **cada** inicialização: remova-a depois de entrar |

## Login com Google, Microsoft… (OIDC)

| Variável | Padrão | Função |
|---|---|---|
| `BASEDB_OIDC_PROVIDERS` | — | os provedores oferecidos, separados por vírgulas: `google,microsoft` |
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | — | o aplicativo registrado no provedor |
| `BASEDB_OIDC_<NOM>_ISSUER` | o de `google`, `gitlab` | o emissor OpenID Connect |
| `BASEDB_OIDC_<NOM>_LABEL`, `_SCOPES` | conforme o provedor | o nome do botão, os escopos solicitados |
| `BASEDB_OIDC_<NOM>_SIGNUP` | — | `off`: um primeiro login não cria conta |

Veja [Contas e login](/basedb/pt-br/hebergement/connexion/).

## Endereços

| Variável | Padrão | Função |
|---|---|---|
| `BASEDB_PORT` | `3000` | porta publicada em 127.0.0.1: a interface, `/api` e `/mcp` |
| `BASEDB_VERSION` | `latest` | a tag da imagem `eodia/basedb` |
| `BASEDB_PUBLIC_URL` | — | endereço público do basedb, para o retorno OIDC |
| `BASEDB_DOMAIN` | — | o domínio servido em HTTPS pelo proxy Caddy |
| `BASEDB_ORIGINS` | — | outros sites cujas páginas chamam a API pelo navegador, separados por vírgulas; desnecessário para a interface do basedb, servida no mesmo endereço |
| `BASEDB_API`, `BASEDB_MCP` | `/`, `/mcp` | a API e o MCP vistos pelo navegador; ajuste apenas para o ambiente de desenvolvimento (`pnpm start`) |

## Arquivos

| Variável | Padrão | Função |
|---|---|---|
| `BASEDB_FILES_MAX_MB` | `25` | tamanho máximo de um arquivo |
| `BASEDB_S3_BUCKET` | — | ativa o armazenamento S3 |
| `BASEDB_S3_ENDPOINT` | — | endpoint S3 |
| `BASEDB_S3_REGION` | `us-east-1` | região |
| `BASEDB_S3_ACCESS_KEY_ID`, `BASEDB_S3_SECRET_ACCESS_KEY` | — | credenciais |
| `BASEDB_S3_FORCE_PATH_STYLE` | `1` | `0` para o endereçamento por host |

## Modelos de base

| Variável | Padrão | Função |
|---|---|---|
| `BASEDB_TEMPLATES_URL` | o catálogo do site público | de onde a instância lê os modelos da galeria; `off` para não ler nenhum (os modelos integrados permanecem) — veja [Modelos](/basedb/pt-br/fonctionnalites/modeles/) |

## Inteligência artificial

| Variável | Padrão | Função |
|---|---|---|
| `BASEDB_AI_PROVIDER` | — | `openai`, `anthropic` ou `mistral` |
| `BASEDB_AI_MODEL` | — | o modelo |
| `BASEDB_AI_API_KEY` | — | a chave (senão `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`) |
| `BASEDB_AI_QUOTA` | `120` | chamadas interativas por hora e por tenant |
| `BASEDB_AI_FIELD_QUOTA` | `300` | cálculos de campos de IA por hora e por tenant |
| `BASEDB_AI_WORKER` | `1` | `0`: nenhum cálculo em segundo plano neste processo |

## Somente desenvolvimento

| Variável | Função |
|---|---|
| `BASEDB_DEV_MAIL=1` | exibe os e-mails nos logs em vez de enviá-los |
| `BASEDB_WEBHOOK_DEV=1` | permite webhooks para HTTP e endereços locais |
