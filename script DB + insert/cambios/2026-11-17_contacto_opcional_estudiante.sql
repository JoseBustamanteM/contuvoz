-- =====================================================================
-- 2026-11-17 · Correo y teléfono opcionales (para estudiantes)
--
-- Eran obligatorios para todos, y el correo además único: para crear a un
-- niño de 6 años había que inventarle un correo y un teléfono. Ahora las
-- columnas admiten NULL; el backend sigue exigiéndolos a los adultos.
--
-- El índice único de correo se mantiene: los NULL no chocan entre sí.
--
-- Aplicar en una base existente (después de 2026-11-17_cambios_aplicados.sql),
-- con deploy/aplicar-cambios.sh o a mano:
--   mariadb -u root -p nest_db < "script DB + insert/cambios/2026-11-17_contacto_opcional_estudiante.sql"
-- =====================================================================

ALTER TABLE `usuario`
  MODIFY `telefono_usuario` varchar(20) DEFAULT NULL,
  MODIFY `correo` varchar(150) DEFAULT NULL;
