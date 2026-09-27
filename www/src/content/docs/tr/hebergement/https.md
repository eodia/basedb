---
title: Alan adı ve HTTPS
description: basedb'yi bir alan adında, HTTPS ile, sağlanan Caddy proxy'sinin arkasında sunmak.
---

Canlı ortamda basedb **HTTPS** ile sunulmalıdır: oturum çerezleri `Secure` ve `__Host-` önekli
olduğundan, bir tarayıcı onları HTTP üzerinden yalnızca `localhost`'ta kabul eder.

İmaj zaten her şeyi tek bir adresten sunar — arayüz, `/api` altında API, `/mcp` altında MCP
sunucusu. Geriye yalnızca onu bir HTTPS proxy'sinin arkasına koymak kalır: `docker-compose.yml`
bir tane sağlar, **Caddy**; Let's Encrypt sertifikasını kendisi alır ve yeniler.

## Adımlar

1. Alan adınızın DNS kaydını sunucuya yönlendirin; 80 ve 443 portlarını açın.
2. `.env` içinde:

   ```bash
   BASEDB_DOMAIN=basedb.example.com
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

3. `https` profiliyle başlatın:

   ```bash
   docker compose --profile https up -d
   ```

3000 portu yalnızca `127.0.0.1` üzerinde yayımlanmış olarak kalır: tüm dış trafik Caddy'den
geçer.

## Neden bu değişkenler

- `BASEDB_DOMAIN`: Caddy'nin sertifika istediği alan adı.
- `BASEDB_PUBLIC_URL`: bir OIDC girişinin dönüş adresi; kimlik sağlayıcısında kayıtlı adresle
  karakter karakter karşılaştırılır.
- Caddy, ziyaretçinin gerçek adresinden `X-Forwarded-For` başlığını ayarlar ve basedb, bu başlık
  özel bir ağdan geldiğinde onu dikkate alır: API'nin hız sınırları (giriş, paylaşılan formlar)
  böylece ziyaretçi başına sayılır.

## Başka bir proxy

Nginx, Traefik ya da bir yük dengeleyici de uygundur: alan adının **tüm** trafiğini, yanıtları
arabelleğe almadan (MCP sunucusu ve gerçek zamanlı güncellemeler yanıtlarını akış hâlinde
gönderir) konteynerin 3000 portuna yönlendirin ve proxy'nin `X-Forwarded-For` başlığını
tamamlamak yerine **değiştirdiğinden** emin olun.
