-- =====================================================================
-- 2026-11-16 · Identificador de intento en `actividad` (sin duplicados)
--
-- El frontend reintenta el guardado si falla la red o el servidor. Si el
-- servidor alcanzó a guardar pero la respuesta no llegó, el reintento creaba
-- una segunda fila: el niño recibía estrellas dobles y "los últimos 5
-- intentos" quedaban alterados.
--
-- Ahora cada intento lleva un identificador (UUID) generado en el navegador,
-- el mismo en todos sus reintentos. El índice único (id_usuario, id_intento)
-- impide guardarlo dos veces; el backend devuelve el resultado ya guardado.
--
-- La columna admite NULL: las filas anteriores no tienen identificador, y los
-- NULL no chocan entre sí en un índice único.
--
-- Aplicar en una base existente (después de 2026-11-16_indices_sesion.sql):
--   mariadb -u root -p nest_db < "script DB + insert/cambios/2026-11-16_intento_actividad.sql"
-- =====================================================================

ALTER TABLE `actividad`
  ADD COLUMN `id_intento` char(36) DEFAULT NULL COMMENT 'UUID del intento, generado en el navegador' AFTER `duracion`,
  ADD UNIQUE KEY `uq_actividad_intento` (`id_usuario`, `id_intento`);
