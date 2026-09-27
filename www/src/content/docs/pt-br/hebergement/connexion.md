---
title: Contas e login
description: Quem pode criar uma conta, e entrar com Google, Microsoft ou o SSO da empresa.
---

## Primeiro login

Em uma instância nova, a primeira página cria a **conta de administrador**: seu nome, seu
endereço de e-mail, a senha que você escolher. Crie-a antes de tornar a instância acessível a
outras pessoas — em um domínio ou com uma porta publicada em todas as interfaces.

## Criação de contas

Por padrão, qualquer pessoa que acesse a instância pode **criar a própria conta** e depois os próprios
projetos. Ela não vê mais nada: os projetos dos outros chegam a ela por **convite**.

Em **Administração → Usuários**, o cartão “Criação de contas”:

- fecha a criação de contas: somente as pessoas convidadas podem então criar uma;
- ou a reserva a domínios — `exemple.fr, autre.fr` só admite esses endereços.

## Convidar para um projeto ou uma base

Quem tem o nível **Gerenciamento** em um projeto ou em uma base pode compartilhá-lo: menu do projeto (ou da
base) → **Compartilhar…**, um endereço, um nível — Leitura, Edição ou Gerenciamento. O basedb
gera um **link de convite**, válido por 7 dias, para enviar à pessoa como você
preferir: ela entra, ou cria a conta, ao abri-lo. A mesma tela mostra quem tem
acesso, muda um nível ou o remove, e mantém os links pendentes para reenviá-los.

Um gestor nunca concede mais do que aquilo que gerencia: o gestor de uma base pode
compartilhá-la, mas não o projeto dela.

## Entrar com Google, Microsoft…

O basedb fala **OpenID Connect**: Google, Microsoft Entra ID, GitLab, Keycloak, Authentik,
Okta… Cada provedor declarado adiciona um botão “Continuar com …” às telas de
login, de criação de conta e de convite.

1. Defina o endereço público do basedb no `.env`:

   ```bash
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

2. No provedor, crie um aplicativo web; o **endereço de retorno** dele é
   `https://basedb.example.com/auth/oidc/<nom>/callback`, em que `<nom>` é o nome que você
   lhe der abaixo (`google`, `microsoft`…).

3. Declare-o no `.env`:

   ```bash
   BASEDB_OIDC_PROVIDERS=google,microsoft

   BASEDB_OIDC_GOOGLE_CLIENT_ID=…
   BASEDB_OIDC_GOOGLE_CLIENT_SECRET=…

   BASEDB_OIDC_MICROSOFT_ISSUER=https://login.microsoftonline.com/<id-organisation>/v2.0
   BASEDB_OIDC_MICROSOFT_CLIENT_ID=…
   BASEDB_OIDC_MICROSOFT_CLIENT_SECRET=…
   ```

4. `docker compose up -d`: na inicialização, o basedb lista os provedores aceitos e informa o que
   falta àqueles que deixa de lado.

| Variável, para o provedor `<NOM>` | Função |
|---|---|
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | o aplicativo registrado no provedor |
| `BASEDB_OIDC_<NOM>_ISSUER` | o emissor; desnecessário para `google` e `gitlab` |
| `BASEDB_OIDC_<NOM>_LABEL` | o nome no botão — `Google`, `Microsoft` por padrão |
| `BASEDB_OIDC_<NOM>_SCOPES` | `openid email profile` por padrão |
| `BASEDB_OIDC_<NOM>_SIGNUP` | `off`: só admite as contas existentes |

Um **primeiro login cria a conta** conforme a criação de contas permite: aberta,
ela a admite; reservada a domínios, somente os endereços deles. Um endereço já usado por
uma conta com senha nunca é adotado: a titular dele entra com a própria
senha. Os segredos ficam no ambiente: nada deles é gravado no banco.

:::note
O GitHub não é um provedor OpenID Connect: ele não pode ser usado aqui.
:::
