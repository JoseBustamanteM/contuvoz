-- =====================================================================
-- 2026-11-17 · Cambio de contraseña obligatorio (`usuario.debe_cambiar_clave`)
--
-- Cuando un administrador (o profesor) crea a un ADULTO o le pone una clave
-- nueva, esa clave la conoce quien la escribió. Con debe_cambiar_clave = 1 el
-- adulto tiene que cambiarla en su perfil antes de usar el resto de la app.
-- Los estudiantes nunca quedan obligados: un niño podría quedar sin poder
-- entrar.
--
-- Los usuarios que ya existen quedan en 0: no se les pide nada de golpe.
--
-- Aplicar en una base existente (después de
-- 2026-11-17_medidas_pronunciacion.sql), con deploy/aplicar-cambios.sh o a
-- mano:
--   mariadb -u root -p nest_db < "script DB + insert/cambios/2026-11-17_debe_cambiar_clave.sql"
-- =====================================================================

ALTER TABLE `usuario`
  ADD COLUMN `debe_cambiar_clave` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = debe cambiar la clave que le dieron antes de seguir' AFTER `clave_hash`,
  ADD CONSTRAINT `chk_usuario_debe_cambiar_clave` CHECK (`debe_cambiar_clave` IN (0, 1));
