-- CreateTable
CREATE TABLE `rol` (
    `id_rol` INTEGER NOT NULL,
    `nom_rol` VARCHAR(100) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id_rol`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pais` (
    `id_pais` INTEGER NOT NULL,
    `nom_pais` VARCHAR(100) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id_pais`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `region` (
    `id_region` INTEGER NOT NULL,
    `nom_region` VARCHAR(100) NOT NULL,
    `id_pais` INTEGER NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    INDEX `idx_region_pais`(`id_pais`),
    PRIMARY KEY (`id_region`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ciudad` (
    `id_ciudad` INTEGER NOT NULL,
    `nom_ciudad` VARCHAR(100) NOT NULL,
    `id_region` INTEGER NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    INDEX `idx_ciudad_region`(`id_region`),
    PRIMARY KEY (`id_ciudad`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comuna` (
    `id_comuna` INTEGER NOT NULL,
    `nom_comuna` VARCHAR(100) NOT NULL,
    `id_ciudad` INTEGER NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    INDEX `idx_comuna_ciudad`(`id_ciudad`),
    PRIMARY KEY (`id_comuna`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `colegio` (
    `id_colegio` INTEGER NOT NULL,
    `nom_colegio` VARCHAR(200) NOT NULL,
    `direc_colegio` VARCHAR(255) NOT NULL,
    `colegio_normal` BOOLEAN NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `fecha_registro` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `id_comuna` INTEGER NOT NULL,

    INDEX `idx_colegio_comuna`(`id_comuna`),
    PRIMARY KEY (`id_colegio`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tipo_actividad` (
    `id_tipo_actividad` INTEGER NOT NULL,
    `nom_actividad` VARCHAR(150) NOT NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id_tipo_actividad`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuario` (
    `id_usuario` INTEGER NOT NULL AUTO_INCREMENT,
    `id_rol` INTEGER NOT NULL,
    `id_colegio` INTEGER NOT NULL,
    `rut_usuario` VARCHAR(20) NOT NULL,
    `clave_hash` VARCHAR(255) NOT NULL,
    `primer_nombre` VARCHAR(100) NOT NULL,
    `segundo_nombre` VARCHAR(100) NOT NULL,
    `a_paterno` VARCHAR(100) NOT NULL,
    `a_materno` VARCHAR(100) NOT NULL,
    `telefono_usuario` VARCHAR(20) NOT NULL,
    `correo` VARCHAR(150) NOT NULL,
    `url_avatar` VARCHAR(255) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `ult_actividad` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `fecha_registro` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `creado_por` INTEGER NOT NULL,
    `deshabilitado_por` INTEGER NULL,

    UNIQUE INDEX `rut_usuario`(`rut_usuario`),
    UNIQUE INDEX `correo`(`correo`),
    INDEX `idx_usuario_colegio`(`id_colegio`),
    INDEX `idx_usuario_creado_por`(`creado_por`),
    INDEX `idx_usuario_deshabilitado_por`(`deshabilitado_por`),
    INDEX `idx_usuario_rol`(`id_rol`),
    PRIMARY KEY (`id_usuario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `actividad` (
    `id_actividad` INTEGER NOT NULL AUTO_INCREMENT,
    `id_usuario` INTEGER NOT NULL,
    `id_tipo_actividad` INTEGER NOT NULL,
    `fecha_actividad` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_actividad_tipo`(`id_tipo_actividad`),
    INDEX `idx_actividad_usuario`(`id_usuario`),
    PRIMARY KEY (`id_actividad`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `resultado_pintado` (
    `id_res_pintado` INTEGER NOT NULL AUTO_INCREMENT,
    `id_actividad` INTEGER NOT NULL,
    `letra_esperada` VARCHAR(10) NOT NULL,
    `trazo_interno` DOUBLE NOT NULL,
    `trazo_externo` DOUBLE NOT NULL,
    `area_completada` DOUBLE NOT NULL,
    `puntaje_final` DOUBLE NOT NULL,
    `aprobado_pintado` BOOLEAN NOT NULL DEFAULT false,
    `duracion_pintado` INTEGER NOT NULL,

    UNIQUE INDEX `id_actividad`(`id_actividad`),
    PRIMARY KEY (`id_res_pintado`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `resultado_pronunciacion` (
    `id_res_pronun` INTEGER NOT NULL AUTO_INCREMENT,
    `id_actividad` INTEGER NOT NULL,
    `texto_esperado` TEXT NOT NULL,
    `texto_detectado` TEXT NOT NULL,
    `porc_confianza` DOUBLE NOT NULL,
    `aprobado_pronun` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `id_actividad`(`id_actividad`),
    PRIMARY KEY (`id_res_pronun`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `resultado_sign` (
    `id_res_sign` INTEGER NOT NULL AUTO_INCREMENT,
    `id_actividad` INTEGER NOT NULL,
    `letra_esperada` VARCHAR(10) NOT NULL,
    `letra_detectada` VARCHAR(10) NOT NULL,
    `porc_confianza` DOUBLE NOT NULL,
    `aprobado_sign` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `id_actividad`(`id_actividad`),
    PRIMARY KEY (`id_res_sign`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `archivo_biblioteca` (
    `id_archivo` INTEGER NOT NULL AUTO_INCREMENT,
    `titulo_archivo` VARCHAR(200) NOT NULL,
    `descripcion_archivo` TEXT NULL,
    `ruta_archivo_url` VARCHAR(500) NOT NULL,
    `tipo_archivo` VARCHAR(50) NOT NULL,
    `fecha_subido` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `id_usuario` INTEGER NOT NULL,
    `imagen_url` VARCHAR(500) NOT NULL,
    `imagen_descripcion_url` VARCHAR(500) NOT NULL,

    INDEX `idx_archivo_usuario`(`id_usuario`),
    PRIMARY KEY (`id_archivo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sesion` (
    `id_sesion` INTEGER NOT NULL AUTO_INCREMENT,
    `id_usuario` INTEGER NULL,
    `rut_intentado` VARCHAR(20) NOT NULL,
    `exitosa` BOOLEAN NOT NULL,
    `fecha_inicio` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `fecha_fin` DATETIME(0) NULL,
    `ip_origen` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `motivo_fin` VARCHAR(255) NULL,

    INDEX `idx_sesion_usuario`(`id_usuario`),
    PRIMARY KEY (`id_sesion`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sesion_token` (
    `id_sesion_token` INTEGER NOT NULL AUTO_INCREMENT,
    `id_usuario` INTEGER NOT NULL,
    `id_sesion` INTEGER NULL,
    `refresh_token_hash` VARCHAR(255) NOT NULL,
    `fecha_creacion` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `fecha_expiracion` DATETIME(0) NOT NULL,
    `revocado` BOOLEAN NOT NULL DEFAULT false,
    `ip_origen` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,

    UNIQUE INDEX `refresh_token_hash`(`refresh_token_hash`),
    INDEX `idx_sesion_token_usuario`(`id_usuario`),
    INDEX `sesion_token_ibfk_2`(`id_sesion`),
    PRIMARY KEY (`id_sesion_token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `region` ADD CONSTRAINT `region_ibfk_1` FOREIGN KEY (`id_pais`) REFERENCES `pais`(`id_pais`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ciudad` ADD CONSTRAINT `ciudad_ibfk_1` FOREIGN KEY (`id_region`) REFERENCES `region`(`id_region`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comuna` ADD CONSTRAINT `comuna_ibfk_1` FOREIGN KEY (`id_ciudad`) REFERENCES `ciudad`(`id_ciudad`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `colegio` ADD CONSTRAINT `colegio_ibfk_1` FOREIGN KEY (`id_comuna`) REFERENCES `comuna`(`id_comuna`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuario` ADD CONSTRAINT `usuario_ibfk_1` FOREIGN KEY (`id_colegio`) REFERENCES `colegio`(`id_colegio`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuario` ADD CONSTRAINT `usuario_ibfk_2` FOREIGN KEY (`id_rol`) REFERENCES `rol`(`id_rol`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuario` ADD CONSTRAINT `usuario_ibfk_3` FOREIGN KEY (`creado_por`) REFERENCES `usuario`(`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuario` ADD CONSTRAINT `usuario_ibfk_4` FOREIGN KEY (`deshabilitado_por`) REFERENCES `usuario`(`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actividad` ADD CONSTRAINT `actividad_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actividad` ADD CONSTRAINT `actividad_ibfk_2` FOREIGN KEY (`id_tipo_actividad`) REFERENCES `tipo_actividad`(`id_tipo_actividad`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resultado_pintado` ADD CONSTRAINT `resultado_pintado_ibfk_1` FOREIGN KEY (`id_actividad`) REFERENCES `actividad`(`id_actividad`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resultado_pronunciacion` ADD CONSTRAINT `resultado_pronunciacion_ibfk_1` FOREIGN KEY (`id_actividad`) REFERENCES `actividad`(`id_actividad`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resultado_sign` ADD CONSTRAINT `resultado_sign_ibfk_1` FOREIGN KEY (`id_actividad`) REFERENCES `actividad`(`id_actividad`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `archivo_biblioteca` ADD CONSTRAINT `archivo_biblioteca_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sesion` ADD CONSTRAINT `sesion_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sesion_token` ADD CONSTRAINT `sesion_token_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sesion_token` ADD CONSTRAINT `sesion_token_ibfk_2` FOREIGN KEY (`id_sesion`) REFERENCES `sesion`(`id_sesion`) ON DELETE SET NULL ON UPDATE CASCADE;
