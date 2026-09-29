/**
 * Prisma seed script for Contuvoz — matches server-nest/prisma/schema.prisma
 * exactly (field names, @map columns, and relations below were taken
 * directly from the schema you provided).
 *
 * Setup:
 *   cd server-nest
 *   npm install -D @faker-js/faker ts-node
 *   npm install bcrypt
 *
 * Add to server-nest/package.json:
 *   "prisma": {
 *     "seed": "ts-node prisma/seed.ts"
 *   }
 *
 * Run:
 *   npx prisma db seed
 *
 * Safety: clearDatabase() truncates every table (with FK checks briefly
 * disabled) so this is safe to re-run in a dev DB. NEVER point this at a
 * production DATABASE_URL — it deletes everything first.
 */

import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ---- Config: tune volume of mock data here ----
const NUM_REGIONES = 3;
const NUM_CIUDADES_PER_REGION = 2;
const NUM_COMUNAS_PER_CIUDAD = 2;
const NUM_COLEGIOS_PER_COMUNA = 2;
const NUM_USUARIOS = 40;
const NUM_ACTIVIDADES_PER_USUARIO = 5;
const NUM_ARCHIVOS = 15;

// Fixed IDs for the three activity types, so we know which result table
// to populate for each activity we create.
const TIPO_PINTADO = 1;
const TIPO_SIGN = 2;
const TIPO_VOCAL = 3;

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generarRut(): string {
  // Mock RUT generator — not a valid check-digit algorithm, fine for seed
  // data only. Do not reuse this for real RUT validation logic.
  const num = faker.number.int({ min: 5_000_000, max: 25_000_000 });
  const dv = randomItem(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'K']);
  return `${num}${dv}`;
  //return `${num}-${dv}`;
}

function generarTelefono(): string {
  // Fixed-format Chilean mobile number, always 12 chars — comfortably
  // fits telefono_usuario's VarChar(20). faker.phone.number() was
  // producing longer/variable-length strings that overflowed the column.
  return `+569${faker.string.numeric(8)}`;
}

// ---- Clear (truncate) all tables, FK checks off for the duration ----

async function clearDatabase() {
  console.log('Clearing existing data...');
  const tables = [
    'resultado_sign',
    'resultado_pronunciacion',
    'resultado_pintado',
    'archivo_biblioteca',
    'sesion_token',
    'sesion',
    'actividad',
    'usuario',
    'colegio',
    'comuna',
    'ciudad',
    'region',
    'pais',
    'tipo_actividad',
    'rol',
  ];

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of tables) {
      await tx.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\`;`);
    }
    await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
  });
}

// ---- Reference data (manual IDs — these tables are NOT autoincrement) ----

async function seedRoles() {
  const data = [
    { idRol: 1, nomRol: 'admin' },
    { idRol: 2, nomRol: 'docente' },
    { idRol: 3, nomRol: 'estudiante' },
  ];
  for (const r of data) await prisma.rol.create({ data: r });
  console.log(`Seeded ${data.length} roles`);
  return data;
}

async function seedTiposActividad() {
  const data = [
    { idTipoActividad: TIPO_PINTADO, nomActividad: 'Pintado de letras' },
    { idTipoActividad: TIPO_SIGN, nomActividad: 'Reconocimiento de lengua de señas' },
    { idTipoActividad: TIPO_VOCAL, nomActividad: 'Pronunciación de vocales' },
  ];
  for (const t of data) await prisma.tipoActividad.create({ data: t });
  console.log(`Seeded ${data.length} tipos de actividad`);
  return data;
}

async function seedGeografia() {
  const pais = await prisma.pais.create({
    data: { idPais: 1, nomPais: 'Chile' },
  });

  const colegios: { idColegio: number }[] = [];
  let regionId = 1;
  let ciudadId = 1;
  let comunaId = 1;
  let colegioId = 1;

  for (let r = 0; r < NUM_REGIONES; r++) {
    const region = await prisma.region.create({
      data: {
        idRegion: regionId++,
        nomRegion: `Región de ${faker.location.state()}`,
        idPais: pais.idPais,
      },
    });

    for (let c = 0; c < NUM_CIUDADES_PER_REGION; c++) {
      const ciudad = await prisma.ciudad.create({
        data: {
          idCiudad: ciudadId++,
          nomCiudad: faker.location.city(),
          idRegion: region.idRegion,
        },
      });

      for (let cm = 0; cm < NUM_COMUNAS_PER_CIUDAD; cm++) {
        const comuna = await prisma.comuna.create({
          data: {
            idComuna: comunaId++,
            nomComuna: faker.location.county(),
            idCiudad: ciudad.idCiudad,
          },
        });

        for (let col = 0; col < NUM_COLEGIOS_PER_COMUNA; col++) {
          const colegio = await prisma.colegio.create({
            data: {
              idColegio: colegioId++,
              nomColegio: `Colegio ${faker.company.name()}`,
              direcColegio: faker.location.streetAddress(),
              colegioNormal: faker.datatype.boolean({ probability: 0.8 }),
              idComuna: comuna.idComuna,
            },
          });
          colegios.push(colegio);
        }
      }
    }
  }

  console.log(
    `Seeded geography: 1 pais, ${regionId - 1} regiones, ${ciudadId - 1} ciudades, ${comunaId - 1} comunas, ${colegios.length} colegios`,
  );
  return colegios;
}

