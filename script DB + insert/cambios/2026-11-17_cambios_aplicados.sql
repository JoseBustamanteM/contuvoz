-- =====================================================================
-- 2026-11-17 · Registro de scripts aplicados (`cambios_aplicados`)
--
-- Hasta ahora nada registraba qué scripts de esta carpeta tenía cada base:
-- había que acordarse, y aplicar uno dos veces daba error (o peor, en uno
-- que no se puede repetir). Desde aquí:
--   - deploy/aplicar-cambios.sh aplica los pendientes en orden y anota cada
--     uno en esta tabla;
--   - deploy/actualizar.sh se detiene si hay alguno pendiente.
--
-- ⚠️ Este script marca como YA APLICADOS todos los anteriores. Úsalo solo en
-- una base que los tenga todos (ver "Registro de scripts" en DEPLOY.md para
-- comprobarlo). Una base instalada desde cero con 01_estructura.sql y
-- 02_datos_base.sql ya trae la tabla y el registro: no hace falta.
--
-- Se puede ejecutar más de una vez (IF NOT EXISTS, INSERT IGNORE).
--   mariadb -u root -p nest_db < "script DB + insert/cambios/2026-11-17_cambios_aplicados.sql"
-- =====================================================================

CREATE TABLE IF NOT EXISTS `cambios_aplicados` (
  `nombre`         varchar(100) NOT NULL COMMENT 'Archivo de script DB + insert/cambios/',
  `fecha_aplicado` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT IGNORE INTO `cambios_aplicados` (`nombre`) VALUES
  ('2026-10-06_vinculo_estudiante.sql'),
  ('2026-10-13_duracion_actividad.sql'),
  ('2026-11-16_checks_resultados.sql'),
  ('2026-11-16_indice_actividad_fecha.sql'),
  ('2026-11-16_indices_sesion.sql'),
  ('2026-11-16_intento_actividad.sql'),
  ('2026-11-16_letras_pronunciacion.sql'),
  ('2026-11-16_version_reglas.sql'),
  ('2026-11-17_auditoria.sql'),
  ('2026-11-17_cambios_aplicados.sql');
