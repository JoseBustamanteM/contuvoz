-- =====================================================================
-- 2026-11-17 · Medidas de la voz en `resultado_pronunciacion`
--
-- El detector nuevo de Hablemos guarda, por cada intento, las medidas de la
-- voz (NO el audio): tono (f0), formantes F1-F3, relación señal/ruido y
-- cuánto duró la vocal, más la versión del detector que las calculó. Con
-- esos datos se pueden ajustar las referencias de las vocales con voces
-- reales de los niños, sin entrenar nada.
--
-- Todas aceptan NULL: los intentos anteriores (version_detector NULL) no las
-- tienen, y un intento sin voz no tiene qué medir.
--
-- Además, texto_detectado puede valer 'DUDOSA': el detector no estuvo seguro
-- y pidió repetir. No necesita cambio de columna (varchar(10)).
--
-- Aplicar en una base existente (después de 2026-11-17_actividad_demo.sql),
-- con deploy/aplicar-cambios.sh o a mano:
--   mariadb -u root -p nest_db < "script DB + insert/cambios/2026-11-17_medidas_pronunciacion.sql"
-- =====================================================================

ALTER TABLE `resultado_pronunciacion`
  ADD COLUMN `f0_hz` smallint(5) unsigned DEFAULT NULL COMMENT 'Tono de la voz (Hz)' AFTER `aprobado_pronun`,
  ADD COLUMN `f1_hz` smallint(5) unsigned DEFAULT NULL COMMENT 'Primer formante (Hz)' AFTER `f0_hz`,
  ADD COLUMN `f2_hz` smallint(5) unsigned DEFAULT NULL COMMENT 'Segundo formante (Hz)' AFTER `f1_hz`,
  ADD COLUMN `f3_hz` smallint(5) unsigned DEFAULT NULL COMMENT 'Tercer formante (Hz)' AFTER `f2_hz`,
  ADD COLUMN `snr_db` double DEFAULT NULL COMMENT 'Voz sobre el ruido de la sala (dB)' AFTER `f3_hz`,
  ADD COLUMN `ms_voz` smallint(5) unsigned DEFAULT NULL COMMENT 'Duración de la vocal medida (ms)' AFTER `snr_db`,
  ADD COLUMN `version_detector` tinyint(3) unsigned DEFAULT NULL COMMENT 'NULL = detector anterior' AFTER `ms_voz`,
  ADD CONSTRAINT `chk_pronun_medidas` CHECK (
    (`f0_hz` IS NULL OR `f0_hz` BETWEEN 50 AND 1000)
    AND (`f1_hz` IS NULL OR `f1_hz` <= 8000)
    AND (`f2_hz` IS NULL OR `f2_hz` <= 8000)
    AND (`f3_hz` IS NULL OR `f3_hz` <= 8000)
    AND (`snr_db` IS NULL OR `snr_db` BETWEEN -20 AND 150)
    AND (`ms_voz` IS NULL OR `ms_voz` <= 10000)
  );
