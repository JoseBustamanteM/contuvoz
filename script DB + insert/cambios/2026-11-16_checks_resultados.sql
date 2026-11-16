-- =====================================================================
-- 2026-11-16 · Rangos válidos en las tablas de resultados (CHECK)
--
-- El backend ya valida estos rangos, pero la base no los exigía: un error
-- en el código o un INSERT a mano podía dejar puntajes de 166 % o más
-- aciertos que pares. Con estas restricciones la base rechaza esos datos.
--
--   resultado_pintado        trazos, área y puntaje entre 0 y 100
--   resultado_sign           confianza entre 0 y 100
--   resultado_pronunciacion  confianza entre 0 y 100
--   resultado_une_palabras   1 a 20 pares, 0 <= aciertos <= pares,
--                            errores >= 0, puntaje entre 0 y 100
--
-- Antes de aplicar, comprobar que ninguna fila existente las viola (todas
-- deben dar 0; si alguna no, revisar esas filas antes de seguir):
--   SELECT COUNT(*) FROM resultado_pintado WHERE trazo_interno NOT BETWEEN 0 AND 100
--     OR trazo_externo NOT BETWEEN 0 AND 100 OR area_completada NOT BETWEEN 0 AND 100
--     OR puntaje_final NOT BETWEEN 0 AND 100;
--   SELECT COUNT(*) FROM resultado_sign WHERE porc_confianza NOT BETWEEN 0 AND 100;
--   SELECT COUNT(*) FROM resultado_pronunciacion WHERE porc_confianza NOT BETWEEN 0 AND 100;
--   SELECT COUNT(*) FROM resultado_une_palabras WHERE total_pares NOT BETWEEN 1 AND 20
--     OR aciertos < 0 OR aciertos > total_pares OR errores < 0
--     OR puntaje_final NOT BETWEEN 0 AND 100;
--
-- Aplicar en una base existente (después de 2026-11-16_letras_pronunciacion.sql):
--   mariadb -u root -p nest_db < "script DB + insert/cambios/2026-11-16_checks_resultados.sql"
-- =====================================================================

ALTER TABLE `resultado_pintado`
  ADD CONSTRAINT `chk_pintado_rangos` CHECK (
    `trazo_interno`   BETWEEN 0 AND 100 AND
    `trazo_externo`   BETWEEN 0 AND 100 AND
    `area_completada` BETWEEN 0 AND 100 AND
    `puntaje_final`   BETWEEN 0 AND 100
  );

ALTER TABLE `resultado_sign`
  ADD CONSTRAINT `chk_sign_confianza` CHECK (`porc_confianza` BETWEEN 0 AND 100);

ALTER TABLE `resultado_pronunciacion`
  ADD CONSTRAINT `chk_pronun_confianza` CHECK (`porc_confianza` BETWEEN 0 AND 100);

ALTER TABLE `resultado_une_palabras`
  ADD CONSTRAINT `chk_une_rangos` CHECK (
    `total_pares` BETWEEN 1 AND 20 AND
    `aciertos` BETWEEN 0 AND `total_pares` AND
    `errores` >= 0 AND
    `puntaje_final` BETWEEN 0 AND 100
  );
