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

## E-mails

Sem servidor de envio, o basedb não envia nenhum e-mail. Com ele, partem as notificações que
ficam dez minutos sem serem lidas (cada um escolhe quais em **Configurações › Notificações**), os
e-mails da etapa **Enviar um e-mail** das automações, e o link de uma **senha esquecida**. Os
links apontam para `BASEDB_PUBLIC_URL`; sem ela, um e-mail não leva nenhum.

| Variável | Padrão | Função |
|---|---|---|
| `BASEDB_SMTP_HOST` | — | o servidor SMTP: o do seu provedor de e-mail ou de um serviço de envio |
| `BASEDB_SMTP_PORT` | `587` | `465` para uma conexão já criptografada |
| `BASEDB_SMTP_SECURE` | `starttls` (`tls` na porta 465) | `none` somente para um retransmissor na mesma máquina: caso contrário, a senha passaria em texto claro |
| `BASEDB_SMTP_USER`, `BASEDB_SMTP_PASSWORD` | — | o identificador da conta de envio, se ela exigir um |
| `BASEDB_MAIL_FROM` | — | obrigatória com `BASEDB_SMTP_HOST`: o remetente, `basedb <no-reply@exemple.fr>` |

Ao iniciar, o registro informa a situação: `Courriels : SMTP smtp.exemple.fr:587 (starttls),
expéditeur no-reply@exemple.fr.` Um e-mail que o servidor recusa é retentado 1, 5, 30, 120 e depois
360 minutos depois.

## Mapas e endereços

A visão **Mapa** posiciona um endereço graças a um serviço de geocodificação: o do OpenStreetMap
(Nominatim) por padrão, consultado uma vez por endereço, no máximo uma solicitação por segundo,
cada resposta guardada. O mapa de fundo é feito de **blocos** (tiles) que o navegador de cada
leitor carrega diretamente.

| Variável | Padrão | Função |
|---|---|---|
| `BASEDB_GEOCODER_URL` | `https://nominatim.openstreetmap.org` | outro serviço que fala o mesmo protocolo (um Nominatim seu); `off`: nenhum, os endereços não saem da instância e só a latitude e a longitude posicionam as linhas |
| `BASEDB_MAP_TILES` | os blocos do OpenStreetMap | outro servidor de blocos, modelo `https://…/{z}/{x}/{y}.png` |
| `BASEDB_MAP_ATTRIBUTION` | `© OpenStreetMap` | a menção que esse servidor exige, no canto inferior direito do mapa |

Ao iniciar, o registro informa qual serviço é usado: `Géocodage : https://nominatim.openstreetmap.org.`

## Documentos PDF

| Variável | Padrão | Função |
|---|---|---|
| `BASEDB_PDF_FONTS` | as fontes Noto da imagem | uma pasta sua, montada no contêiner, que contém `NotoSans-Regular.ttf`, `-Bold`, `-Italic`, `-BoldItalic`, e para o chinês, o japonês e o coreano `NotoSansCJK-Regular.ttc` e `-Bold.ttc` |

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

## Demonstração pública

Uma instância aberta a todos, como [demo.basedb.eodia.com](https://demo.basedb.eodia.com): a tela
de login preenche antecipadamente uma conta compartilhada, o visitante lê tudo e modifica o que já
existe, mas não cria nem exclui nada — base, tabela, linha, arquivo, comentário, conta, token,
link —, e a IA responde que não faz parte da demonstração. O console SQL só lê ali. Deixar a base
de volta ao estado inicial todas as noites continua sendo responsabilidade sua.

| Variável | Padrão | Função |
|---|---|---|
| `BASEDB_DEMO` | — | `1`: a instância se torna uma demonstração pública |
| `BASEDB_DEMO_ACCOUNTS` | — | uma conta por idioma, separadas por vírgulas: `fr=demo@demo.com,en=demo-en@demo.com`; a tela de login preenche antecipadamente a do idioma dela, senão o inglês, senão a primeira, e oferece as outras. Crie essas contas, cada uma com seu projeto, antes de ativar a demonstração: ela recusa as criações para todos, administrador incluído |
| `BASEDB_DEMO_PASSWORD` | — | com `BASEDB_DEMO_ACCOUNTS`, a senha delas, a mesma para todas, publicada com elas |

Sem `BASEDB_DEMO_ACCOUNTS`, a conta compartilhada é o administrador nomeado por
`BASEDB_ADMIN_EMAIL` e `BASEDB_ADMIN_PASSWORD`. Um endereço da demonstração entra com a senha
publicada, seja o que for digitado: tentativas erradas não a bloqueiam para todo mundo.

## Somente desenvolvimento

| Variável | Função |
|---|---|
| `BASEDB_DEV_MAIL=1` | exibe os e-mails nos logs em vez de enviá-los |
| `BASEDB_WEBHOOK_DEV=1` | permite webhooks para HTTP e endereços locais |
