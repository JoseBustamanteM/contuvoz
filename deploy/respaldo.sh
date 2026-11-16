#!/usr/bin/env bash
# Respaldo diario de la base de ContuVoz.
#
# Lo ejecuta el timer contuvoz-respaldo (ver DEPLOY.md, "Respaldos"). También
# se puede correr a mano:  sudo bash /opt/contuvoz/deploy/respaldo.sh
#
# Deja un archivo comprimido por día en /var/backups/contuvoz y borra los de
# más de DIAS_A_GUARDAR días. Esto NO reemplaza tener una copia fuera de la
# VPS: si la VPS se pierde, estos archivos se pierden con ella.
set -euo pipefail

BASE="${BASE:-contuvoz}"
CARPETA="${CARPETA:-/var/backups/contuvoz}"
DIAS_A_GUARDAR="${DIAS_A_GUARDAR:-14}"

# Los respaldos tienen datos de niños: solo root puede leerlos.
umask 077
mkdir -p "$CARPETA"
chmod 700 "$CARPETA"

FECHA="$(date +%F_%H%M)"
DESTINO="$CARPETA/${BASE}_${FECHA}.sql.gz"
TEMPORAL="$DESTINO.parcial"

# --single-transaction: copia consistente sin bloquear la app mientras corre.
# Se escribe primero a un archivo .parcial y se renombra solo si terminó bien,
# para que un respaldo cortado a la mitad nunca parezca válido.
mariadb-dump --single-transaction --routines --triggers --events \
  --default-character-set=utf8mb4 "$BASE" | gzip -9 > "$TEMPORAL"

# Comprobación mínima: el gzip está sano y el volcado llegó hasta el final.
gzip -t "$TEMPORAL"
if ! zcat "$TEMPORAL" | tail -n 1 | grep -q "Dump completed"; then
  echo "✖ El respaldo quedó incompleto: $TEMPORAL" >&2
  exit 1
fi
mv "$TEMPORAL" "$DESTINO"

find "$CARPETA" -name "${BASE}_*.sql.gz" -type f -mtime +"$DIAS_A_GUARDAR" -delete

echo "✔ Respaldo listo: $DESTINO ($(du -h "$DESTINO" | cut -f1))"
