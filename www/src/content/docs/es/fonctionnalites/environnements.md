---
title: Entornos
description: Producción, preproducción, desarrollo; comparar, migrar, sincronizar.
---

Una base puede tener **entornos**: producción, preproducción, desarrollo… Cada uno es una
base completa (su esquema, sus tablas, sus filas, sus permisos) y todos comparten el
**linaje** de la base, de sus tablas y de sus campos.

## En la interfaz

La barra lateral muestra **una entrada por base**, con una insignia que indica el entorno abierto y
permite cambiarlo. La insignia no aparece mientras solo exista la producción.

Los entornos se añaden, cambian de nombre y se eliminan en **Editar la base…**: un
entorno nuevo nace de una **copia de la estructura** de otro, sin sus filas.

## Comparar los entornos

Desde el menú de la base, en **Más acciones**, **Comparar los entornos…** abre un diálogo:

- **Estructura**: los entornos en columnas, tablas y campos en filas; lo que difiere de
  la producción aparece resaltado.
- **Aplicar las migraciones…** prepara el plan para pasar de un entorno a otro, etapa
  por etapa. Nunca marca de oficio lo que anularía un cambio más reciente en el
  destino.
- **Sincronización de filas**: tabla por tabla, trasladar filas de un entorno a
  otro, por identificador.

![Comparar la producción y la preproducción](../../../../assets/screens/es/environnements.webp)

## Cómo sabe basedb quién ha cambiado qué

La comparación se apoya en el **historial de estructuras**: cada creación, modificación o
eliminación de una tabla o un campo la captura un disparador sobre el catálogo, y se consulta en
la pestaña «Estructura» del historial. Los identificadores de linaje vinculan un campo de preproducción
con su homólogo de producción, aunque se le haya cambiado el nombre.

## Por la API, el SDK y el MCP

Un **token creado para toda la base** abre todos sus entornos, los de hoy y los que se añadan
después: un solo token para la producción y la preproducción. El programa o el agente elige el
entorno en cada llamada:

| Dónde | Cómo |
|---|---|
| [API REST](/basedb/es/integrations/api-rest/#elegir-el-entorno) | la cabecera `X-Basedb-Environment: recette`, o `?environment=recette` |
| [SDK](/basedb/es/integrations/sdk/#los-entornos) | `db.environment('recette')` |
| [MCP](/basedb/es/integrations/mcp/#elegir-el-entorno) | la dirección `…/mcp?environment=recette`, o el argumento `environment` de una herramienta |
| [n8n](/basedb/es/integrations/n8n/#las-credenciales) | el campo **Environment** de la credencial |

Sin nada de esto, cada base designa su propio entorno: el nombre de la producción abre la
producción, el de la preproducción abre la preproducción. Un token también puede, al crearlo, limitarse
al entorno que se muestra: entonces no ve ningún otro. En ambos casos, sus permisos se cruzan,
entorno por entorno, con los de la persona que lo creó.

## En SQL

Cada entorno es un esquema: `b_t4z56fq_ventes` para la producción,
`b_t4z56fq_ventes_recette` para la preproducción. Tus consultas cambian de entorno cambiando
de esquema, o de `search_path`.
