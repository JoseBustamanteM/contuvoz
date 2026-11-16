-- =====================================================================
-- 2026-11-16 · Versión de las reglas en `actividad`
--
-- Cada intento guarda con qué versión de las reglas se evaluó (umbrales de
-- aprobación y forma de calcular el puntaje o detectar). Cuando cambien las
-- reglas de una actividad —por ejemplo, el detector nuevo de vocales de
-- Hablemos— su versión sube, y los "aprobado" de antes y de después se
-- pueden separar en vez de mezclarse como si valieran lo mismo.
--
-- Todos los intentos existentes se evaluaron con las reglas actuales, que
-- son la versión 1: el DEFAULT 1 los rellena. El valor por defecto se deja
-- para que el backend anterior siga guardando mientras se actualiza (si se
-- aplica este script antes que el código nuevo). El backend nuevo la indica
-- siempre: en schema.prisma no tiene valor por defecto, así que el código no
-- compila si un insert la olvida.
--
-- Aplicar en una base existente (después de 2026-11-16_intento_actividad.sql):
--   mariadb -u root -p nest_db < "script DB + insert/cambios/2026-11-16_version_reglas.sql"
-- =====================================================================

ALTER TABLE `actividad`
  ADD COLUMN `version_reglas` smallint(6) NOT NULL DEFAULT 1 COMMENT 'Versión de las reglas con que se evaluó el intento' AFTER `id_intento`;
