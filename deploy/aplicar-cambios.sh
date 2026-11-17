#!/usr/bin/env bash
# Aplica los scripts de "script DB + insert/cambios/" que la base aún no tiene,
# en orden, y anota cada uno en la tabla cambios_aplicados.
#
# Uso (en la VPS):
#   sudo bash /opt/contuvoz/deploy/aplicar-cambios.sh            aplica los pendientes
#   sudo bash /opt/contuvoz/deploy/aplicar-cambios.sh --revisar  solo los lista
#                                                                (sale con 1 si hay)
#
# Antes de aplicar, hace un respaldo con deploy/respaldo.sh. Si un script
# falla, se detiene ahí: ese script no queda anotado y los siguientes no se
# aplican.
set -euo pipefail

BASE="${BASE:-contuvoz}"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
CARPETA="$RAIZ/script DB + insert/cambios"
TABLA="cambios_aplicados"

if ! mariadb "$BASE" -N -e "SELECT 1 FROM $TABLA LIMIT 1" >/dev/null 2>&1; then
  echo "✖ La base '$BASE' no tiene la tabla $TABLA." >&2
  echo "  Si ya tiene aplicados todos los scripts anteriores, créala con:" >&2
  echo "    sudo mariadb $BASE < \"$CARPETA/2026-11-17_cambios_aplicados.sql\"" >&2
  echo "  (ver \"Registro de scripts\" en DEPLOY.md)." >&2
  exit 2
fi

APLICADOS="$(mariadb "$BASE" -N -e "SELECT nombre FROM $TABLA")"

PENDIENTES=()
while IFS= read -r archivo; do
  nombre="$(basename "$archivo")"
  if ! grep -qxF "$nombre" <<<"$APLICADOS"; then
    PENDIENTES+=("$nombre")
  fi
done < <(find "$CARPETA" -maxdepth 1 -name '*.sql' | sort)

if [ ${#PENDIENTES[@]} -eq 0 ]; then
  echo "✔ La base '$BASE' tiene todos los scripts de cambios."
  exit 0
fi

echo "Scripts pendientes en '$BASE':"
printf '  - %s\n' "${PENDIENTES[@]}"

if [ "${1:-}" = "--revisar" ]; then
  exit 1
fi

echo "▶ Respaldo antes de aplicar…"
BASE="$BASE" bash "$RAIZ/deploy/respaldo.sh"

for nombre in "${PENDIENTES[@]}"; do
  echo "▶ Aplicando $nombre…"
  mariadb "$BASE" < "$CARPETA/$nombre"
  mariadb "$BASE" -e "INSERT IGNORE INTO $TABLA (nombre) VALUES ('$nombre')"
done

echo "✔ Listo: ${#PENDIENTES[@]} script(s) aplicados."
