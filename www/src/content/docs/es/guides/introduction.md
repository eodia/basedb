---
title: Introducción
description: Qué es basedb y qué lo distingue de las hojas de cálculo colaborativas.
---

**basedb** es una base de datos colaborativa, en la línea de las hojas de cálculo colaborativas,
que alojas tú mismo, con una diferencia que lo determina todo: **tus datos viven en tablas
PostgreSQL reales**, tipadas y con nombres legibles.

![La cuadrícula de una tabla en basedb](../../../../assets/screens/grille.png)

## Una promesa sencilla

Sin modelo genérico, sin un `JSONB` cajón de sastre, sin `field_1837`:

| En basedb | En PostgreSQL |
|---|---|
| Una base «Ventes» | un esquema `b_t4z56fq_ventes` |
| Una tabla «Opportunités» | una tabla `opportunites` |
| Un campo «Échéance» (Fecha) | una columna `echeance date` |
| Una selección única «Statut» | una columna `text` y su restricción `CHECK` |
| Una relación «Client» | una columna `clients_id uuid` y su `FOREIGN KEY` |

Así que puedes abrir `psql`, una herramienta de BI o un script de Python y leer tus datos sin
pasar por el producto, e incluso escribir en ellos: las restricciones se mantienen y el historial
registra la escritura.

## ¿Para quién?

- **Los equipos de negocio** que quieren una cuadrícula, vistas y formularios sin esperar a un
  desarrollo.
- **Los equipos técnicos** que se niegan a ver sus datos encerrados en un formato propietario y
  quieren conectar sus herramientas habituales.
- **Los agentes de IA**, que encuentran un servidor MCP, permisos claros y propuestas que
  aprueba una persona.

## Lo que encontrarás

- [Tablas y campos](/basedb/es/fonctionnalites/tables-et-champs/) tipados, relaciones que son
  claves foráneas reales (o múltiples), fórmulas calculadas por PostgreSQL, búsquedas y
  acumulados a través de las relaciones.
- Ocho [vistas](/basedb/es/fonctionnalites/vues/): cuadrícula, kanban, calendario, cronología,
  galería, lista, formulario y encuesta, colaborativas o personales.
- [Formularios](/basedb/es/fonctionnalites/formulaires-partages/) y
  [vistas](/basedb/es/fonctionnalites/vues-partagees/) compartidos mediante un enlace, y
  calendarios a los que suscribirse desde una agenda.
- La [colaboración](/basedb/es/fonctionnalites/collaboration/): comentarios y menciones,
  notificaciones, actualizaciones en tiempo real.
- [Automatizaciones](/basedb/es/fonctionnalites/automatisations/) y
  [paneles](/basedb/es/fonctionnalites/tableaux-de-bord/) con sus preguntas, construidos con el ratón o en SQL.
- [SQL para cada uno](/basedb/es/fonctionnalites/requetes-et-vues-sql/), con sus propios permisos:
  consultas guardadas bajo las tablas y vistas PostgreSQL reales colocadas entre ellas.
- [Plantillas de base](/basedb/es/fonctionnalites/modeles/), que se eligen en una galería o se
  piden a la IA.
- [Entornos](/basedb/es/fonctionnalites/environnements/) (producción, preproducción) que se
  comparan y se migran.
- Un [historial](/basedb/es/fonctionnalites/historique/) de cada escritura, SQL directo incluido,
  y Ctrl+Z para deshacer.
- [Permisos](/basedb/es/fonctionnalites/droits/) por grupo, hasta el nivel de campo.
- Una [API REST](/basedb/es/integrations/api-rest/), un [servidor MCP](/basedb/es/integrations/mcp/),
  [webhooks](/basedb/es/integrations/webhooks/), Slack y
  [tablas sincronizadas](/basedb/es/integrations/synchronisation/).
- La [IA](/basedb/es/fonctionnalites/ia/) opcional: campos calculados por un modelo, Copilot.

## Estado del proyecto

basedb es software libre (AGPL-3.0) desarrollado por [Eodia](https://eodia.com/fr/), estudio de
software nativo de IA, y está en desarrollo activo. El núcleo, la API, el servidor MCP
y la interfaz funcionan y están cubiertos por más de mil pruebas; la
[hoja de ruta](/basedb/es/feuille-de-route/) indica lo que está por venir. Su
[documento de arquitectura](https://github.com/eodia/basedb/tree/main/docs/architecture), de
una veintena de capítulos, fija cada decisión.

:::tip[Probar]
Basta un comando una vez clonado el repositorio: `docker compose up -d`. Consulta
[la instalación](/basedb/es/guides/installation/).
:::
