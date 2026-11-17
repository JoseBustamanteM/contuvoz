-- =====================================================================
-- 2026-11-17 · Tabla `auditoria`
--
-- Registra quién hizo qué cambio sobre qué usuario: crear, editar, cambiar
-- clave o rol, desactivar, reactivar, vincular y desvincular. Antes no
-- quedaba rastro: si un profesor cambiaba la clave de un alumno no había
-- forma de saberlo.
--
-- Nunca guarda contraseñas ni sus hashes: en `detalle` van solo los NOMBRES
-- de los campos que cambiaron (y el rol antes/después, que no es secreto).
--
-- Solo AGREGA una tabla. Aplicar en una base existente (después de
-- 2026-11-16_indice_actividad_fecha.sql):
--   mariadb -u root -p nest_db < "script DB + insert/cambios/2026-11-17_auditoria.sql"
-- =====================================================================

CREATE TABLE `auditoria` (
  `id_auditoria`        int(11) NOT NULL AUTO_INCREMENT,
  `fecha`               datetime NOT NULL DEFAULT current_timestamp(),
  `id_actor`            int(11) NOT NULL COMMENT 'Quién hizo el cambio',
  `id_usuario_afectado` int(11) DEFAULT NULL COMMENT 'A quién afecta el cambio',
  `accion`              varchar(40) NOT NULL,
  `detalle`             longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (`detalle` IS NULL OR json_valid(`detalle`)),
  `ip_origen`           varchar(45) DEFAULT NULL,
  PRIMARY KEY (`id_auditoria`),
  KEY `idx_auditoria_afectado_fecha` (`id_usuario_afectado`, `fecha`),
  KEY `idx_auditoria_actor_fecha` (`id_actor`, `fecha`),
  CONSTRAINT `auditoria_ibfk_1` FOREIGN KEY (`id_actor`) REFERENCES `usuario` (`id_usuario`),
  CONSTRAINT `auditoria_ibfk_2` FOREIGN KEY (`id_usuario_afectado`) REFERENCES `usuario` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
