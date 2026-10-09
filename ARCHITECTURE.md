# Contuvoz System Architecture

> Last reviewed against the code: 2026-10-09. When something here disagrees with
> the code, the code wins — please fix this document in the same change.

## High-Level System Overview

**Contuvoz** is an educational web app for children (Chilean schools) that
practices early literacy and communication through four activities, plus the
tools adults need to follow each child's progress:

- **Pinta letras (drawing)**: the child traces a letter on a canvas; coverage and
  strokes outside the letter are scored in the browser.
- **Comunícate (sign language)**: the five vowels in Chilean Sign Language (LSCh),
  recognised from the webcam with MediaPipe hand landmarks and geometric rules.
- **Hablemos (speech)**: vowel pronunciation (A, E, I, O, U) detected from the
  microphone by formant analysis (F1/F2) with the Web Audio API — no ML model.
- **Une palabras (word matching)**: match words to pictures; first-try matches
  and confusions are recorded.
- **Mis logros (student dashboard)**: stars, streak, letters mastered per
  activity, hints derived from recent mistakes, and medals.
- **User management**: users by role and school, and links between each student
  and their teachers and guardians (with history).

The stack is **Angular 21** (frontend) and **NestJS 11** (backend) with
**Prisma 6** on **MariaDB/MySQL**. All recognition and scoring runs in the
browser; the server stores results and computes the dashboard from them.

### Roles

| Id | Role | Can |
|----|------|-----|
| 1 | Administrador | Everything, across schools |
| 2 | Admin. Colegio | Manage users and links within their school |
| 3 | Profesor | Create guardians and students (auto-linked as their teacher), link guardians to their own students |
| 4 | Apoderado (guardian) | Follow their linked children |
| 5 | Estudiante | Play activities, see Mis logros |

Only **Estudiante** and **Profesor** generate activity results (the teacher can
demo an activity in class). Other roles get a "practice mode" notice instead of
a save error.

---

## Major Modules and Responsibilities

### Frontend (Angular 21) - `src/`

#### Authentication & Session
- **`services/auth.service.ts`**: login/logout, access token in memory (signal),
  refresh token as HTTP-only cookie, current user profile (`/api/auth/me`).
- **`interceptors/auth.interceptor.ts`**: attaches the access token; on 401 runs
  a *shared* refresh (one refresh for many concurrent requests) and retries.
- **`app.config.ts`**: `provideAppInitializer` restores the session before the
  first render. A static skeleton inside `<app-root>` (`index.html`) is shown
  meanwhile.
- **Guards** (`guards/`): `authGuard` (logged in), `invitadoGuard` (`/login`
  redirects home if already logged in), `rolGuard` (user management:
  Administrador, Admin. Colegio, Profesor).

#### Activities
- **`pages/drawPage`** + `components/drawPage/letter-tracer`: canvas scoring,
  every attempt is saved.
- **`pages/signLanguage`** + `components/signLanguage/hand-tracker` +
  `services/signLanguage.service.ts`: MediaPipe HandLandmarker, per-vowel scores
  from finger angles/distances, a vowel counts only if held for 800 ms with a
  margin over the closest rival.
- **`pages/talkPage`** + `services/vowel-detector.service.ts`: 2 s capture,
  spectral envelope, F1/F2 peaks, nearest vowel in log-frequency space. Clear
  messages for denied/missing/busy microphone.
- **`pages/unePalabras`** + `interfaces/banco-palabras.ts`: rounds of 5 words
  from a 30-word bank.
- **`services/actividades.service.ts`**: POSTs results with retry + exponential
  backoff on network/5xx errors only. `puedeGuardarProgreso` hides saving for
  roles that would get 403.

#### Mis logros (student dashboard)
- **`pages/mis-logros`** + `services/mis-logros.service.ts`: summary on top
  (stars, streak, week, per-activity cards), a "Mis habilidades" separator, and
  one collapsible drawer per activity below. Medals are still fixed in code.

#### User management
- **`pages/gestion-usuarios`**: table on desktop, cards on mobile; search,
  role filter, "without guardian/teacher" filters, activate/deactivate with
  confirmation.
- **`components/gestion-usuarios/usuario-form`**: create/edit with RUT
  validation (`validators/rut.validator.ts`).
