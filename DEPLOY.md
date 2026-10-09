# Desplegar ContuVoz en una VPS (con túnel de Cloudflare)

Todo queda en la VPS: frontend, backend y base de datos. Cloudflare corre
**también en la VPS**, así la app sigue arriba aunque apagues tu PC, y le da una
dirección `https://…trycloudflare.com` (sin cuenta ni dominio), que es lo que
necesitan la cámara y el micrófono.

```
Cliente ──https──▶ Cloudflare ──túnel──▶ VPS: cloudflared → Nginx ─┬─ /      → frontend (dist/)
                                                                    └─ /api/ → NestJS (PM2) → MariaDB
```

Los archivos de configuración están en [`deploy/`](deploy/). Los comandos son para
**Ubuntu 22.04/24.04 o Debian 12**. Los que empiezan con `sudo` piden la clave de
tu usuario en la VPS.

---

## 1. Conectarse

Desde tu PC (PowerShell o la terminal):

```bash
ssh USUARIO@IP_DE_LA_VPS
```

Revisa sistema, memoria y arquitectura:

```bash
cat /etc/os-release | head -2; free -h; uname -m
```

`uname -m` dice `x86_64` (lo más común) o `aarch64` (ARM). Si la memoria total es
**menos de 2 GB**, compila el frontend en tu PC (ver paso 6, opción B).

## 2. Instalar lo necesario

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx mariadb-server git curl build-essential python3
```

Node.js 22:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
node -v && npm -v && pm2 -v
```

cloudflared (para `x86_64`; si es ARM cambia `amd64` por `arm64`):

```bash
curl -L -o /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i /tmp/cloudflared.deb
cloudflared --version
```

## 3. Bajar el código

```bash
sudo mkdir -p /opt/contuvoz && sudo chown "$USER": /opt/contuvoz
```

**Si el repositorio es público:**

```bash
git clone https://github.com/JoseBustamanteM/contuvoz.git /opt/contuvoz
```

**Si es privado**, con una *deploy key* (solo lectura, solo este repo; no pongas
tokens dentro de la URL):

```bash
ssh-keygen -t ed25519 -C "vps-contuvoz" -f ~/.ssh/contuvoz -N ""
cat ~/.ssh/contuvoz.pub
```

Copia lo que imprime y pégalo en GitHub → el repo → **Settings → Deploy keys →
Add deploy key** (sin marcar "Allow write access"). Luego:

```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/contuvoz\n' >> ~/.ssh/config
git clone git@github.com:JoseBustamanteM/contuvoz.git /opt/contuvoz
```

## 4. Base de datos

Elige una clave para la base y úsala en los dos lugares donde dice `CLAVE_DE_LA_BASE`:

```bash
sudo mariadb -e "CREATE DATABASE contuvoz CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
CREATE USER 'contuvoz'@'localhost' IDENTIFIED BY 'CLAVE_DE_LA_BASE';
GRANT ALL PRIVILEGES ON contuvoz.* TO 'contuvoz'@'localhost';
FLUSH PRIVILEGES;"
```

Estructura y datos base (roles, tipos de actividad, colegio de prueba):

```bash
cd /opt/contuvoz
sudo mariadb contuvoz < "script DB + insert/01_estructura.sql"
sudo mariadb contuvoz < "script DB + insert/02_datos_base.sql"
sudo mariadb contuvoz -e "SHOW TABLES;"
```

Deben aparecer 17 tablas.

## 5. Backend

```bash
cd /opt/contuvoz/server-nest
cp ../deploy/env.produccion.ejemplo .env
openssl rand -hex 32
nano .env
```

En `nano`: pon la clave del paso 4 en `DATABASE_URL`, pega el resultado de
`openssl` en `JWT_SECRET`, guarda con **Ctrl+O, Enter** y sal con **Ctrl+X**.

```bash
npm ci
npx prisma generate
npm run build
npm run crear-admin
```

`crear-admin` te pide RUT, nombres, correo, teléfono y contraseña del primer
administrador de esta base.

Arrancar y dejarlo como servicio:

```bash
pm2 start dist/main.js --name contuvoz-api
pm2 save
pm2 startup
```

