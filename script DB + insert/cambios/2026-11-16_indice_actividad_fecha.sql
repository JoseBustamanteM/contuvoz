-- =====================================================================
-- 2026-11-16 · Índice (id_usuario, fecha_actividad) en `actividad`
--
-- Lo usan el límite de intentos por minuto al guardar una actividad y las
-- consultas por usuario ordenadas por fecha (Mis logros). Sin él, cada
-- guardado recorría todas las actividades del usuario.
--
-- Solo AGREGA un índice. Se puede ejecutar más de una vez (IF NOT EXISTS).
--
-- Aplicar en una base existente (después de 2026-11-16_checks_resultados.sql):
--   mariadb -u root -p nest_db < "script DB + insert/cambios/2026-11-16_indice_actividad_fecha.sql"
-- =====================================================================

CREATE INDEX IF NOT EXISTS `idx_actividad_usuario_fecha` ON `actividad` (`id_usuario`, `fecha_actividad`);