- **`components/gestion-usuarios/vinculos-modal`** + `services/vinculos.service.ts`:
  a student's teachers and guardians, add/remove according to role, full
  history for admins.

#### Shell & shared UI
- **`components/barra-superior`**: brand, Home, Mis logros (students), Biblioteca
  (coming soon), Usuarios, profile chip, logout (`components/logout-button`).
- **`components/shared/aviso-modo-practica`**: notice for roles that don't save.
- **Skeleton loading**: global `.sk` class in `src/styles.css`, used wherever data
  comes from the server. Shared admin styles in `src/styles/_gestion.scss`.
- All feature routes are **lazy loaded** (`app.routes.ts`); only login and home
  are in the initial bundle.

### Backend (NestJS 11) - `server-nest/`

All routes live under the global prefix **`/api`** (`main.ts`).

#### Auth — `src/auth/`
- `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`,
  `GET /api/auth/me`.
- RUT normalisation, bcrypt (10 rounds), JWT access token (default 15 min).
- Refresh token: random, stored **hashed** in `sesion_token`, **rotated on every
  refresh** (the old one is revoked), cookie `refresh_token` with
  `path=/api/auth`, `sameSite=strict`, `secure` in production.
- Every login attempt (ok or failed) is logged in `sesion` with IP and
  User-Agent. `tasks/sesiones-cleanup.service.ts` closes sessions whose tokens
  all expired (hourly cron + at startup).

#### Activities — `src/actividades/`
- `POST /api/actividades/pintado | sign | pronunciacion | une-palabras`.
- Creates `actividad` + the matching `resultado_*` row in one transaction and
  updates `usuario.ult_actividad`.
- Approval is decided on the server from the submitted metrics (e.g. sign:
  confidence ≥ 70 **and** held; speech: correct vowel **and** confidence ≥ 30;
  word matching: score recomputed from hits/pairs).
- ⚠️ Scores are **self-reported** by the browser; accepted on purpose for
  classroom use (see the note in `actividades.controller.ts`).

#### Users — `src/usuarios/dto/` *(module currently lives inside `dto/`)*
- CRUD, activate/deactivate (nobody can deactivate themselves), scoped by role
  (`PUEDE_GESTIONAR`) and school.
- `GET /api/usuarios` includes each student's **current** links and accepts
  `?sinVinculo=PROFESOR|APODERADO`.
- A teacher creating a student is linked as their teacher in the same transaction.

#### Links — `src/vinculos/`
- `POST /api/vinculos`, `PATCH /api/vinculos/:id/deshabilitar`,
  `GET /api/vinculos/estudiante/:id` (`?historial=true` for admins),
  `GET /api/vinculos/mis-estudiantes`.
- `VIGENTE` (`fechaFin: null`) is the single filter for current links;
  `puedeVerEstudiante()` is the permission used to see a child's details.

#### Mis logros — `src/mis-logros/`
- `GET /api/mis-logros` (own) and `GET /api/mis-logros/estudiante/:id`
  (admins or linked adults).
- Computed on the fly from the results tables; nothing new is stored:
  - star = approved attempt this week (Mon–Sun); streak ends today or yesterday;
  - letter **mastered** = ≥ 3 approved in its last 5 attempts, **practising** = 1–2;
  - hints from recent failures; known words = matched on the first try.
- Days are computed in `ZONA_HORARIA` (default `America/Santiago`): Prisma stores
  UTC, so an activity at 21:30 would otherwise fall on the next day.

#### Schools — `src/colegios/`
- `GET /api/colegios` for the admin's school selector. Geography: País → Región
  → Ciudad → Comuna → Colegio.

#### Database & Prisma
- **Schema**: `server-nest/prisma/schema.prisma`; **SQL scripts**:
  `script DB + insert/` (`01_estructura.sql`, `02_datos_base.sql`, `cambios/`).
- **No Prisma migrations**: structure changes are SQL scripts in `cambios/`.
  Don't use `prisma db push`/`migrate` — some tables have `CHECK` constraints and
  a generated column that Prisma can't create.
