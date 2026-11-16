-- =====================================================================
-- 2026-11-16 · Índices en `sesion` para el límite de intentos de login
--
-- El backend cuenta los intentos fallidos de los últimos 15 minutos por RUT
-- y por IP (auth.service.ts, verificarLimiteDeIntentos). Sin estos índices
-- cada login recorrería toda la tabla `sesion`, que crece con cada intento.
--
-- Solo AGREGA índices: no cambia datos ni columnas. Se puede ejecutar más de
-- una vez sin error (IF NOT EXISTS).
--
-- Aplicar en una base existente (después de 2026-10-13_duracion_actividad.sql):
--   mariadb -u root -p nest_db < "script DB + insert/cambios/2026-11-16_indices_sesion.sql"
-- =====================================================================

CREATE INDEX IF NOT EXISTS `idx_sesion_rut_fecha` ON `sesion` (`rut_intentado`, `fecha_inicio`);
CREATE INDEX IF NOT EXISTS `idx_sesion_ip_fecha`  ON `sesion` (`ip_origen`, `fecha_inicio`);