// ---- Usuarios (handles the required self-referencing creadoPor field) ----

async function seedUsuarios(roles: { idRol: number }[], colegios: { idColegio: number }[]) {
  const claveHash = await bcrypt.hash('Password123!', 10);

  // Bootstrap admin: creadoPor must reference an existing usuario, but this
  // IS the first usuario. We create it with FK checks briefly disabled so
  // it can reference its own (about-to-exist) id, inside a transaction to
  // guarantee both statements share the same DB connection/session.
  const admin = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
    const created = await tx.usuario.create({
      data: {
        idRol: 1, // admin
        idColegio: randomItem(colegios).idColegio,
        //rutUsuario: '11111111-1',
        rutUsuario: '123456789',
        claveHash,
        primerNombre: 'Admin',
        segundoNombre: 'Sistema',
        aPaterno: 'Contuvoz',
        aMaterno: 'Demo',
        telefonoUsuario: generarTelefono(),
        correo: 'admin@contuvoz.dev',
        activo: true,
        creadoPor: 1, // self-reference: relies on TRUNCATE having reset autoincrement to 1
      },
    });
    await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
    return created;
  });

  const usuarios = [admin];

  for (let i = 0; i < NUM_USUARIOS; i++) {
    const activo = faker.datatype.boolean({ probability: 0.9 });
    usuarios.push(
      await prisma.usuario.create({
        data: {
          idRol: randomItem(roles.filter((r) => r.idRol !== 1)).idRol, // docente/estudiante
          idColegio: randomItem(colegios).idColegio,
          rutUsuario: generarRut(),
          claveHash,
          primerNombre: faker.person.firstName(),
          segundoNombre: faker.person.firstName(),
          aPaterno: faker.person.lastName(),
          aMaterno: faker.person.lastName(),
          telefonoUsuario: generarTelefono(),
          correo: faker.internet.email().toLowerCase(),
          urlAvatar: faker.image.avatar(),
          activo,
          creadoPor: admin.idUsuario,
          deshabilitadoPor: activo ? null : admin.idUsuario,
        },
      }),
    );
  }

  console.log(`Seeded ${usuarios.length} usuarios (shared password: Password123!)`);
  return usuarios;
}

// ---- Archivo biblioteca (this is very likely the "upload PDF" table) ----

async function seedArchivos(usuarios: { idUsuario: number }[]) {
  const tiposArchivo = ['pdf', 'docx', 'video', 'imagen'];
  let count = 0;

  for (let i = 0; i < NUM_ARCHIVOS; i++) {
    const tipoArchivo = randomItem(tiposArchivo);
    const ext = tipoArchivo === 'imagen' ? 'png' : tipoArchivo;

    await prisma.archivoBiblioteca.create({
      data: {
        tituloArchivo: faker.lorem.words({ min: 2, max: 5 }),
        descripcionArchivo: faker.lorem.sentence(),
        rutaArchivoUrl: `/uploads/biblioteca/${faker.string.uuid()}.${ext}`,
        tipoArchivo,
        idUsuario: randomItem(usuarios).idUsuario,
        imagenUrl: faker.image.urlPicsumPhotos(),
        imagenDescripcionUrl: faker.image.urlPicsumPhotos(),
      },
    });
    count++;
  }

  console.log(`Seeded ${count} archivo_biblioteca rows`);
}

// ---- Sesiones + tokens ----