- **Tables (17)**: `usuario`, `rol`, `colegio`, `pais`, `region`, `ciudad`,
  `comuna`, `tipo_actividad`, `actividad`, `resultado_pintado`, `resultado_sign`,
  `resultado_pronunciacion`, `resultado_une_palabras`, `vinculo_estudiante`,
  `archivo_biblioteca`, `sesion`, `sesion_token`.
- **`vinculo_estudiante`**: student ↔ adult (`PROFESOR`/`APODERADO`), never
  deleted — closed with `fecha_fin` + `deshabilitado_por`. A generated column
  `vigente` plus a unique index guarantee one current link per pair and type.
- **First admin**: `npm run crear-admin` (`server-nest/scripts/crear-admin.ts`).

---

## Main Runtime and Data Flows

### 1. Login and session restore

```
Login page ── POST /api/auth/login ──▶ AuthController
                                         ├─ normalise RUT, find active user
                                         ├─ bcrypt.compare
                                         ├─ INSERT sesion (ok or failed)
                                         └─ generarTokens()
                                              ├─ sign JWT (sub, rol)
                                              ├─ INSERT sesion_token (hash)
                                              └─ Set-Cookie refresh_token (path /api/auth)
◀── { accessToken } ── AuthService stores it in memory, GET /api/auth/me, go home

App start (reload) ── provideAppInitializer ── POST /api/auth/refresh (cookie)
   └─ old token revoked, new pair issued ─▶ GET /api/auth/me ─▶ first render
```

### 2. Saving an activity result (drawing example)

```
LetterTracer.verify()  →  score computed in the browser
DrawPage ── puedeGuardarProgreso? ── no ─▶ show local result ("practice mode")
                                  └─ yes ─▶ POST /api/actividades/pintado
                                             (interceptor adds JWT, retries on 0/5xx)
ActividadesController (Estudiante | Profesor)
   └─ $transaction: INSERT actividad + resultado_pintado, UPDATE usuario.ult_actividad
◀── result with server-side "aprobado" ── UI shows it
```

### 3. Sign language recognition (client-heavy)

```
SignLanguage page opens → HandTracker: camera + MediaPipe model (served locally)
loop per frame:
   detectForVideo → landmarks → smoothing → score of each vowel (A E I O U)
   target ≥ 70, margin ≥ 15 over rival, held 800 ms → correct
   timeout (7 s) → attribute the failure to the rival held ≥ 400 ms, or NINGUNA
each vowel → shown immediately in the summary → POST /api/actividades/sign in background
summary → per-letter save status, "retry save" for failures
```

### 4. Vowel detection (Hablemos)

```
TalkPage → VowelDetectorService.listen(vowel, 2000 ms)
   ├─ getUserMedia (clear message if denied / missing / busy)
   ├─ AnalyserNode FFT every 30 ms while there is voice (RMS gate)
   ├─ accumulated spectrum → smoothed envelope → F1 (200–900 Hz), F2 (900–2800 Hz)
   └─ nearest reference vowel in log(F1, F2) → { detected, confidence }
TalkPage → success / failure feedback → POST /api/actividades/pronunciacion
```

### 5. Mis logros

```
MisLogros page → skeleton → GET /api/mis-logros
MisLogrosService (backend)
   ├─ one query: all the student's activities with their result
   ├─ days in ZONA_HORARIA → week, streak, stars per activity
   ├─ last 5 attempts per letter → mastered / practising / to discover
   └─ recent failures → hints; Une palabras detail → known words
frontend → known words ∩ word bank → "12 of 30" line
```

---

## External Services and APIs

### Client-side libraries
1. **@mediapipe/tasks-vision** — HandLandmarker (GPU delegate). The WASM files are
   copied from `node_modules` at build time and the model lives in
   `public/mediapipe/`: **no CDN at runtime** (school networks often block them).
2. **Web Audio API** — microphone capture and FFT for Hablemos (no library).
3. **Chart.js** — only used by the legacy `dashboard-page` (mock data).
4. **Google Fonts** — Nunito and Playwrite CU (`index.html`).

### Server-side integrations
- None: no third-party auth or APIs. Database is a local MariaDB/MySQL.

### Environment variables (backend `.env`)

