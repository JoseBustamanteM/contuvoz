-- =====================================================================
-- 2026-11-17 · Marca de demostración en `actividad` (es_demo)
--
-- El profesor puede jugar las actividades para mostrarlas al curso, y esos
-- intentos se guardaban igual que los de un alumno. Ahora quedan marcados
-- con es_demo = 1, para excluirlos de cualquier estadística de alumnos.
--
-- Las filas existentes se marcan según el rol de quien las hizo: todo lo
-- que no hizo un estudiante (rol 5) es demostración.
--
-- Aplicar en una base existente (después de
-- 2026-11-17_contacto_opcional_estudiante.sql), con
-- deploy/aplicar-cambios.sh o a mano:
--   mariadb -u root -p nest_db < "script DB + insert/cambios/2026-11-17_actividad_demo.sql"
-- =====================================================================

ALTER TABLE `actividad`
  ADD COLUMN `es_demo` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = la hizo un adulto (demostración), no un alumno' AFTER `version_reglas`,
  ADD CONSTRAINT `chk_actividad_es_demo` CHECK (`es_demo` IN (0, 1));

UPDATE `actividad` a
  JOIN `usuario` u ON u.`id_usuario` = a.`id_usuario`
  SET a.`es_demo` = 1
  WHERE u.`id_rol` <> 5;
