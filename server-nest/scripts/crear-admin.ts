/**
 * Crea un usuario Administrador desde la terminal.
 *
 *   npm run crear-admin
 *
 * Pensado para dejar lista una base recién cargada con los scripts de
 * `script DB + insert/`, que no traen usuarios. La contraseña se pide por
 * consola y solo se guarda su hash: no queda escrita en ningún archivo.
 *
 * Reglas iguales a las de UsuariosService.crear: RUT válido y normalizado,
 * contraseña de 8+ caracteres, RUT y correo únicos, bcrypt con 10 rondas.
 */
import * as readline from 'node:readline';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { esRutValido, limpiarRut } from '../src/common/validators/rut.validator';

const ID_ROL_ADMINISTRADOR = 1;

const prisma = new PrismaClient();
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// Al pedir la contraseña se silencia el eco de lo que se escribe.
let ocultarEntrada = false;
const writeOriginal = (rl as any)._writeToOutput.bind(rl);
(rl as any)._writeToOutput = (texto: string) => {
  if (!ocultarEntrada || texto.includes('\n') || texto.includes('\r')) writeOriginal(texto);
};

// Cola de líneas en vez de rl.question: si la entrada llega toda junta (pegada
// o redirigida desde un archivo), rl.question pierde las líneas que sobran.
const lineas: string[] = [];
const esperando: ((linea: string | null) => void)[] = [];
let entradaCerrada = false;
rl.on('line', (linea) => {
  const siguiente = esperando.shift();
  if (siguiente) siguiente(linea);
  else lineas.push(linea);
});
rl.on('close', () => {
  entradaCerrada = true;
  for (const resolver of esperando.splice(0)) resolver(null);
});

async function preguntar(texto: string): Promise<string> {
  process.stdout.write(texto);
  const linea = lineas.length
    ? lineas.shift()!
    : entradaCerrada
      ? null
      : await new Promise<string | null>((resolve) => esperando.push(resolve));
  if (linea === null) throw new Error('Se cerró la entrada antes de terminar');
  if (!process.stdin.isTTY) process.stdout.write('\n');
  return linea.trim();
}

async function preguntarOculto(texto: string): Promise<string> {
  if (!process.stdin.isTTY) {
    console.log('(Esta terminal no permite ocultar lo que escribes.)');
    return preguntar(texto);
  }
  ocultarEntrada = true;
  try {
    return await preguntar(texto);
  } finally {
    ocultarEntrada = false;
  }
}

async function preguntarHasta(
  texto: string,
  validar: (valor: string) => string | null,
  oculto = false,
): Promise<string> {
  for (;;) {
    const valor = oculto ? await preguntarOculto(texto) : await preguntar(texto);
    const error = validar(valor);
    if (!error) return valor;
    console.log(`  ✗ ${error}`);
  }
}

const obligatorio = (max: number) => (v: string) =>
  !v ? 'Este campo es obligatorio' : v.length > max ? `Máximo ${max} caracteres` : null;

const opcional = (max: number) => (v: string) =>
  v.length > max ? `Máximo ${max} caracteres` : null;

async function main() {
  console.log('\nCrear usuario Administrador de ConTuVoz\n');

  const colegios = await prisma.colegio.findMany({
    where: { activo: true },
    select: { idColegio: true, nomColegio: true },
    orderBy: { idColegio: 'asc' },
  });
  if (colegios.length === 0) {
    throw new Error(
      'No hay colegios activos. Carga primero script DB + insert/02_datos_base.sql',
    );
  }

  const rut = limpiarRut(
    await preguntarHasta('RUT (ej. 11.111.111-1): ', (v) =>
      esRutValido(v) ? null : 'El RUT ingresado no es válido',
    ),
  );
  const primerNombre = await preguntarHasta('Primer nombre: ', obligatorio(100));
  const segundoNombre = await preguntarHasta('Segundo nombre (opcional): ', opcional(100));
  const aPaterno = await preguntarHasta('Apellido paterno: ', obligatorio(100));
  const aMaterno = await preguntarHasta('Apellido materno (opcional): ', opcional(100));
  const correo = await preguntarHasta('Correo: ', (v) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Correo no válido',
  );
  const telefono = await preguntarHasta('Teléfono: ', obligatorio(20));

  let idColegio = colegios[0].idColegio;
  if (colegios.length > 1) {
    console.log('\nColegios:');
    for (const c of colegios) console.log(`  ${c.idColegio}. ${c.nomColegio}`);
    const elegido = await preguntarHasta('Id del colegio: ', (v) =>
      colegios.some((c) => c.idColegio === Number(v)) ? null : 'Elige un id de la lista',
    );
    idColegio = Number(elegido);
  }

  const password = await preguntarHasta(
    'Contraseña (mínimo 8 caracteres): ',
    (v) => (v.length >= 8 ? null : 'Debe tener al menos 8 caracteres'),
    true,
  );
  await preguntarHasta(
    'Repite la contraseña: ',
    (v) => (v === password ? null : 'Las contraseñas no coinciden'),
    true,
  );

  const existente = await prisma.usuario.findFirst({
    where: { OR: [{ rutUsuario: rut }, { correo }] },
    select: { rutUsuario: true },
  });
  if (existente) {
    throw new Error(
      existente.rutUsuario === rut
        ? 'Ya existe un usuario con ese RUT'
        : 'Ya existe un usuario con ese correo',
    );
  }

  const claveHash = await bcrypt.hash(password, 10);

  // creado_por es obligatorio. Si ya hay un administrador, figura como creador;
  // si la base está vacía, el primer usuario se registra como creado por sí mismo
  // (InnoDB acepta la autorreferencia en el mismo INSERT).
  const creador = await prisma.usuario.findFirst({
    where: { idRol: ID_ROL_ADMINISTRADOR, activo: true },
    select: { idUsuario: true },
    orderBy: { idUsuario: 'asc' },
  });
  const maxId = await prisma.usuario.aggregate({ _max: { idUsuario: true } });
  const idNuevo = (maxId._max.idUsuario ?? 0) + 1;

  const usuario = await prisma.usuario.create({
    data: {
      idUsuario: idNuevo,
      idRol: ID_ROL_ADMINISTRADOR,
      idColegio,
      rutUsuario: rut,
      claveHash,
      primerNombre,
      segundoNombre,
      aPaterno,
      aMaterno,
      telefonoUsuario: telefono,
      correo,
      creadoPor: creador?.idUsuario ?? idNuevo,
    },
    select: { idUsuario: true, primerNombre: true, aPaterno: true },
  });

  console.log(
    `\n✓ Administrador creado: ${usuario.primerNombre} ${usuario.aPaterno} (id ${usuario.idUsuario}).`,
  );
  console.log('  Ya puedes iniciar sesión con ese RUT y contraseña.\n');
}

main()
  .catch((e: Error) => {
    console.error(`\n✗ ${e.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