```env
DATABASE_URL="mysql://user:pass@localhost:3306/nest_db"
JWT_SECRET="long-random-secret"
PORT=4000
HOST=127.0.0.1            # production: only reachable through Nginx
FRONTEND_URL="http://localhost:4200"
ACCESS_TOKEN_EXPIRA=15m
REFRESH_TOKEN_DIAS=7
ZONA_HORARIA=America/Santiago
NODE_ENV=production       # production: Secure refresh cookie
```

Frontend: `src/environments/environment.development.ts` →
`http://localhost:4000/api`; `environment.ts` (production) → `/api` (relative).

---

## Important Module Dependencies

### Frontend

```
App
├─ BarraSuperior ── AuthService, LogoutButton
├─ Login ── AuthService
├─ Home ── Option (activity grid)
├─ DrawPage ── LetterSelector, LetterTracer, ActividadesService
├─ SignLanguage ── HandTracker ── signLanguage.service (MediaPipe), ActividadesService
├─ TalkPage ── VocalSelector, PracticeButton, ResultFeedback, MascotHeader,
│              WaveformVisualizer, VowelDetectorService, ActividadesService
├─ UnePalabras ── banco-palabras, ActividadesService
├─ MisLogros ── MisLogrosService
├─ GestionUsuarios ── UsuariosService, UsuarioForm (ColegiosService),
│                     VinculosModal (VinculosService)
└─ DashboardPage (legacy, mock data, Chart.js)
Activities also use AvisoModoPractica.
```

### Backend

```
AppModule
├─ ConfigModule, ScheduleModule, PrismaModule (global)
├─ AuthModule ── JwtModule, PassportModule, SesionesCleanupService
├─ ActividadesModule
├─ VinculosModule (exports VinculosService)
├─ UsuariosModule ── imports VinculosModule (auto-link on create)
├─ MisLogrosModule ── imports VinculosModule (puedeVerEstudiante)
└─ ColegiosModule
```

### Key interdependencies

| Module | Depends on | Purpose |
|--------|-----------|---------|
| ActividadesService (front) | AuthService | Hide saving for roles that can't save |
| auth.interceptor | AuthService | Attach JWT, shared refresh on 401 |
| UsuariosService (back) | VinculosService | Link the teacher who creates a student |
| MisLogrosController | VinculosService | Who may see another student's dashboard |
| VinculosModal | Users list from GestionUsuarios | Candidates (same school, active, right role) |

---

## System Architecture Diagram

```mermaid
graph TB
    subgraph Client["Browser (Angular 21)"]
        direction LR
        Pages["Activities<br/>Mis logros<br/>User management"]
        AuthSvc["AuthService<br/>+ interceptor"]
        Services["HTTP services<br/>(actividades, usuarios,<br/>vinculos, mis-logros)"]
        SignSvc["signLanguage.service<br/>(MediaPipe)"]
        VowelSvc["VowelDetectorService<br/>(Web Audio)"]
        Pages --> Services
        Pages --> SignSvc
        Pages --> VowelSvc
        Services --> AuthSvc
    end

    subgraph Server["VPS"]
        Nginx["Nginx<br/>/ → dist<br/>/api/ → backend"]
        subgraph Backend["NestJS 11 (/api)"]
            Auth["auth"]
            Act["actividades"]
            Usr["usuarios"]
            Vin["vinculos"]
            Log["mis-logros"]
            Col["colegios"]
            Prisma["Prisma"]
            Auth --> Prisma
            Act --> Prisma
            Usr --> Prisma
            Usr --> Vin
            Vin --> Prisma
            Log --> Prisma
            Log --> Vin
            Col --> Prisma
        end
        DB[("MariaDB<br/>17 tables")]
        Prisma --> DB
        Nginx --> Backend
    end

    Client -->|HTTPS| Nginx
```

---

## Key User Request Flow: Sign Language Activity

```mermaid
sequenceDiagram
    actor Child
    participant UI as SignLanguage page
    participant HT as HandTracker
    participant ML as signLanguage.service
    participant API as Backend
    participant DB as Database

    Child->>UI: Opens Comunícate
    UI->>HT: Mount (camera starts)
    HT->>ML: esperarModelo() (local WASM + model)
    loop Each vowel A, E, I, O, U (7 s each)
        HT->>ML: detectForVideo(frame)
        ML-->>HT: landmarks
        HT->>HT: score all vowels, margin, hold 800 ms
        HT-->>UI: resultadoListo(letter, detected, confidence, held)
        UI->>UI: add to summary immediately
        par Save in background
            UI->>API: POST /api/actividades/sign
            API->>DB: INSERT actividad + resultado_sign
            API-->>UI: aprobado
        and Child continues
            Child->>HT: next vowel
        end
    end
    HT-->>UI: testTerminado (camera off)
    UI->>UI: summary with save status, retry if needed
```