async function seedSesiones(usuarios: { idUsuario: number; rutUsuario: string }[]) {
  let sesionCount = 0;
  let tokenCount = 0;

  for (const usuario of usuarios) {
    const numSesiones = faker.number.int({ min: 1, max: 4 });

    for (let i = 0; i < numSesiones; i++) {
      const exitosa = faker.datatype.boolean({ probability: 0.85 });
      const fechaInicio = faker.date.recent({ days: 30 });

      const sesion = await prisma.sesion.create({
        data: {
          idUsuario: exitosa ? usuario.idUsuario : null,
          rutIntentado: usuario.rutUsuario,
          exitosa,
          fechaInicio,
          fechaFin: exitosa ? faker.date.soon({ days: 1, refDate: fechaInicio }) : null,
          ipOrigen: faker.internet.ip(),
          userAgent: faker.internet.userAgent(),
          motivoFin: exitosa ? randomItem(['logout', 'token_expirado', null]) : 'credenciales_invalidas',
        },
      });
      sesionCount++;

      if (exitosa) {
        await prisma.sesionToken.create({
          data: {
            idUsuario: usuario.idUsuario,
            idSesion: sesion.idSesion,
            refreshTokenHash: faker.string.alphanumeric(64),
            fechaExpiracion: faker.date.soon({ days: 7 }),
            revocado: faker.datatype.boolean({ probability: 0.3 }),
            ipOrigen: sesion.ipOrigen,
            userAgent: sesion.userAgent,
          },
        });
        tokenCount++;
      }
    }
  }

  // A few pure failed-login attempts with no matching usuario at all
  for (let i = 0; i < 5; i++) {
    await prisma.sesion.create({
      data: {
        idUsuario: null,
        rutIntentado: generarRut(),
        exitosa: false,
        ipOrigen: faker.internet.ip(),
        userAgent: faker.internet.userAgent(),
        motivoFin: 'rut_no_encontrado',
      },
    });
    sesionCount++;
  }

  console.log(`Seeded ${sesionCount} sesiones and ${tokenCount} sesion_tokens`);
}

// ---- Actividades + one matching resultado per actividad ----

async function seedActividadesYResultados(
  usuarios: { idUsuario: number }[],
  tipos: { idTipoActividad: number }[],
) {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const vocales = ['A', 'E', 'I', 'O', 'U'];

  let actividadCount = 0;
  let pintadoCount = 0;
  let signCount = 0;
  let vocalCount = 0;

  for (const usuario of usuarios) {
    for (let i = 0; i < NUM_ACTIVIDADES_PER_USUARIO; i++) {
      const tipo = randomItem(tipos);

      const actividad = await prisma.actividad.create({
        data: {
          idUsuario: usuario.idUsuario,
          idTipoActividad: tipo.idTipoActividad,
          fechaActividad: faker.date.recent({ days: 60 }),
        },
      });
      actividadCount++;

      if (tipo.idTipoActividad === TIPO_PINTADO) {
        await prisma.resultadoPintado.create({
          data: {
            idActividad: actividad.idActividad,
            letraEsperada: randomItem(letras),
            trazoInterno: faker.number.float({ min: 40, max: 100, fractionDigits: 1 }),
            trazoExterno: faker.number.float({ min: 40, max: 100, fractionDigits: 1 }),
            areaCompletada: faker.number.float({ min: 40, max: 100, fractionDigits: 1 }),
            puntajeFinal: faker.number.float({ min: 0, max: 100, fractionDigits: 1 }),
            aprobadoPintado: faker.datatype.boolean({ probability: 0.7 }),
            duracionPintado: faker.number.int({ min: 5, max: 120 }),
          },
        });
        pintadoCount++;
      } else if (tipo.idTipoActividad === TIPO_SIGN) {
        const letraEsperada = randomItem(letras);
        await prisma.resultadoSign.create({
          data: {
            idActividad: actividad.idActividad,
            letraEsperada,
            letraDetectada: faker.datatype.boolean({ probability: 0.7 }) ? letraEsperada : randomItem(letras),
            porcConfianza: faker.number.float({ min: 0.5, max: 1, fractionDigits: 2 }),
            aprobadoSign: faker.datatype.boolean({ probability: 0.7 }),
          },
        });
        signCount++;
      } else {
        const vocalEsperada = randomItem(vocales);
        await prisma.resultadoPronunciacion.create({
          data: {
            idActividad: actividad.idActividad,
            textoEsperado: vocalEsperada,
            textoDetectado: faker.datatype.boolean({ probability: 0.7 }) ? vocalEsperada : randomItem(vocales),
            porcConfianza: faker.number.float({ min: 0.5, max: 1, fractionDigits: 2 }),
            aprobadoPronun: faker.datatype.boolean({ probability: 0.7 }),
          },
        });
        vocalCount++;
      }
    }
  }

  console.log(
    `Seeded ${actividadCount} actividades → ${pintadoCount} pintado, ${signCount} sign, ${vocalCount} pronunciacion results`,
  );
}

// ---- Main ----

async function main() {
  await clearDatabase();

  const roles = await seedRoles();
  const tipos = await seedTiposActividad();
  const colegios = await seedGeografia();
  const usuarios = await seedUsuarios(roles, colegios);

  await seedArchivos(usuarios);
  await seedSesiones(usuarios);
  await seedActividadesYResultados(usuarios, tipos);

  console.log('\nSeed complete.');
  console.log('Test login → RUT 123456789 / Password123! (admin)');
  //console.log('Test login → RUT 11111111-1 / Password123! (admin)');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
