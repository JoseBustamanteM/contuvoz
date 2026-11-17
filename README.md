# ConTuVoz

Aplicación educativa para niños con actividades de lectoescritura y comunicación:

| Actividad | Ruta | Qué hace |
|---|---|---|
| Pinta Letras | `/drawPage` | Trazado de letras sobre un canvas |
| Comunícate | `/signPage` | Lengua de señas con detección de manos (MediaPipe) |
| Hablemos | `/talkPage` | Pronunciación de vocales por análisis de formantes (Web Audio) |
| Une Palabras | `/unePage` | Unir palabras con su dibujo |

Toda la detección corre en el navegador; el backend solo guarda los resultados.

## Estructura

```
contuvoz/
├── src/           Frontend Angular 21
└── server-nest/   Backend NestJS + Prisma + MySQL/MariaDB
```

## Despliegue

Para subirla a una VPS con un túnel de Cloudflare (HTTPS sin dominio), ver [DEPLOY.md](DEPLOY.md).

## Requisitos

- Node.js 20.19 o superior
- MySQL o MariaDB corriendo localmente

## Puesta en marcha

### 1. Base de datos

Los scripts están en [`script DB + insert/`](script%20DB%20+%20insert/) y se cargan en orden:

| Archivo | Contenido |
|---|---|
| `01_estructura.sql` | Las 16 tablas, sin datos |
| `02_datos_base.sql` | Roles, tipos de actividad, país/región/ciudad/comuna y un colegio de prueba |

```bash
mariadb -u root -p -e "CREATE DATABASE nest_db CHARACTER SET utf8mb4"
```

```bash
mariadb -u root -p nest_db < "script DB + insert/01_estructura.sql"
```

```bash
mariadb -u root -p nest_db < "script DB + insert/02_datos_base.sql"
```

Los scripts no incluyen usuarios. El primer administrador se crea después de configurar el backend (paso 2).

#### Cambios de estructura en una base existente

`01_estructura.sql` siempre tiene la estructura completa (sirve para instalar desde cero). Si tu base ya existe, aplica en orden de fecha los scripts de [`script DB + insert/cambios/`](script%20DB%20+%20insert/cambios/) que todavía no tenga:

| Script | Qué hace |
|---|---|
| `2026-10-06_vinculo_estudiante.sql` | Tabla de vínculos estudiante ↔ profesor/apoderado, con historial |
| `2026-10-13_duracion_actividad.sql` | Columna `duracion` (segundos) en `actividad` para todas las actividades; elimina `duracion_pintado` y `duracion_une` (copia sus datos antes) |
| `2026-11-16_indices_sesion.sql` | Índices en `sesion` (RUT + fecha, IP + fecha) para el límite de intentos de login. Se puede ejecutar más de una vez |
| `2026-11-16_intento_actividad.sql` | Columna `id_intento` en `actividad` con índice único por usuario: un intento reenviado por falla de red no se guarda dos veces |
| `2026-11-16_version_reglas.sql` | Columna `version_reglas` en `actividad`: con qué versión de las reglas se evaluó cada intento (todo lo anterior queda en 1) |
| `2026-11-16_letras_pronunciacion.sql` | `texto_esperado` y `texto_detectado` de `resultado_pronunciacion` pasan de `TEXT` a `VARCHAR(10)`, como en las otras actividades |
| `2026-11-16_checks_resultados.sql` | Restricciones `CHECK` de rango en las tablas de resultados (puntajes y confianza entre 0 y 100, aciertos ≤ pares). El script indica cómo comprobar antes que ninguna fila las viola |
| `2026-11-16_indice_actividad_fecha.sql` | Índice `(id_usuario, fecha_actividad)` en `actividad`, para el límite de intentos por minuto y Mis logros. Se puede ejecutar más de una vez |
| `2026-11-17_auditoria.sql` | Tabla `auditoria`: quién creó, editó, desactivó o vinculó a quién (sin contraseñas) |
| `2026-11-17_cambios_aplicados.sql` | Tabla `cambios_aplicados`, que registra qué scripts de esta carpeta tiene la base. Marca como aplicados todos los anteriores: úsalo solo si la base los tiene (ver DEPLOY.md, "Registro de scripts") |

```bash
mariadb -u root -p nest_db < "script DB + insert/cambios/2026-10-06_vinculo_estudiante.sql"
mariadb -u root -p nest_db < "script DB + insert/cambios/2026-10-13_duracion_actividad.sql"
mariadb -u root -p nest_db < "script DB + insert/cambios/2026-11-16_indices_sesion.sql"
mariadb -u root -p nest_db < "script DB + insert/cambios/2026-11-16_intento_actividad.sql"
mariadb -u root -p nest_db < "script DB + insert/cambios/2026-11-16_version_reglas.sql"
mariadb -u root -p nest_db < "script DB + insert/cambios/2026-11-16_letras_pronunciacion.sql"
mariadb -u root -p nest_db < "script DB + insert/cambios/2026-11-16_checks_resultados.sql"
mariadb -u root -p nest_db < "script DB + insert/cambios/2026-11-16_indice_actividad_fecha.sql"
mariadb -u root -p nest_db < "script DB + insert/cambios/2026-11-17_auditoria.sql"
mariadb -u root -p nest_db < "script DB + insert/cambios/2026-11-17_cambios_aplicados.sql"
```

