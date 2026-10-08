# Contuvoz System Architecture

## High-Level System Overview

**Contuvoz** is an accessibility-focused web application designed to help users with hearing and speech challenges develop communication skills through interactive exercises. The system provides:

- **Drawing-to-Text Activity**: Users trace letters on screen while the system evaluates stroke precision and coverage
- **Sign Language Recognition**: Real-time hand gesture recognition using MediaPipe vision models to identify sign language letters
- **Vowel Detection & Speech Practice**: Microphone-based audio analysis to detect and validate vowel pronunciation (A, E, I, O, U)
- **Activity Tracking & Analytics**: Dashboard to view performance history and progress over time
- **User & Role Management**: Admin controls to manage users, assign roles, and track sessions

The architecture is built on **Angular 21** (frontend) and **NestJS 11** (backend), with Prisma ORM managing a MySQL database. The system emphasizes offline-first design for activities while maintaining cloud persistence for results and user data.

---

## Major Modules and Responsibilities

### Frontend (Angular 21) - `src/`

#### **Authentication & Session Management**
- **Module**: `services/auth.service.ts`
- **Responsibility**: 
  - JWT-based login/logout with refresh token flow
  - Session persistence across browser reloads
  - Access token storage in memory (signals)
  - Refresh token stored as HTTP-only cookie
  - Automatic token refresh on 401 responses via auth interceptor
- **Key Features**: 
  - Shared refresh mechanism to avoid multiple concurrent refreshes
  - Session verification on app startup
  - Role-based access control (via guards)

#### **Activity Management**
- **Modules**: 
  - `services/actividades.service.ts` - HTTP endpoints for saving results
  - `services/vowel-detector.service.ts` - Audio analysis using HuggingFace transformers
  - `services/signLanguage.service.ts` - Hand pose detection with MediaPipe
- **Responsibility**:
  - Record and upload activity results (drawing, sign, vowel)
  - Real-time ML inference for gesture/audio recognition
  - Retry logic for failed uploads with exponential backoff
- **Processing**: All heavy lifting done client-side; only results sent to server

#### **UI Pages**
- **LoginComponent**: Credential-based entry point
- **HomePageComponent**: Dashboard hub linking to activities
- **DrawPageComponent**: Letter tracing canvas with stroke evaluation
- **SignLanguageComponent**: Hand gesture video capture and recognition
- **TalkPageComponent**: Vowel pronunciation practice with waveform visualization
- **DashboardPageComponent**: Performance metrics and history
- **GestionUsuariosComponent**: Admin panel for user management (role-guarded)

#### **Routing & Guards**
- **auth.guard.ts**: Redirects unauthenticated users to login
- **rol.guard.ts**: Restricts admin pages to authorized roles
- **Routes**: Protected paths require both guards; public only `/login`

#### **HTTP Interceptors**
- **auth.interceptor.ts**: Attaches access token to outbound requests; handles 401 by triggering shared refresh

### Backend (NestJS 11) - `server-nest/`

#### **Authentication Module**
- **Services**: `auth/auth.service.ts`
- **Controllers**: `auth/auth.controller.ts`
- **Responsibility**:
  - User credential validation (RUT normalization, bcrypt hashing)
  - JWT token generation with configurable expiration
  - Refresh token management (hashed, single-use, with IP/User-Agent tracking)
  - Session logging (successful and failed login attempts)
  - Token revocation on logout
- **Flow**:
  1. Login endpoint validates credentials against `usuario` table
  2. Creates `sesion` record to track attempt
  3. Generates `accessToken` (15m default) and `refreshTokenPlano`
  4. Stores refresh token hash in `sesionToken` table
  5. Returns tokens; refresh goes to HTTP-only cookie
- **Strategies**: Passport JWT for route-level protection

