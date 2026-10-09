#!/usr/bin/env bash
# Actualiza ContuVoz en la VPS con lo último de GitHub.
# Uso (en la VPS):  bash /opt/contuvoz/deploy/actualizar.sh
#
# Si un cambio trae un script nuevo en "script DB + insert/cambios/", hay que
# aplicarlo a mano ANTES de correr esto (ver README).
set -euo pipefail

cd /opt/contuvoz

echo "▶ Bajando cambios de GitHub…"
git pull --ff-only

echo "▶ Frontend…"
npm ci
npm run build

echo "▶ Backend…"
cd server-nest
npm ci
npx prisma generate
npm run build

echo "▶ Reiniciando el backend…"
pm2 restart contuvoz-api

echo "✔ Listo. El frontend se sirve directo desde dist/: no hay que reiniciar Nginx."
