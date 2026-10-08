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

```bash
mariadb -u root -p nest_db < "script DB + insert/cambios/2026-10-06_vinculo_estudiante.sql"
```

Luego, en `server-nest`, `npx prisma generate`.

> **No usar `prisma db push` ni `prisma migrate`.** El proyecto no usa migraciones de Prisma, y algunas tablas tienen restricciones (`CHECK`, columnas calculadas) que Prisma no sabe crear: `db push` las borraría o intentaría "corregir" otras tablas. Los cambios de estructura van como scripts SQL en `cambios/`.

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
