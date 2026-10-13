-- =====================================================================
-- 2026-10-13 · Duración en `actividad` (una sola columna para todas)
--
-- Antes: solo Pinta letras (resultado_pintado.duracion_pintado) y Une
-- palabras (resultado_une_palabras.duracion_une) guardaban duración.
-- Ahora: actividad.duracion, en SEGUNDOS ENTEROS, para las 4 actividades.
--
-- Qué mide cada una:
--   Pinta letras  → del primer trazo a "Verificar"
--   Comunícate    → del inicio de la letra al veredicto (logrado / no logrado)
--   Hablemos      → de tocar "Practicar" al resultado
--   Une palabras  → del primer toque al fin de la ronda
--
-- Datos existentes: las duraciones de Pinta letras y Une palabras se COPIAN
-- antes de borrar sus columnas. Comunícate y Hablemos nunca guardaron
-- duración: esas filas antiguas quedan en NULL (por eso la columna admite NULL;
-- toda actividad nueva la trae).
--
-- Aplicar en una base existente (después de 2026-10-06_vinculo_estudiante.sql):
--   mariadb -u root -p nest_db < "script DB + insert/cambios/2026-10-13_duracion_actividad.sql"
-- =====================================================================

ALTER TABLE `actividad`
  ADD COLUMN `duracion` int(11) DEFAULT NULL COMMENT 'Segundos que duró el intento' AFTER `fecha_actividad`,
  ADD CONSTRAINT `chk_actividad_duracion` CHECK (`duracion` IS NULL OR `duracion` >= 0);

-- Copiar lo que ya existía, antes de borrar las columnas viejas.
UPDATE `actividad` a
  JOIN `resultado_pintado` r ON r.`id_actividad` = a.`id_actividad`
  SET a.`duracion` = r.`duracion_pintado`;

UPDATE `actividad` a
  JOIN `resultado_une_palabras` r ON r.`id_actividad` = a.`id_actividad`
  SET a.`duracion` = r.`duracion_une`;

ALTER TABLE `resultado_pintado` DROP COLUMN `duracion_pintado`;
ALTER TABLE `resultado_une_palabras` DROP COLUMN `duracion_une`;