#### **Activities Module**
- **Services**: `actividades/actividades.service.ts`
- **Controllers**: `actividades/actividades.controller.ts`
- **Responsibility**:
  - Persist activity results (drawings, sign language, pronunciation)
  - Associate results with users and activity types
  - Score validation and performance metrics
  - Retrieve user activity history
- **Models**: 
  - `ResultadoPintado` (drawing: strokes, area, score)
  - `ResultadoPronunciacion` (speech: detected text, confidence)
  - `ResultadoSign` (gestures: detected letter, confidence)

#### **Users Module**
- **Services**: `usuarios/usuarios.service.ts`
- **Responsibility**:
  - User CRUD operations
  - Role assignment
  - School affiliation
  - Active/inactive status management
- **Audit Trail**: `creadoPor` and `deshabilitadoPor` track administrative actions

#### **Schools Module**
- **Services**: `colegios/colegios.service.ts`
- **Responsibility**:
  - School master data (location, contact)
  - Geographic hierarchy (País → Región → Ciudad → Comuna → Colegio)

#### **Prisma ORM & Database**
- **File**: `server-nest/prisma/schema.prisma`
- **Database**: MySQL
- **Key Tables**:
  - `usuario` - user accounts with role & school
  - `actividad` - parent record for all activities
  - `resultado_pintado`, `resultado_pronunciacion`, `resultado_sign` - results by type
  - `sesion` - login session tracking
  - `sesion_token` - refresh token records with revocation
  - `tipo_actividad` - activity type enum (drawing, sign, vowel)
  - `rol`, `colegio`, `region`, `ciudad`, `comuna` - reference data

---

## Main Runtime and Data Flows

### 1. **User Authentication Flow**

```
┌─────────────────┐
│  Login Page     │
│  (credentials)  │
└────────┬────────┘
         │ POST /auth/login
         ▼
┌─────────────────────────────────────┐
│  NestJS: auth.controller.login()    │
│  ├─ Normalize RUT                   │
│  ├─ Query usuario by RUT + active   │
│  ├─ Compare password (bcrypt)       │
│  └─ Create sesion record            │
└────────┬────────────────────────────┘
         │ if valid:
         ▼
┌──────────────────────────────────────┐
│  auth.service.generarTokens()        │
│  ├─ Sign JWT (sub, rol, 15m exp)    │
│  ├─ Generate refresh token (64 bytes)│
│  ├─ Hash & store in sesionToken      │
│  └─ Update usuario.ultActividad      │
└────────┬─────────────────────────────┘
         │ Response + Set-Cookie
         ▼
┌──────────────────────────────────┐
│  Frontend AuthService             │
│  ├─ accessToken.set(token)       │
│  ├─ refreshToken in HTTP-only    │
│  └─ Redirect to home             │
└──────────────────────────────────┘
```

### 2. **Activity Result Submission Flow (Drawing Example)**

```
┌──────────────────────────┐
│  DrawPageComponent       │
│  onResultadoListo()      │
│  (local computation)     │
└────────┬─────────────────┘
         │ {letra, trazo%, area%, score}
         ▼
┌──────────────────────────────────┐
│  ActividadesService              │
│  guardarPintado(resultado)       │
│  POST /actividades/pintado       │
└────────┬─────────────────────────┘
         │ include accessToken (interceptor)
         ▼
┌─────────────────────────────────────────┐
│  NestJS: actividades.controller         │
│  ├─ Extract JWT (user ID, role)        │
│  ├─ Create actividad record            │
│  └─ Create resultado_pintado          │
└────────┬────────────────────────────────┘
         │ if error: frontend retries with backoff
         ▼
┌──────────────────────────────────┐
│  Database (Prisma)              │
│  INSERT actividad, resultado    │
└──────────────────────────────────┘
         │
         │ Response
         ▼
┌──────────────────────────────────┐
│  Frontend: Update UI state       │
│  ├─ estadoGuardado = 'ok'       │
│  └─ Display success feedback     │
└──────────────────────────────────┘
```

### 3. **Sign Language Recognition Flow (Client-Heavy)**

