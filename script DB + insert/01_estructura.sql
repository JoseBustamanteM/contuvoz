/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19-11.7.2-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: nest_db
-- ------------------------------------------------------
-- Server version	11.4.2-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Table structure for table `actividad`
--

DROP TABLE IF EXISTS `actividad`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `actividad` (
  `id_actividad` int(11) NOT NULL AUTO_INCREMENT,
  `id_usuario` int(11) NOT NULL,
  `id_tipo_actividad` int(11) NOT NULL,
  `fecha_actividad` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_actividad`),
  KEY `idx_actividad_usuario` (`id_usuario`),
  KEY `idx_actividad_tipo` (`id_tipo_actividad`),
  CONSTRAINT `actividad_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`) ON UPDATE CASCADE,
  CONSTRAINT `actividad_ibfk_2` FOREIGN KEY (`id_tipo_actividad`) REFERENCES `tipo_actividad` (`id_tipo_actividad`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `archivo_biblioteca`
--

DROP TABLE IF EXISTS `archivo_biblioteca`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `archivo_biblioteca` (
  `id_archivo` int(11) NOT NULL AUTO_INCREMENT,
  `titulo_archivo` varchar(200) NOT NULL,
  `descripcion_archivo` text DEFAULT NULL,
  `ruta_archivo_url` varchar(500) NOT NULL,
  `tipo_archivo` varchar(50) NOT NULL,
  `fecha_subido` datetime NOT NULL DEFAULT current_timestamp(),
  `id_usuario` int(11) NOT NULL,
  `imagen_url` varchar(500) NOT NULL,
  `imagen_descripcion_url` varchar(500) NOT NULL,
  PRIMARY KEY (`id_archivo`),
  KEY `idx_archivo_usuario` (`id_usuario`),
  CONSTRAINT `archivo_biblioteca_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ciudad`
--

DROP TABLE IF EXISTS `ciudad`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ciudad` (
  `id_ciudad` int(11) NOT NULL,
  `nom_ciudad` varchar(100) NOT NULL,
  `id_region` int(11) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1 CHECK (`activo` in (0,1)),
  PRIMARY KEY (`id_ciudad`),
  KEY `idx_ciudad_region` (`id_region`),
  CONSTRAINT `ciudad_ibfk_1` FOREIGN KEY (`id_region`) REFERENCES `region` (`id_region`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `colegio`
--

DROP TABLE IF EXISTS `colegio`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `colegio` (
  `id_colegio` int(11) NOT NULL,
  `nom_colegio` varchar(200) NOT NULL,
  `direc_colegio` varchar(255) NOT NULL,
  `colegio_normal` tinyint(1) NOT NULL CHECK (`colegio_normal` in (0,1)),
  `activo` tinyint(1) NOT NULL DEFAULT 1 CHECK (`activo` in (0,1)),
  `fecha_registro` datetime NOT NULL DEFAULT current_timestamp(),
  `id_comuna` int(11) NOT NULL,
  PRIMARY KEY (`id_colegio`),
  KEY `idx_colegio_comuna` (`id_comuna`),
  CONSTRAINT `colegio_ibfk_1` FOREIGN KEY (`id_comuna`) REFERENCES `comuna` (`id_comuna`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `comuna`
--

DROP TABLE IF EXISTS `comuna`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `comuna` (
  `id_comuna` int(11) NOT NULL,
  `nom_comuna` varchar(100) NOT NULL,
  `id_ciudad` int(11) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1 CHECK (`activo` in (0,1)),
  PRIMARY KEY (`id_comuna`),
  KEY `idx_comuna_ciudad` (`id_ciudad`),
  CONSTRAINT `comuna_ibfk_1` FOREIGN KEY (`id_ciudad`) REFERENCES `ciudad` (`id_ciudad`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pais`
--

DROP TABLE IF EXISTS `pais`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pais` (
  `id_pais` int(11) NOT NULL,
  `nom_pais` varchar(100) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1 CHECK (`activo` in (0,1)),
  PRIMARY KEY (`id_pais`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `region`
--

DROP TABLE IF EXISTS `region`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `region` (
  `id_region` int(11) NOT NULL,
  `nom_region` varchar(100) NOT NULL,
  `id_pais` int(11) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1 CHECK (`activo` in (0,1)),
  PRIMARY KEY (`id_region`),
  KEY `idx_region_pais` (`id_pais`),
  CONSTRAINT `region_ibfk_1` FOREIGN KEY (`id_pais`) REFERENCES `pais` (`id_pais`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `resultado_pintado`
--

DROP TABLE IF EXISTS `resultado_pintado`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `resultado_pintado` (
  `id_res_pintado` int(11) NOT NULL AUTO_INCREMENT,
  `id_actividad` int(11) NOT NULL,
  `letra_esperada` varchar(10) NOT NULL,
  `trazo_interno` double NOT NULL,
  `trazo_externo` double NOT NULL,
  `area_completada` double NOT NULL,
  `puntaje_final` double NOT NULL,
  `aprobado_pintado` tinyint(1) NOT NULL DEFAULT 0 CHECK (`aprobado_pintado` in (0,1)),
  `duracion_pintado` int(11) NOT NULL,
  PRIMARY KEY (`id_res_pintado`),
  UNIQUE KEY `id_actividad` (`id_actividad`),
  CONSTRAINT `resultado_pintado_ibfk_1` FOREIGN KEY (`id_actividad`) REFERENCES `actividad` (`id_actividad`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `resultado_pronunciacion`
--

DROP TABLE IF EXISTS `resultado_pronunciacion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `resultado_pronunciacion` (
  `id_res_pronun` int(11) NOT NULL AUTO_INCREMENT,
  `id_actividad` int(11) NOT NULL,
  `texto_esperado` text NOT NULL,
  `texto_detectado` text NOT NULL,
  `porc_confianza` double NOT NULL,
  `aprobado_pronun` tinyint(1) NOT NULL DEFAULT 0 CHECK (`aprobado_pronun` in (0,1)),
  PRIMARY KEY (`id_res_pronun`),
  UNIQUE KEY `id_actividad` (`id_actividad`),
  CONSTRAINT `resultado_pronunciacion_ibfk_1` FOREIGN KEY (`id_actividad`) REFERENCES `actividad` (`id_actividad`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `resultado_sign`
--

DROP TABLE IF EXISTS `resultado_sign`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `resultado_sign` (
  `id_res_sign` int(11) NOT NULL AUTO_INCREMENT,
  `id_actividad` int(11) NOT NULL,
  `letra_esperada` varchar(10) NOT NULL,
  `letra_detectada` varchar(10) NOT NULL,
  `porc_confianza` double NOT NULL,
  `aprobado_sign` tinyint(1) NOT NULL DEFAULT 0 CHECK (`aprobado_sign` in (0,1)),
  PRIMARY KEY (`id_res_sign`),
  UNIQUE KEY `id_actividad` (`id_actividad`),
  CONSTRAINT `resultado_sign_ibfk_1` FOREIGN KEY (`id_actividad`) REFERENCES `actividad` (`id_actividad`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `resultado_une_palabras`
--

DROP TABLE IF EXISTS `resultado_une_palabras`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `resultado_une_palabras` (
  `id_res_une` int(11) NOT NULL AUTO_INCREMENT,
  `id_actividad` int(11) NOT NULL,
  `total_pares` int(11) NOT NULL,
  `aciertos` int(11) NOT NULL,
  `errores` int(11) NOT NULL,
  `puntaje_final` double NOT NULL DEFAULT 0,
  `aprobado_une` tinyint(1) NOT NULL DEFAULT 0,
  `duracion_une` int(11) NOT NULL,
  `detalle` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`detalle`)),
  PRIMARY KEY (`id_res_une`),
  UNIQUE KEY `uq_res_une_actividad` (`id_actividad`),
  CONSTRAINT `fk_res_une_actividad` FOREIGN KEY (`id_actividad`) REFERENCES `actividad` (`id_actividad`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `rol`
--

DROP TABLE IF EXISTS `rol`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `rol` (
  `id_rol` int(11) NOT NULL,
  `nom_rol` varchar(100) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1 CHECK (`activo` in (0,1)),
  PRIMARY KEY (`id_rol`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sesion`
--

DROP TABLE IF EXISTS `sesion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sesion` (
  `id_sesion` int(11) NOT NULL AUTO_INCREMENT,
  `id_usuario` int(11) DEFAULT NULL,
  `rut_intentado` varchar(20) NOT NULL,
  `exitosa` tinyint(1) NOT NULL CHECK (`exitosa` in (0,1)),
  `fecha_inicio` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_fin` datetime DEFAULT NULL,
  `ip_origen` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `motivo_fin` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id_sesion`),
  KEY `idx_sesion_usuario` (`id_usuario`),
  CONSTRAINT `sesion_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sesion_token`
--

DROP TABLE IF EXISTS `sesion_token`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sesion_token` (
  `id_sesion_token` int(11) NOT NULL AUTO_INCREMENT,
  `id_usuario` int(11) NOT NULL,
  `id_sesion` int(11) DEFAULT NULL,
  `refresh_token_hash` varchar(255) NOT NULL,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_expiracion` datetime NOT NULL,
  `revocado` tinyint(1) NOT NULL DEFAULT 0 CHECK (`revocado` in (0,1)),
  `ip_origen` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id_sesion_token`),
  UNIQUE KEY `refresh_token_hash` (`refresh_token_hash`),
  KEY `idx_sesion_token_usuario` (`id_usuario`),
  KEY `sesion_token_ibfk_2` (`id_sesion`),
  CONSTRAINT `sesion_token_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`) ON UPDATE CASCADE,
  CONSTRAINT `sesion_token_ibfk_2` FOREIGN KEY (`id_sesion`) REFERENCES `sesion` (`id_sesion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tipo_actividad`
--

DROP TABLE IF EXISTS `tipo_actividad`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tipo_actividad` (
  `id_tipo_actividad` int(11) NOT NULL,
  `nom_actividad` varchar(150) NOT NULL,
  `activa` tinyint(1) NOT NULL DEFAULT 1 CHECK (`activa` in (0,1)),
  PRIMARY KEY (`id_tipo_actividad`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `usuario`
--

DROP TABLE IF EXISTS `usuario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuario` (
  `id_usuario` int(11) NOT NULL AUTO_INCREMENT,
  `id_rol` int(11) NOT NULL,
  `id_colegio` int(11) NOT NULL,
  `rut_usuario` varchar(20) NOT NULL,
  `clave_hash` varchar(255) NOT NULL,
  `primer_nombre` varchar(100) NOT NULL,
  `segundo_nombre` varchar(100) NOT NULL,
  `a_paterno` varchar(100) NOT NULL,
  `a_materno` varchar(100) NOT NULL,
  `telefono_usuario` varchar(20) NOT NULL,
  `correo` varchar(150) NOT NULL,
  `url_avatar` varchar(255) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1 CHECK (`activo` in (0,1)),
  `ult_actividad` datetime DEFAULT current_timestamp(),
  `fecha_registro` datetime NOT NULL DEFAULT current_timestamp(),
  `creado_por` int(11) NOT NULL,
  `deshabilitado_por` int(11) DEFAULT NULL,
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `rut_usuario` (`rut_usuario`),
  UNIQUE KEY `correo` (`correo`),
  KEY `idx_usuario_rol` (`id_rol`),
  KEY `idx_usuario_colegio` (`id_colegio`),
  KEY `idx_usuario_creado_por` (`creado_por`),
  KEY `idx_usuario_deshabilitado_por` (`deshabilitado_por`),
  CONSTRAINT `usuario_ibfk_1` FOREIGN KEY (`id_colegio`) REFERENCES `colegio` (`id_colegio`) ON UPDATE CASCADE,
  CONSTRAINT `usuario_ibfk_2` FOREIGN KEY (`id_rol`) REFERENCES `rol` (`id_rol`) ON UPDATE CASCADE,
  CONSTRAINT `usuario_ibfk_3` FOREIGN KEY (`creado_por`) REFERENCES `usuario` (`id_usuario`) ON UPDATE CASCADE,
  CONSTRAINT `usuario_ibfk_4` FOREIGN KEY (`deshabilitado_por`) REFERENCES `usuario` (`id_usuario`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping routines for database 'nest_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed
