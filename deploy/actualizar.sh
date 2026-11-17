#!/usr/bin/env bash
# Actualiza ContuVoz en la VPS con lo último de GitHub.
# Uso (en la VPS):  bash /opt/contuvoz/deploy/actualizar.sh
#
# Si después de bajar los cambios hay scripts de base de datos pendientes
# ("script DB + insert/cambios/"), se detiene sin tocar nada más: primero hay
# que aplicarlos con deploy/aplicar-cambios.sh, porque el código nuevo puede
# necesitarlos.
set -euo pipefail

cd /opt/contuvoz

echo "▶ Bajando cambios de GitHub…"
git pull --ff-only

echo "▶ Revisando scripts de base de datos…"
if ! bash deploy/aplicar-cambios.sh --revisar; then
  echo
  echo "✖ Antes de seguir, aplica los scripts pendientes:"
  echo "    sudo bash /opt/contuvoz/deploy/aplicar-cambios.sh"
  echo "  y vuelve a ejecutar este script."
  exit 1
fi

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