```
┌──────────────────────────────┐
│  SignLanguageComponent       │
│  iniciarEvaluacion()         │
│  ├─ Open camera (MediaPipe)  │
│  └─ Start hand tracking loop │
└────────┬─────────────────────┘
         │ for each frame
         ▼
┌──────────────────────────────────────┐
│  signLanguage.service.ts             │
│  ├─ Pull video frame                 │
│  ├─ HandLandmarker.detectForVideo()  │
│  ├─ Extract hand keypoints           │
│  ├─ Local ML inference (pose angles) │
│  ├─ Classify letter A-Z              │
│  └─ Calculate confidence %           │
└────────┬─────────────────────────────┘
         │ Result {letter, confidence, sostenida}
         ▼
┌──────────────────────────────────────────────┐
│  SignLanguageComponent.onResultadoListo()    │
│  ├─ Show result locally (immediate feedback) │
│  ├─ Push to resumen array                    │
│  └─ Trigger background save                  │
└────────┬───────────────────────────────────────┘
         │ Background: ActividadesService.guardarSign()
         │ POST /actividades/sign (with retry)
         ▼
┌─────────────────────────────────────┐
│  NestJS: actividades.controller     │
│  ├─ Receive sign result             │
│  ├─ Create actividad + resultado    │
│  └─ Validate (>=70% confidence)     │
└────────┬────────────────────────────┘
         │ Response updates UI (ok/error)
         ▼
┌────────────────────────────────┐
│  Frontend: Update resumen       │
│  [{ letra, confianza, ok/err }] │
└────────────────────────────────┘
```

### 4. **Vowel Detection Flow**

```
┌─────────────────────────────┐
│  TalkPageComponent          │
│  onPracticeStart()          │
│  (selected vocal: e.g., 'A')│
└────────┬────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│  vowel-detector.service.listen()   │
│  ├─ Request microphone permission  │
│  ├─ Start AudioContext.record()    │
│  ├─ Capture 2000ms of audio        │
│  └─ Convert to Mel-spectrogram     │
└────────┬───────────────────────────┘
         │ Raw audio buffer
         ▼
┌──────────────────────────────────────────┐
│  HuggingFace Transformers (local WASM)   │
│  ├─ Feature extraction (MFCC)           │
│  ├─ Pass to pre-trained vowel model     │
│  └─ Output: {A:0.8, E:0.1, ...}        │
└────────┬─────────────────────────────────┘
         │ Confidence of detected vowel
         ▼
┌──────────────────────────────────────┐
│  TalkPageComponent                   │
│  ├─ Compare detected vs selected     │
│  ├─ practiceState = 'success/fail'   │
│  └─ Show feedback + waveform visual  │
└──────────────────────────────────────┘
         │ (Optional: Save to server)
         ▼
```

---

## External Services and APIs

### Client-Side ML Libraries

1. **@mediapipe/tasks-vision** (v0.10.32)
   - Hand gesture recognition for sign language
   - Landmarker detection running in WebGL
   - Models bundled in WASM; no external API calls

2. **@huggingface/transformers** (v4.1.0)
   - Vowel classification from audio spectrograms
   - Local WASM inference; offline capable
   - Pre-trained models cache in browser

3. **vosk-browser** (v0.0.8)
   - Optional speech-to-text (Vosk offline ASR)
   - WebRTC audio capture
   - GPU-accelerated inference if available

### Server-Side External Integrations

- **None listed** – system is self-contained
- Database is internal MySQL instance
- JWT tokens are internal (no third-party auth)

### Environment Variables (Backend)

```env
DATABASE_URL=mysql://user:pass@localhost:3306/contuvoz_db
ACCESS_TOKEN_EXPIRA=15m
REFRESH_TOKEN_DIAS=7
JWT_SECRET=your-secret-key
PORT=4000
FRONTEND_URL=http://localhost:4200
```

---

## Important Module Dependencies

### Frontend Dependency Graph

```
App (root)
│
├─ LoginComponent
│  └─ AuthService
│     └─ HttpClient
│
├─ HomePageComponent
│  └─ AuthService
│
├─ DrawPageComponent
│  ├─ LetterTracerComponent
│  ├─ LetterSelectorComponent
│  └─ ActividadesService
│     └─ HttpClient
│
├─ SignLanguageComponent
│  ├─ HandTrackerComponent
│  │  └─ signLanguage.service (MediaPipe)
│  └─ ActividadesService
│
├─ TalkPageComponent
│  ├─ VocalSelectorComponent
│  ├─ PracticeButtonComponent
│  └─ VowelDetectorService (HuggingFace)
│
├─ DashboardPageComponent
│  └─ ActividadesService
│
└─ GestionUsuariosComponent (admin)
   ├─ authGuard + rolGuard
   └─ UsuariosService
```

### Backend Dependency Graph

```
AppModule
│
├─ ConfigModule (env vars)
├─ ScheduleModule (scheduled tasks)
├─ PrismaModule (DB access)
│
├─ AuthModule
│  ├─ JwtModule (sign/verify)
│  ├─ PassportModule (jwt strategy)
│  └─ AuthService → PrismaService
│
├─ ActividadesModule
│  ├─ ActividadesService → PrismaService
│  └─ ActividadesController
│     └─ JwtGuard (protected)
│
├─ UsuariosModule
│  ├─ UsuariosService → PrismaService
│  └─ UsuariosController
│     └─ JwtGuard + RolGuard
│
└─ ColegiosModule
   ├─ ColegiosService → PrismaService
   └─ ColegiosController
```

### Key Interdependencies

| Module | Depends On | Purpose |
|--------|-----------|---------|
| ActividadesService | PrismaService | Persist & query activity results |
| AuthService | JwtService, PrismaService | Token generation, session tracking |
| auth.interceptor | AuthService | Attach JWT to requests, trigger refresh |
| All guarded routes | AuthService (signals) | Check login status, enforce roles |
| DrawPageComponent | ActividadesService | Submit drawing results |
| SignLanguageComponent | signLanguage.service + ActividadesService | Detect gestures, persist |
| TalkPageComponent | VowelDetectorService | Local audio analysis |

---

## System Architecture Diagram

```mermaid
graph TB
    subgraph Client["Client (Angular 21)"]
        direction LR
        Login["Login<br/>Component"]
        Home["Home<br/>Page"]
        Draw["Draw<br/>Activity"]
        Sign["Sign Language<br/>Activity"]
        Talk["Vowel<br/>Activity"]
        Dashboard["Dashboard<br/>Page"]
        Admin["Admin<br/>Users"]
        
        AuthSvc["AuthService<br/>(JWT + Refresh)"]
        ActSvc["ActividadesService<br/>(HTTP)"]
        SignSvc["signLanguage.service<br/>(MediaPipe)"]
        VowelSvc["VowelDetectorService<br/>(HuggingFace)"]
        Interceptor["auth.interceptor<br/>(+ JWT to requests)"]
        
        Login --> AuthSvc
        Home --> AuthSvc
        Draw --> ActSvc
        Sign --> SignSvc
        Sign --> ActSvc
        Talk --> VowelSvc
        Talk --> ActSvc
        Dashboard --> ActSvc
        Admin --> ActSvc
        
        AuthSvc -.-> Interceptor
        ActSvc --> Interceptor
    end
    
    subgraph Backend["Backend (NestJS 11)"]
        direction LR
        AuthCtrl["Auth<br/>Controller"]
        AuthMod["Auth<br/>Service"]
        ActCtrl["Actividades<br/>Controller"]
        ActMod["Actividades<br/>Service"]
        UsrCtrl["Usuarios<br/>Controller"]
        UsrMod["Usuarios<br/>Service"]
        ColCtrl["Colegios<br/>Controller"]
        ColMod["Colegios<br/>Service"]
        
        Prisma["Prisma<br/>ORM"]
        JWT["JWT<br/>Module"]
        
        AuthCtrl --> AuthMod
        AuthMod --> JWT
        AuthMod --> Prisma
        
        ActCtrl --> ActMod
        ActMod --> Prisma
        
        UsrCtrl --> UsrMod
        UsrMod --> Prisma
        
        ColCtrl --> ColMod
        ColMod --> Prisma
    end
    
    subgraph Libs["ML Libraries (Browser)"]
        MediaPipe["MediaPipe<br/>HandLandmarker"]
        HF["HuggingFace<br/>Transformers"]
        Vosk["Vosk<br/>ASR"]
    end
    
    subgraph DB["Database (MySQL)"]
        direction LR
        Usuario["usuario"]
        Actividad["actividad"]
        ResDrawing["resultado_pintado"]
        ResPronun["resultado_pronunciacion"]
        ResSign["resultado_sign"]
        Sesion["sesion"]
        SesionToken["sesion_token"]
        
        Actividad --> ResDrawing
        Actividad --> ResPronun
        Actividad --> ResSign
        Sesion --> Usuario
        SesionToken --> Usuario
    end
    
    Client -->|HTTP/REST| Backend
    Backend --> DB
    Sign -.->|WebGL| MediaPipe
    Talk -.->|WASM| HF
    Talk -.->|WebRTC| Vosk
```

