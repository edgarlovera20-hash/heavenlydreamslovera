# Dominio en servidor

La app puede configurarse con un dominio publico usando una sola variable:

```bash
APP_DOMAIN=crm.tudominio.com
```

Si `APP_URL` no esta definido, el servidor usa `https://APP_DOMAIN`.
Con eso tambien completa automaticamente, cuando esten vacios:

- `WEBAUTHN_RP_ID`
- `WEBAUTHN_ORIGIN`
- `OAUTH_CALLBACK_BASE_URL`
- `TWILIO_WEBHOOK_BASE_URL`

## Deploy con dominio

```bash
curl -fsSL https://raw.githubusercontent.com/edgarlovera20-hash/heavenlydreamslovera/main/scripts/deploy-server.sh -o /tmp/deploy-heavenly-dreams.sh
APP_DOMAIN=crm.tudominio.com bash /tmp/deploy-heavenly-dreams.sh
```

El script escribe estas variables en `.env` del servidor y configura `HOST=0.0.0.0` para que PM2 pueda atender trafico desde un reverse proxy.

## DNS

En tu proveedor DNS crea un registro:

```text
Tipo: A
Host: crm
Valor: IP_PUBLICA_DEL_SERVIDOR
TTL: Automatico
```

Si usas subdominio completo, `crm.tudominio.com` debe resolver a la IP publica del servidor.

## Nginx recomendado

```nginx
server {
  listen 80;
  server_name crm.tudominio.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

Luego activa HTTPS:

```bash
certbot --nginx -d crm.tudominio.com
```

## Passkeys/WebAuthn

Las passkeys requieren HTTPS y dominio real. No funcionan con IP directa en produccion.
Con `APP_DOMAIN=crm.tudominio.com`, el servidor deriva:

```bash
WEBAUTHN_RP_ID=crm.tudominio.com
WEBAUTHN_ORIGIN=https://crm.tudominio.com
```
