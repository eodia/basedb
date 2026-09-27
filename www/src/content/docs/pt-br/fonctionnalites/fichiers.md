---
title: Arquivos
description: Os campos Arquivo e Imagem, em disco ou em um armazenamento compatível com S3.
---

Os campos **Arquivo** e **Imagem** aceitam arquivos. Os bytes **não vão para o
PostgreSQL**: a coluna guarda o necessário para listá-los (identificador, nome, tipo, tamanho),
e os próprios arquivos ficam em um armazenamento dedicado, servidos por links assinados.

## Em disco

Por padrão, a API grava os arquivos em um diretório — na imagem Docker, o volume
`files` montado em `/data/files`. Isso basta para um único host; na inicialização, a API informa para onde vão
os arquivos.

## Em um armazenamento compatível com S3

AWS, Scaleway, OVH, Cloudflare R2, Garage, SeaweedFS, MinIO…:

```bash
BASEDB_S3_BUCKET=basedb
BASEDB_S3_ENDPOINT=https://s3.fr-par.scw.cloud
BASEDB_S3_REGION=fr-par
BASEDB_S3_ACCESS_KEY_ID=…
BASEDB_S3_SECRET_ACCESS_KEY=…
# BASEDB_S3_FORCE_PATH_STYLE=0   para o endereçamento por host
```

Se `BASEDB_S3_BUCKET` estiver definido sem os outros valores, a API se recusa a iniciar e informa
quais estão faltando.

## Tamanho

`BASEDB_FILES_MAX_MB` limita o tamanho de um arquivo (25 MB por padrão).

:::note
Os formulários compartilhados por um link não fazem as perguntas Arquivo e Imagem: eles
não abrem o envio de arquivos para desconhecidos.
:::
