# Configuración Nginx

Archivos de virtual host para el servidor VPS.

## Aplicar en el servidor

```bash
# Copiar configs
sudo cp app.heavenlydreams.com.mx.conf /etc/nginx/sites-available/
sudo cp heavenlydreams.com.mx.conf     /etc/nginx/sites-available/

# Activar
sudo ln -sf /etc/nginx/sites-available/app.heavenlydreams.com.mx.conf \
            /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/heavenlydreams.com.mx.conf \
            /etc/nginx/sites-enabled/

# Verificar y recargar
sudo nginx -t && sudo nginx -s reload
```

## Certificados SSL (solo la primera vez)

```bash
# app subdomain
sudo certbot certonly --nginx -d app.heavenlydreams.com.mx

# www + bare domain (cubre ambos con un solo cert)
sudo certbot certonly --nginx -d heavenlydreams.com.mx -d www.heavenlydreams.com.mx
```

## Dominios y puertos

| Dominio                        | Puerto local | App                       |
|-------------------------------|-------------|---------------------------|
| app.heavenlydreams.com.mx     | 3000        | heavenlydreamslovera (pm2)|
| www.heavenlydreams.com.mx     | 4173        | HEAVENLY-DREAMS-WEB-2026  |
| rh.heavenlydreams.com.mx      | 5173        | RHDREAMSAPP2026           |
