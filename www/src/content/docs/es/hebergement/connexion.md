---
title: Cuentas e inicio de sesión
description: Quién puede crear una cuenta, e iniciar sesión con Google, Microsoft o el SSO de la empresa.
---

## Primer inicio de sesión

En una instancia nueva, la primera página crea la **cuenta de administrador**: tu nombre, tu
dirección de correo y la contraseña que elijas. Créala antes de hacer que la instancia sea accesible para
otros, ya sea en un dominio o con un puerto publicado en todas las interfaces.

## Creación de cuentas

De forma predeterminada, cualquier persona que llegue a la instancia puede **crear su cuenta** y, después, sus propios
proyectos. No ve nada más: los proyectos de los demás le llegan por **invitación**.

En **Administración → Usuarios**, la tarjeta «Creación de cuentas»:

- cierra la creación de cuentas: entonces solo las personas invitadas pueden crear una;
- o la reserva a ciertos dominios: `exemple.fr, autre.fr` solo admite esas direcciones.

## Invitar a un proyecto o a una base

Quien tiene el nivel **Gestión** sobre un proyecto o una base puede compartirlo: menú del proyecto (o de la
base) → **Compartir…**, una dirección, un nivel (Lectura, Edición o Gestión). basedb
genera un **enlace de invitación**, válido durante 7 días, que envías a la persona como
prefieras: al abrirlo, inicia sesión o crea su cuenta. La misma pantalla muestra quién tiene
acceso, cambia un nivel o lo retira, y conserva los enlaces pendientes para reenviarlos.

Un gestor nunca da más de lo que gestiona: el gestor de una base puede compartirla, pero no
su proyecto.

## Iniciar sesión con Google, Microsoft…

basedb habla **OpenID Connect**: Google, Microsoft Entra ID, GitLab, Keycloak, Authentik,
Okta… Cada proveedor declarado añade un botón «Continuar con…» a las pantallas de
inicio de sesión, de creación de cuenta y de invitación.

1. Define la dirección pública de basedb en `.env`:

   ```bash
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

2. En el proveedor, crea una aplicación web; su **dirección de retorno** es
   `https://basedb.example.com/auth/oidc/<nom>/callback`, donde `<nom>` es el nombre que le
   das más abajo (`google`, `microsoft`…).

3. Declara el proveedor en `.env`:

   ```bash
   BASEDB_OIDC_PROVIDERS=google,microsoft

   BASEDB_OIDC_GOOGLE_CLIENT_ID=…
   BASEDB_OIDC_GOOGLE_CLIENT_SECRET=…

   BASEDB_OIDC_MICROSOFT_ISSUER=https://login.microsoftonline.com/<id-organisation>/v2.0
   BASEDB_OIDC_MICROSOFT_CLIENT_ID=…
   BASEDB_OIDC_MICROSOFT_CLIENT_SECRET=…
   ```

4. `docker compose up -d`: al arrancar, basedb lista los proveedores aceptados e indica qué
   les falta a los que deja de lado.

| Variable, para el proveedor `<NOM>` | Función |
|---|---|
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | la aplicación registrada en el proveedor |
| `BASEDB_OIDC_<NOM>_ISSUER` | el emisor; innecesario para `google` y `gitlab` |
| `BASEDB_OIDC_<NOM>_LABEL` | el nombre del botón: `Google`, `Microsoft` de forma predeterminada |
| `BASEDB_OIDC_<NOM>_SCOPES` | `openid email profile` de forma predeterminada |
| `BASEDB_OIDC_<NOM>_SIGNUP` | `off`: solo admite las cuentas existentes |

Un **primer inicio de sesión crea la cuenta** según lo que permita la creación de cuentas: si está abierta,
la admite; si está reservada a ciertos dominios, solo las direcciones de esos dominios. Una dirección que ya usa
una cuenta con contraseña nunca se adopta: su titular inicia sesión con su
contraseña. Los secretos se quedan en el entorno: no se escribe nada de ellos en la base de datos.

:::note
GitHub no es un proveedor OpenID Connect: no se puede usar aquí.
:::