---

## Dependencies and Versions

### Frontend
- Angular ^21.1.0 · TypeScript ~5.9.2 · RxJS ~7.8.0 · Tailwind CSS ^4.1.12
- @mediapipe/tasks-vision ^0.10.32 · Chart.js ^4.5.1
- Tests: Vitest ^4.0.8

### Backend
- NestJS ^11.0.1 · TypeScript ^5.7.3 · Prisma / @prisma/client ^6.19.3
- @nestjs/jwt, @nestjs/passport, passport-jwt, bcrypt ^6, @nestjs/schedule
- Tests: Jest ^30.0.0

### Database
- MariaDB 11 in development (MySQL 8 compatible: generated columns and `CHECK`
  constraints are required).

---

## Deployment Topology

See [DEPLOY.md](DEPLOY.md) for the step-by-step guide.

```
Client ──https──▶ Cloudflare ──tunnel──▶ VPS
                                          ├─ cloudflared (systemd, quick tunnel)
                                          ├─ Nginx :80 ─┬─ /      → dist/contuvoz/browser
                                          │             └─ /api/  → 127.0.0.1:4000
                                          ├─ NestJS (PM2, HOST=127.0.0.1)
                                          └─ MariaDB (local user, not root)
```

HTTPS is required: browsers only allow camera and microphone on secure origins.
Frontend and backend share one origin, which the `sameSite=strict` refresh cookie
needs. Updates: `deploy/actualizar.sh`.

---

## Development & Testing

### Running locally

```bash
# Frontend (repo root)
npm install
npm start            # http://localhost:4200
npm test             # Vitest

# Backend
cd server-nest
npm install
npx prisma generate
npm run start:dev    # http://localhost:4000/api
npm test             # Jest
```

### Database

```bash
mariadb -u root -p -e "CREATE DATABASE nest_db CHARACTER SET utf8mb4"
mariadb -u root -p nest_db < "script DB + insert/01_estructura.sql"
mariadb -u root -p nest_db < "script DB + insert/02_datos_base.sql"
cd server-nest && npm run crear-admin
```

### Key configuration files
- Frontend: `angular.json` (budgets, MediaPipe WASM asset copy),
  `src/environments/`, `src/styles.css`.
- Backend: `.env`, `prisma/schema.prisma`, `src/main.ts` (`/api` prefix, proxy).
- Deployment: `deploy/` (Nginx, tunnel service, `.env` template, update script).

---

## Security Considerations

1. **Authentication**
   - Access token 15 min, in memory only.
   - Refresh token 7 days, HTTP-only cookie, stored hashed, rotated on each use,
     revoked on logout. IP and User-Agent are **recorded** for auditing (not
     enforced).
2. **Session tracking**: every login attempt in `sesion`; expired sessions closed
   by an hourly job.
3. **Data protection**: bcrypt for passwords; `sameSite=strict` + `secure` cookie
   in production; the backend only listens on localhost behind Nginx.
4. **Authorization**
   - Roles checked from the JWT on every protected route; scope by school and
     role (`PUEDE_GESTIONAR`).
   - A child's details (dashboard, links) are visible to admins of their scope,
     their linked teachers/guardians, and the child.
   - Teachers can currently edit/deactivate any student of their school (product
     decision for now).
   - Activity scores are self-reported by the browser (see Activities above).

---

## Future Enhancements

- [ ] Teacher and guardian dashboards (backend endpoint already exists:
      `GET /api/mis-logros/estudiante/:id`)
- [ ] Medals computed from real data (currently fixed in code)
- [ ] Biblioteca (library) section — `archivo_biblioteca` table exists
- [ ] Ñ in the Pinta letras letter selector
- [ ] Calibrate Hablemos with children's voices
- [ ] Stable public URL (named Cloudflare tunnel + domain)
- [ ] Move the users module out of `usuarios/dto/`
