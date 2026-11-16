-- =====================================================================
-- 2026-11-16 · Letras de Hablemos como VARCHAR(10)
--
-- resultado_pronunciacion guardaba la vocal pedida y la detectada como TEXT,
-- distinto de las otras actividades (VARCHAR(10)). Solo contienen una vocal
-- o 'NINGUNA' (7 caracteres): el backend ahora solo acepta esos valores.
--
-- Antes de aplicar, comprobar que nada supera 10 caracteres (debe dar 0):
--   SELECT COUNT(*) FROM resultado_pronunciacion
--    WHERE CHAR_LENGTH(texto_esperado) > 10 OR CHAR_LENGTH(texto_detectado) > 10;
--
-- Aplicar en una base existente (después de 2026-11-16_version_reglas.sql):
--   mariadb -u root -p nest_db < "script DB + insert/cambios/2026-11-16_letras_pronunciacion.sql"
-- =====================================================================

ALTER TABLE `resultado_pronunciacion`
  MODIFY `texto_esperado`  varchar(10) NOT NULL,
  MODIFY `texto_detectado` varchar(10) NOT NULL;
