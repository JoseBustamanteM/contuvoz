-- =====================================================================
-- 2026-10-06 · Tabla vinculo_estudiante
--
-- Relaciona a un estudiante con un adulto responsable (profesor o
-- apoderado). Solo AGREGA una tabla: no modifica ninguna existente.
--
-- Guarda historial: un vínculo no se borra, se cierra con fecha_fin y
-- deshabilitado_por. Por eso la misma pareja puede aparecer varias veces
-- (vinculado → deshabilitado → vinculado de nuevo).
--
-- Reglas que NO puede validar la base y valida el backend:
--   - id_estudiante debe tener rol Estudiante.
--   - id_adulto debe tener rol Profesor o Apoderado según tipo_vinculo.
--   - Quién puede crear / deshabilitar cada tipo de vínculo.
--
-- Aplicar en una base existente:
--   mariadb -u root -p nest_db < "script DB + insert/cambios/2026-10-06_vinculo_estudiante.sql"
-- =====================================================================

CREATE TABLE `vinculo_estudiante` (
  `id_vinculo`        int(11) NOT NULL AUTO_INCREMENT,
  `id_estudiante`     int(11) NOT NULL,
  `id_adulto`         int(11) NOT NULL,
  `tipo_vinculo`      enum('PROFESOR','APODERADO') NOT NULL,
  `creado_por`        int(11) NOT NULL,
  `fecha_inicio`      datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_fin`         datetime DEFAULT NULL,
  `deshabilitado_por` int(11) DEFAULT NULL,

  -- 1 mientras el vínculo está vigente, NULL cuando terminó. La calcula la
  -- base: nunca se escribe. Existe solo para el índice único de abajo.
  `vigente` tinyint(1) GENERATED ALWAYS AS (IF(`fecha_fin` IS NULL, 1, NULL)) STORED,

  PRIMARY KEY (`id_vinculo`),

  -- Un solo vínculo VIGENTE por pareja y tipo. Los históricos tienen
  -- vigente = NULL y los NULL no chocan en un índice único, así que el
  -- historial puede repetir la pareja todas las veces que haga falta.
  UNIQUE KEY `uq_vinculo_vigente` (`id_estudiante`, `id_adulto`, `tipo_vinculo`, `vigente`),

  -- "Mis alumnos" del profesor / "mis hijos" del apoderado.
  KEY `idx_vinculo_adulto` (`id_adulto`, `tipo_vinculo`),
  -- Filtros "sin profesor" / "sin apoderado".
  KEY `idx_vinculo_estudiante_tipo` (`id_estudiante`, `tipo_vinculo`),
  KEY `idx_vinculo_creado_por` (`creado_por`),
  KEY `idx_vinculo_deshabilitado_por` (`deshabilitado_por`),

  -- Nadie es su propio profesor o apoderado.
  CONSTRAINT `chk_vinculo_distintos` CHECK (`id_estudiante` <> `id_adulto`),
  -- Cerrado = tiene fecha de término Y quién lo cerró; vigente = ninguna de las dos.
  CONSTRAINT `chk_vinculo_cierre` CHECK ((`fecha_fin` IS NULL) = (`deshabilitado_por` IS NULL)),
  CONSTRAINT `chk_vinculo_fechas` CHECK (`fecha_fin` IS NULL OR `fecha_fin` >= `fecha_inicio`),

  CONSTRAINT `vinculo_estudiante_ibfk_1` FOREIGN KEY (`id_estudiante`)     REFERENCES `usuario` (`id_usuario`),
  CONSTRAINT `vinculo_estudiante_ibfk_2` FOREIGN KEY (`id_adulto`)         REFERENCES `usuario` (`id_usuario`),
  CONSTRAINT `vinculo_estudiante_ibfk_3` FOREIGN KEY (`creado_por`)        REFERENCES `usuario` (`id_usuario`),
  CONSTRAINT `vinculo_estudiante_ibfk_4` FOREIGN KEY (`deshabilitado_por`) REFERENCES `usuario` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
