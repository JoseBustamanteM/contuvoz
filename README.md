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

Crear la base y cargar el esquema con sus datos iniciales (roles, tipos de actividad, colegios y usuarios). El esquema está definido en [`server-nest/prisma/schema.prisma`](server-nest/prisma/schema.prisma).

Las tablas `rol` y `tipo_actividad` deben tener estos ids, porque el backend los usa directamente:

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

Luego:

```bash
cd server-nest
npm install
npx prisma generate
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