Luego, en `server-nest`, `npx prisma generate`.

> **No usar `prisma db push` ni `prisma migrate`.** El proyecto no usa migraciones de Prisma, y algunas tablas tienen restricciones (`CHECK`, columnas calculadas) que Prisma no sabe crear: `db push` las borraría o intentaría "corregir" otras tablas. Los cambios de estructura van como scripts SQL en `cambios/`.

> **Fechas en UTC.** El backend (Prisma) guarda todas las fechas en UTC. Si insertas filas a mano, usa `UTC_TIMESTAMP()` y no `NOW()`: en un PC con hora de Chile, `NOW()` y los `DEFAULT current_timestamp()` quedan 3 o 4 horas corridos. En la VPS, MariaDB se deja en UTC (ver DEPLOY.md, "Zona horaria").

Para regenerar los scripts después de cambiar la estructura:

```bash
mariadb-dump -u root -p --no-data --routines --triggers --skip-dump-date nest_db > "script DB + insert/01_estructura.sql"
```

```bash
mariadb-dump -u root -p --no-create-info --complete-insert --skip-dump-date nest_db rol tipo_actividad pais region ciudad comuna colegio > "script DB + insert/02_datos_base.sql"
```

No exportar la base completa: contiene usuarios reales, hashes de contraseñas y tokens de sesión.

El modelo de Prisma está en [`server-nest/prisma/schema.prisma`](server-nest/prisma/schema.prisma). Las tablas `rol` y `tipo_actividad` deben tener estos ids, porque el backend los usa directamente:

| `rol` | id | | `tipo_actividad` | id |
|---|---|---|---|---|
| Administrador | 1 | | Pinta Letras | 1 |
| Admin_colegio | 2 | | Comunícate | 2 |
| Profesor | 3 | | Hablemos | 3 |
| Apoderado | 4 | | Une Palabras | 4 |
| Estudiante | 5 | | | |

### 2. Backend (`server-nest`)

Crear `server-nest/.env`:

```env
DATABASE_URL="mysql://USUARIO:CLAVE@localhost:3306/nest_db"
JWT_SECRET="una-cadena-larga-y-aleatoria"
PORT=4000
FRONTEND_URL="http://localhost:4200"
ACCESS_TOKEN_EXPIRA=15m
REFRESH_TOKEN_DIAS=7
```

| Variable | Obligatoria | Por defecto |
|---|---|---|
| `DATABASE_URL` | Sí | — |
| `JWT_SECRET` | Sí (el servidor no arranca sin ella) | — |
| `PORT` | No | `4000` |
| `FRONTEND_URL` | No (origen permitido por CORS) | `http://localhost:4200` |
| `ACCESS_TOKEN_EXPIRA` | No | `15m` |
| `REFRESH_TOKEN_DIAS` | No | `7` |
| `ZONA_HORARIA` | No (para calcular "esta semana" y la racha en Mis logros) | `America/Santiago` |

Luego:

```bash
cd server-nest
npm install
npx prisma generate
```

Crear el primer administrador (solo la primera vez, con la base recién cargada):

```bash
npm run crear-admin
```

El script pide RUT, nombres y apellidos, correo, teléfono y contraseña (mínimo 8 caracteres, no se muestra al escribirla) y crea un usuario con rol Administrador. La contraseña no queda guardada en ningún archivo, solo su hash en la base. Se puede volver a ejecutar para crear más administradores. El código está en [`server-nest/scripts/crear-admin.ts`](server-nest/scripts/crear-admin.ts).

Con ese usuario se inicia sesión, y desde **Gestión de usuarios** se crean los profesores, estudiantes y demás roles.

Levantar la API:

```bash
npm run start:dev
```

La API queda en `http://localhost:4000`.

### 3. Frontend

Desde la raíz del proyecto:

```bash
npm install
npm start
```

Abrir `http://localhost:4200`. La URL de la API se configura en `src/environments/environment.development.ts` (desarrollo) y `src/environments/environment.ts` (producción).

## Roles y guardado de progreso

Solo los usuarios **Estudiante** y **Profesor** registran resultados de actividades. Los demás roles pueden abrir las actividades, pero su progreso no se guarda y la aplicación lo indica en pantalla.

## Comandos útiles

| Dónde | Comando | Qué hace |
|---|---|---|
| raíz | `npm run build` | Compila el frontend en `dist/` |
| raíz | `npm test` | Tests del frontend (Vitest) |
| `server-nest` | `npm run build` | Compila el backend |
| `server-nest` | `npm test` | Tests del backend (Jest) |
| `server-nest` | `npm run crear-admin` | Crea un usuario Administrador |
