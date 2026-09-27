---
title: Principios
description: Las decisiones que rigen la arquitectura de basedb.
---

basedb se diseñó a partir de un **documento de arquitectura**: dieciséis capítulos, en el repositorio,
en [`docs/architecture`](https://github.com/eodia/basedb/tree/main/docs/architecture). Su
capítulo 00 fija veinticinco decisiones; este es su espíritu.

## Los datos son tablas, no un formato

Una base de usuario es un **esquema** PostgreSQL, una tabla es una tabla, un campo es una
columna tipada **con un nombre legible**. Sin EAV (entidad-atributo-valor), sin documento JSON
cajón de sastre, sin nombres opacos. El catálogo `_basedb` describe estos objetos; no los reemplaza.

Consecuencia buscada: el SQL directo es un uso **legítimo**. Las restricciones se establecen en
la base de datos y el historial lo captura un disparador: nada presupone que la escritura pase por
la aplicación.

## Un único punto de decisión de permisos

La interfaz, la API REST, el servidor MCP, los formularios compartidos, los webhooks: todo pasa por
el **mismo punto de aplicación** de los permisos, en el núcleo. La interfaz es un
consumidor de la API como cualquier otro, sin ruta privada ni token de servicio. Un
recurso que no se puede ver responde exactamente igual que un recurso que no existe.

## El núcleo decide, los adaptadores traducen

Un monorepo TypeScript: `@basedb/core` contiene toda la lógica (catálogo, motor DDL,
permisos, registros, historial); `apps/api` (Hono), `apps/mcp` y `apps/web`
(Next.js) son adaptadores que no se llaman entre sí. La interfaz nunca depende del
núcleo: habla HTTP, y punto.

## Nada se pierde sin una decisión

Eliminar relega, sin destruir: una tabla eliminada conserva sus filas, legibles en SQL con
un nombre relegado, y se puede restaurar. Cambiar un nombre físico mantiene el antiguo servido mediante un alias. La
purga es una decisión de administración, precedida de una exportación verificada.

## PostgreSQL, y nada más

PostgreSQL 16 o superior, y ninguna dependencia externa obligatoria: ni cola de mensajes, ni caché,
ni motor de búsqueda. La cola de los webhooks, el vaciado del historial, los límites de frecuencia:
todo cabe en la base de datos o en el proceso.

## Para saber más

| Capítulo | Tema |
|---|---|
| 00 | Decisiones estructurales y registro de códigos de error |
| 01 | Nomenclatura y slugificación |
| 02 | El catálogo `_basedb`, fuente de verdad |
| 03 | Motor DDL y migraciones |
| 04 | Tipos de campo y proyección en PostgreSQL |
| 05 | Permisos |
| 06 | Ciclo de vida: cambio de nombre, eliminación, purga |
| 07 | Historial |
| 08 | API REST y webhooks |
| 09 | Servidor MCP |
| 10 | Arquitectura de software |
| 11 | Interfaz |
| 12 | Integración de IA |
| 13 | Autenticación |
| 14 | Entornos |
| 15 | Formularios compartidos |