---

## Module Dependencies Diagram

```mermaid
graph LR
    subgraph Frontend
        A["AuthService"]
        B["ActividadesService"]
        C["signLanguage.service"]
        D["VowelDetectorService"]
        E["auth.interceptor"]
        
        A -->|refresh token flow| E
        E -->|attach JWT| B
        B -->|use auth token| E
    end
    
    subgraph Backend
        F["AuthService"]
        G["ActividadesService"]
        H["UsuariosService"]
        I["PrismaService"]
        J["JwtModule"]
        
        F --> J
        F --> I
        G --> I
        H --> I
    end
    
    subgraph Database
        K["MySQL<br/>schema"]
    end
    
    subgraph MLLibs
        L["MediaPipe<br/>WASM"]
        M["HuggingFace<br/>WASM"]
    end
    
    A -->|calls| F
    B -->|calls| G
    C -->|local inference| L
    D -->|local inference| M
    
    F -->|read/write| K
    G -->|read/write| K
    H -->|read/write| K
    I -->|ORM| K
```

---

## Key User Request Flow: Sign Language Activity

This flow illustrates the most complex activity (real-time ML + network resilience):

```mermaid
sequenceDiagram
    actor User
    participant UI as SignLanguage<br/>Component
    participant ML as signLanguage<br/>Service
    participant HTTP as ActividadesService
    participant Auth as auth.interceptor
    participant API as Backend
    participant DB as Database
    
    User->>UI: Click "Iniciar Evaluación"
    activate UI
    UI->>ML: Start hand tracking loop
    activate ML
    
    loop For each gesture
        ML->>ML: Capture video frame
        ML->>ML: MediaPipe.detectForVideo()
        ML->>ML: Classify letter (A-Z)
        ML->>ML: Calculate confidence %
        ML->>UI: onResultadoListo({letter, conf})
        
        Note over UI: Show result immediately<br/>(offline-first)
        UI->>UI: Push to resumen array
        UI->>UI: Display feedback
        
        Note over HTTP: Background save (don't block)
        par Save to server
            HTTP->>Auth: POST /actividades/sign
            Auth->>Auth: Attach JWT token
            Auth->>API: Send request
            activate API
            API->>DB: INSERT actividad + resultado_sign
            DB-->>API: OK
            API-->>Auth: 201 {id, aprobado}
            deactivate API
        and User continues
            User->>UI: Practice next letter
        end
        
        HTTP-->>UI: Update state (ok/error)
    end
    
    User->>UI: End evaluation
    UI->>ML: Stop camera
    deactivate ML
    
    Note over UI: Display resumen summary<br/>with save status per letter
    UI->>UI: Show retry button if errors
    deactivate UI
```

