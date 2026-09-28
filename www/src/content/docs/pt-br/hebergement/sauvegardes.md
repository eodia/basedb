---
title: Backups e atualizações
description: Fazer backup, restaurar e atualizar uma instância do basedb.
---

Todo o estado do basedb cabe em três coisas: **o banco PostgreSQL**, **os arquivos** dos campos
Arquivo e Imagem, e **a chave da instância**. Faça backup das três.

## O banco

Uma instância do basedb é um banco PostgreSQL comum: o `pg_dump` basta.

```bash
docker compose exec -T db pg_dump -U basedb -Fc basedb > basedb-$(date +%F).dump
```

Para restaurar, em um banco vazio:

```bash
docker compose exec -T db pg_restore -U basedb -d basedb --clean --if-exists < basedb-2026-09-26.dump
```

## Os arquivos

Com o armazenamento em disco, eles ficam no volume `files` do serviço `basedb`:

```bash
docker run --rm -v basedb_files:/data -v "$PWD":/backup alpine \
  tar czf /backup/basedb-files-$(date +%F).tgz -C /data .
```

Com um armazenamento S3, siga a política de backup do seu provedor (versionamento,
replicação).

## A chave da instância

`BASEDB_ENCRYPTION_KEY` criptografa os segredos salvos no banco (chaves de IA, segredos de
webhooks, links de formulários). **Um backup do banco sem a chave não restaura esses
segredos.** Guarde-a no seu gerenciador de segredos, junto com os backups.

## Atualizar

Primeiro faça backup do banco e depois:

```bash
docker compose pull
docker compose up -d
```

`BASEDB_VERSION` fixa uma versão específica (`0.3.2`) em vez da mais recente (`latest`).

Na inicialização, o basedb **atualiza o próprio catálogo sozinho**: ele aplica, em ordem e
cada uma na sua transação, as migrações que a sua versão ainda não tem, e as registra
em `_basedb.catalog_migration`. Seus dados ficam onde estão. O log informa isso:

```text
basedb-1  | [api] Catalogue : 0002_partage_et_comptes.sql appliquée (84 ms).
basedb-1  | [api] Catalogue mis à jour : version 2.
```

É possível pular versões: todas as migrações que faltam são aplicadas de uma vez, em
ordem. Uma migração que falha deixa o catálogo na versão anterior, intacto, e o
basedb não inicia: o log indica a migração e o erro.

**Não há volta.** Uma versão mais antiga se recusa a iniciar sobre um catálogo
que uma mais recente atualizou, em vez de escrever em um formato que ela desconhece. Para
voltar atrás, restaure o backup feito antes da atualização.

Com várias instâncias do basedb no mesmo banco, só uma atualiza o catálogo, e as
outras esperam. `BASEDB_MIGRATE=0` impede que uma instância faça a migração: ela só verifica
se o catálogo está na versão certa e, caso contrário, se recusa a iniciar.