`pm2 startup` imprime un comando que empieza con `sudo env PATH=…`: **cópialo y
ejecútalo**, así el backend vuelve solo si se reinicia la VPS.

Prueba (debe responder `401`, que significa "funciona, pero no iniciaste sesión"):

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/api/auth/me
```

## 6. Frontend

**Opción A — compilar en la VPS** (2 GB de RAM o más):

```bash
cd /opt/contuvoz
npm ci
npm run build
ls dist/contuvoz/browser/index.html
```

**Opción B — compilar en tu PC** (VPS con poca memoria). En tu PC, en la carpeta del
proyecto:

```bash
npm run build
scp -r dist USUARIO@IP_DE_LA_VPS:/opt/contuvoz/
```

## 7. Nginx

```bash
sudo cp /opt/contuvoz/deploy/nginx-contuvoz.conf /etc/nginx/sites-available/contuvoz
sudo ln -sf /etc/nginx/sites-available/contuvoz /etc/nginx/sites-enabled/contuvoz
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/api/auth/me
```

Debe dar `200` y `401`.

> Si la VPS **ya tiene otros sitios en Nginx**, no borres `default` sin revisar:
> avísame y ajustamos la configuración para que convivan.

## 8. Túnel de Cloudflare

```bash
sudo cp /opt/contuvoz/deploy/contuvoz-tunel.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now contuvoz-tunel
sleep 8
journalctl -u contuvoz-tunel --no-pager | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1
```

El último comando imprime la dirección para el cliente. **Cambia cada vez que se
reinicia el túnel o la VPS**: vuelve a correr ese comando para verla.

## 9. Probar

Abre la dirección del túnel en el navegador y revisa:

- [ ] Iniciar sesión con el admin del paso 5, y recargar: la sesión se mantiene.
- [ ] Gestión de usuarios: crear un profesor y un estudiante.
- [ ] Con el estudiante: Pinta letras, Comunícate (cámara), Hablemos (micrófono),
      Une palabras.
- [ ] Mis logros del estudiante muestra lo que acaba de jugar.

---

## Actualizar después de nuevos cambios

```bash
bash /opt/contuvoz/deploy/actualizar.sh
```

Si el cambio trae un script en `script DB + insert/cambios/`, aplícalo antes:

```bash
sudo mariadb contuvoz < "/opt/contuvoz/script DB + insert/cambios/NOMBRE.sql"
```

## Comandos útiles

| Para | Comando |
|---|---|
| Ver si el backend está vivo | `pm2 status` |
| Ver errores del backend | `pm2 logs contuvoz-api --lines 50` |
| Reiniciar el backend | `pm2 restart contuvoz-api` |
| Dirección actual del túnel | `journalctl -u contuvoz-tunel --no-pager \| grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' \| tail -1` |
| Reiniciar el túnel (cambia la dirección) | `sudo systemctl restart contuvoz-tunel` |
| Errores de Nginx | `sudo tail -n 50 /var/log/nginx/error.log` |

## Si algo falla

| Síntoma | Revisar |
|---|---|
| La página carga pero no se puede iniciar sesión | `pm2 logs contuvoz-api`: suele ser `DATABASE_URL` o `JWT_SECRET` en `.env` |
| `502 Bad Gateway` | El backend no está corriendo: `pm2 status` |
| Inicia sesión pero al recargar se sale | Se está entrando por `http://IP` en vez de la dirección `https://` del túnel (la cookie es `Secure`) |
| Comunícate o Hablemos no piden cámara/micrófono | Mismo motivo: tiene que ser la dirección `https://` |
| `npm run build` se corta sin error ("Killed") | Falta memoria: usa la opción B del paso 6 |

## Seguridad básica

- Con el túnel **no hace falta abrir el puerto 80**: Cloudflare entra desde la
  propia VPS. Si usas firewall (`ufw`), basta con permitir SSH —
  `sudo ufw allow OpenSSH && sudo ufw enable` — **antes de activarlo, asegúrate de
  que `OpenSSH` quedó permitido**, o te quedarás afuera.
- El `.env` de la VPS no se sube a git y su `JWT_SECRET` es distinto al de desarrollo.
- Para mostrar al cliente, usa **datos ficticios**: no copies la base de desarrollo,
  que tiene RUTs y correos del equipo.