---

## Dependencies and Versions

### Frontend
- **Angular**: 21.1.0
- **TypeScript**: ~5.9.2
- **RxJS**: ~7.8.0
- **TailwindCSS**: 4.1.12 (styling)
- **@mediapipe/tasks-vision**: 0.10.32
- **@huggingface/transformers**: 4.1.0
- **vosk-browser**: 0.0.8
- **Test**: Vitest 4.0.8

### Backend
- **NestJS**: 11.0.1
- **TypeScript**: 5.7.3
- **Prisma**: 6.19.3
- **@nestjs/jwt**: 11.0.2
- **@nestjs/passport**: 11.0.5
- **passport-jwt**: 4.0.1
- **bcrypt**: 6.0.0
- **Test**: Jest 30.0.0

### Database
- **MySQL**: (version not specified; use 8.0+)
- **Prisma Client**: 6.19.3

---

## Deployment Topology

```
┌──────────────────────────────────┐
│  Browser (Client)                │
│  ├─ Angular 21 SPA               │
│  ├─ ML models (WASM)             │
│  └─ WebGL/WebRTC                 │
└────────────┬─────────────────────┘
             │ HTTP/REST
             ▼
┌──────────────────────────────────┐
│  NestJS Backend (Node.js)        │
│  ├─ Port 4000                    │
│  ├─ JWT/Passport auth            │
│  ├─ CORS enabled                 │
│  └─ Cookie support               │
└────────────┬─────────────────────┘
             │ SQL queries
             ▼
┌──────────────────────────────────┐
│  MySQL Database                  │
│  ├─ Prisma migrations            │
│  └─ Indexed FK relations         │
└──────────────────────────────────┘
```

---

## Development & Testing

### Running Locally

**Frontend**:
```bash
cd <repo-root>
npm install
npm start                    # ng serve on :4200
npm test                     # Vitest
```

**Backend**:
```bash
cd server-nest
npm install
npm run start:dev           # NestJS on :4000
npm run test                # Jest
npm run test:cov            # Coverage
```

**Database**:
```bash
# Ensure MySQL is running (localhost:3306)
cd server-nest
npx prisma migrate dev      # Sync schema
npx prisma db seed          # (if seed.ts exists)
```

### Key Configuration Files
- **Frontend**: `angular.json`, `tsconfig.json`, `src/environments/`
- **Backend**: `.env`, `prisma/schema.prisma`, `nest-cli.json`
- **Database**: Schema in `prisma/schema.prisma`

---

## Security Considerations

1. **Authentication**
   - JWT access tokens: 15 minutes (short-lived)
   - Refresh tokens: 7 days (stored as hash, single-use)
   - Tokens bound to IP + User-Agent for session hijacking detection

2. **Session Tracking**
   - Every login attempt logged (`sesion` table)
   - Token revocation on logout
   - Failed login attempts tracked

3. **Data Protection**
   - Passwords hashed with bcrypt (salt rounds: 10)
   - HTTP-only cookies prevent XSS token theft
   - CORS restricted to frontend URL

4. **Authorization**
   - Role-based guards on admin routes
   - Users can only access their own activity records
   - Role checked in JWT claims at every protected endpoint

---

## Future Enhancements

- [ ] WebSocket for real-time collaborative dashboards
- [ ] Video recording of gestures for teacher review
- [ ] Gamification (badges, progress bars, leaderboards)
- [ ] Multi-language support (i18n)
- [ ] Mobile app (React Native or Flutter)
- [ ] Advanced analytics (learning curves, remediation recommendations)
- [ ] Export reports (PDF, CSV)
- [ ] Offline-first PWA with service workers
