---
title: Hesaplar ve giriş
description: Kimlerin hesap oluşturabileceği ve Google, Microsoft ya da şirketin SSO'su ile giriş yapmak.
---

## İlk giriş

Yeni bir kurulumda ilk sayfa **yönetici hesabını** oluşturur: adınız, e-posta adresiniz,
seçtiğiniz şifre. Kurulumu başkalarının erişimine açmadan — bir alan adında ya da tüm ağ
arayüzlerinde yayımlanan bir portla — önce bu hesabı oluşturun.

## Hesap oluşturma

Varsayılan olarak kuruluma erişen herkes **kendi hesabını**, ardından kendi projelerini
oluşturabilir. Başka hiçbir şey görmez: başkalarının projeleri ona **davet** yoluyla gelir.

**Yönetim paneli → Kullanıcılar** içindeki “Hesap oluşturma” kartı:

- hesap oluşturmayı kapatır: bu durumda yalnızca davet edilen kişiler hesap oluşturabilir;
- ya da bunu belirli alan adlarına ayırır — `exemple.fr, autre.fr` yalnızca bu adresleri kabul
  eder.

## Bir projeye ya da veritabanına davet etme

Bir proje ya da veritabanı üzerinde **Yönetim** düzeyine sahip olan kişi onu paylaşır: projenin
(ya da veritabanının) menüsü → **Paylaş…**, bir adres, bir düzey — Okuma, Düzenleme ya da
Yönetim. basedb, 7 gün geçerli bir **davet bağlantısı** üretir; bunu kişiye istediğiniz yolla
gönderirsiniz: kişi bağlantıyı açarak giriş yapar ya da hesabını oluşturur. Aynı ekran kimin
erişimi olduğunu gösterir, bir düzeyi değiştirir ya da kaldırır ve yeniden göndermek için
bekleyen bağlantıları saklar.

Yönetim düzeyine sahip biri, yönettiğinden fazlasını asla veremez: bir veritabanını yöneten
kişi o veritabanını paylaşır, projesini değil.

## Google, Microsoft… ile giriş yapma

basedb **OpenID Connect** konuşur: Google, Microsoft Entra ID, GitLab, Keycloak, Authentik,
Okta… Tanımlanan her sağlayıcı; giriş, hesap oluşturma ve davet ekranlarına bir “… ile devam et”
düğmesi ekler.

1. basedb'nin herkese açık adresini `.env` içinde tanımlayın:

   ```bash
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

2. Sağlayıcıda bir web uygulaması oluşturun; bu uygulamanın **dönüş adresi**
   `https://basedb.example.com/auth/oidc/<nom>/callback` olur; burada `<nom>`, aşağıda
   sağlayıcıya verdiğiniz addır (`google`, `microsoft`…).

3. Sağlayıcıyı `.env` içinde tanımlayın:

   ```bash
   BASEDB_OIDC_PROVIDERS=google,microsoft

   BASEDB_OIDC_GOOGLE_CLIENT_ID=…
   BASEDB_OIDC_GOOGLE_CLIENT_SECRET=…

   BASEDB_OIDC_MICROSOFT_ISSUER=https://login.microsoftonline.com/<id-organisation>/v2.0
   BASEDB_OIDC_MICROSOFT_CLIENT_ID=…
   BASEDB_OIDC_MICROSOFT_CLIENT_SECRET=…
   ```

4. `docker compose up -d`: başlangıçta basedb kabul edilen sağlayıcıları listeler ve dışarıda
   bıraktıkları için neyin eksik olduğunu söyler.

| `<NOM>` sağlayıcısı için değişken | Rol |
|---|---|
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | sağlayıcıda kayıtlı uygulama |
| `BASEDB_OIDC_<NOM>_ISSUER` | yayımlayıcı (issuer); `google` ve `gitlab` için gerekmez |
| `BASEDB_OIDC_<NOM>_LABEL` | düğmedeki ad — varsayılan olarak `Google`, `Microsoft` |
| `BASEDB_OIDC_<NOM>_SCOPES` | varsayılan olarak `openid email profile` |
| `BASEDB_OIDC_<NOM>_SIGNUP` | `off`: yalnızca var olan hesapları kabul eder |

Bir **ilk giriş, hesap oluşturma ayarının izin verdiği ölçüde hesabı oluşturur**: hesap
oluşturma açıksa kabul eder; alan adlarına ayrılmışsa yalnızca bu alan adlarının adreslerini.
Şifreli bir hesaba zaten ait olan bir adres asla devralınmaz: sahibi şifresiyle giriş yapar.
Gizli bilgiler ortamda kalır: hiçbiri veritabanına yazılmaz.

:::note
GitHub bir OpenID Connect sağlayıcısı değildir: burada kullanılamaz.
:::
