---
title: Permisos y grupos
description: Cuentas, grupos, niveles de acceso por proyecto, base y tabla, restricciones por campo, y tu configuración.
---

Los permisos se conceden a **grupos**, nunca a personas una por una. Un nivel
establecido en un proyecto, una base o una tabla se aplica a todo lo que hay
debajo, incluido lo que se cree más adelante.

## Los cuatro niveles

| Nivel | Permite |
|---|---|
| **Sin acceso** | nada: el recurso es invisible |
| **Lectura** | ver las filas, comentarlas, crearse vistas personales, consultar la estructura y los paneles, hacer y guardar sus propias preguntas, escribir SQL en solo lectura y guardar sus consultas personales |
| **Edición** | además, crear, modificar y eliminar filas |
| **Gestión** | además, cambiar la estructura, crear las vistas compartidas y los paneles, compartir un panel mediante un enlace, compartir preguntas y consultas, crear vistas SQL, las automatizaciones, las integraciones y los tokens; su SQL abarca toda la base, escrituras incluidas |

Los permisos **se suman**: una persona recibe el nivel más alto que le otorgue cualquiera de
sus grupos. Dar menos a una tabla que a su base la vuelve «granular».

Siempre existen dos grupos: **Administradores**, que lo gestionan todo, y **Todos los
usuarios**, del que forma parte cada cuenta: lo que se le concede, lo tiene todo el mundo.

## Hasta el campo

Debajo de la cuadrícula de niveles, **Campos** oculta una columna a un grupo o la hace no modificable
para él. La pantalla muestra también lo que ve realmente una persona concreta, y a través de qué grupo.

Un campo oculto está ausente en todas partes: de la cuadrícula, de las vistas, de la API, del MCP, del historial,
del SQL escrito en la interfaz y de las vistas SQL. Filtrar u ordenar por él responde igual que con un campo
que no existe.

## ¿Y el SQL?

En la interfaz, el SQL sigue los mismos permisos, aplicados por el propio PostgreSQL: sin el nivel
Gestión, una consulta se ejecuta en solo lectura, sobre un rol propio de la persona, donde una tabla
cerrada no existe y un campo oculto se rechaza. Una [vista SQL](/basedb/es/fonctionnalites/requetes-et-vues-sql/)
se lee con los permisos de quien la lee, y compartir una consulta solo comparte su texto.

Un acceso **`psql` directo** a la base de datos, en cambio, no lo gobierna basedb: lo lee todo, campos
ocultos incluidos. Las restricciones protegen las superficies del producto (interfaz, API, MCP), nunca
frente a alguien que tenga acceso SQL a la base de datos; esos accesos se regulan con `GRANT`
de PostgreSQL, que establece el operador de la instancia.

## Cuentas e inicio de sesión

- Una cuenta se crea con una **contraseña temporal**, que se muestra una vez y hay que cambiar en el
  primer inicio de sesión.
- Se inicia sesión con contraseña o con un proveedor **OpenID Connect** declarado por
  el operador de la instancia.
- Las acciones de administración requieren una **sesión elevada**: la contraseña introducida de nuevo en los
  últimos cinco minutos.
- Las sesiones se pueden revocar; revocar una sesión invalida al instante sus tokens de acceso.

## Tu configuración

**Configuración**, en el menú del perfil abajo a la izquierda, solo te afecta a ti:

| Pestaña | Lo que se hace en ella |
|---|---|
| **Perfil** | el nombre mostrado; la dirección de inicio de sesión; los proveedores de identidad vinculados a la cuenta, que se pueden vincular o desvincular |
| **Seguridad** | cambiar la contraseña; las sesiones abiertas, que se pueden cerrar una a una o todas a la vez |
| **Apariencia** | el idioma de la interfaz; el tema; el orden de las fechas (`25/09/2026` o `2026-09-25`) y el primer día de la semana de los calendarios |
| **Notificaciones** | los tipos de notificación que ya no quieres recibir |
| **Tokens** | los tokens de integración que has creado, en todas tus bases, su último uso y su revocación |

basedb habla **veinte idiomas**: francés, inglés, alemán, español, italiano, portugués
(Brasil), neerlandés, polaco, checo, sueco, danés, noruego, finés, rumano, húngaro,
turco, ucraniano, japonés, chino simplificado y coreano. De forma predeterminada, la interfaz usa el idioma
de tu navegador; **Idioma**, en **Apariencia**, fija otro. Los números y las fechas
siguen el idioma elegido.

Un enlace también puede pedir un idioma: `?lang=de` al final de una dirección de basedb muestra
en alemán la pantalla de inicio de sesión, un formulario, una vista o un panel compartidos. Así
es como el sitio lleva a la demo en el idioma de la página. Una vez conectado, basedb sigue tu
cuenta: el idioma elegido en **Apariencia**, si no, el del navegador.

El tema es propio de cada navegador; el idioma, el orden de las fechas y el primer día de la
semana te acompañan de un equipo a otro. Cambiar de dirección o vincular un proveedor requiere una sesión
elevada; una cuenta sin contraseña, que inicia sesión mediante un proveedor, conserva la dirección de ese
proveedor.

## El punto de aplicación único

Todas las superficies (interfaz, API, MCP, formularios y vistas compartidos, automatizaciones)
pasan por el mismo punto de decisión de permisos, en el núcleo. No existe ninguna ruta
privada de la interfaz: si la pantalla no muestra algo, es porque la API no lo ha devuelto.

Lo contrario también se cumple: la pantalla **no ofrece lo que se rechazaría**. Sin el nivel
Gestión, la pantalla Estructura se consulta sin botones ni lápiz, y la importación no ofrece
crear una tabla; sin permiso para crear o eliminar filas, la cuadrícula no ofrece ni fila
para añadir ni «Eliminar».
