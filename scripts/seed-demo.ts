/**
 * Fills a LOCAL database with demo content for every admin module, the landing and the forum, so a local
 * preview looks like a real site. It needs no Cloudinary credentials: the photos and logos the database
 * requires on published rows point at Cloudinary's public `demo` account. Everything is written in one
 * transaction, so a failure leaves the database as it was. It refuses any database that is not on
 * this machine, and refuses a database that already has content unless `--replace` (which first deletes the
 * content and forum rows; admin users, sessions and the audit log are kept).
 *
 *   npm run seed:demo [-- --replace]
 *
 * Exit codes: 0 done, 1 the write failed, 2 wrong target, existing content or wrong usage.
 */
import { randomUUID } from "node:crypto";

import { PrismaClient, type Prisma } from "@prisma/client";

import { SITE_SETTINGS_ID } from "@/domain/site-settings";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const DAY = 24 * 60 * 60 * 1000;

function fail(message: string, code: number): never {
  console.error(message);
  process.exit(code);
}

function localDatabase(): string {
  const url = process.env.DATABASE_URL;
  if (!url) fail("DATABASE_URL is not set. Nothing was written.", 2);
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    fail("DATABASE_URL is not a valid URL. Nothing was written.", 2);
  }
  if (!LOCAL_HOSTS.has(host)) fail(`Refusing to seed demo data into a non-local database (${host}). Nothing was written.`, 2);
  return `${host}${new URL(url).pathname}`;
}

const now = new Date();
const daysFromNow = (days: number) => new Date(now.getTime() + days * DAY);
const dateOnly = (iso: string) => new Date(`${iso}T00:00:00Z`);
/** A public image from Cloudinary's `demo` account, in the column shape of a stored image (`prefix` = photo, logo...). */
function demoImage<P extends string>(prefix: P, publicId: string, alt: string) {
  return {
    [`${prefix}Url`]: `https://res.cloudinary.com/demo/image/upload/${publicId}`,
    [`${prefix}PublicId`]: `demo/${publicId.replace(/\.\w+$/, "")}`,
    [`${prefix}Width`]: 800,
    [`${prefix}Height`]: 800,
    [`${prefix}Alt`]: alt,
  } as Record<`${P}${"Url" | "PublicId" | "Alt"}`, string> & Record<`${P}${"Width" | "Height"}`, number>;
}

const PEOPLE = [
  "samples/people/smiling-man.jpg",
  "samples/woman-on-a-football-field.jpg",
  "samples/man-portrait.jpg",
  "samples/look-up.jpg",
  "samples/people/boy-snow-hoodie.jpg",
  "samples/people/kitchen-bar.jpg",
  "samples/people/jazz.jpg",
];

const ordered = <T extends object>(rows: T[]) =>
  rows.map((row, index) => ({ id: randomUUID(), sortOrder: index, isPublished: true, updatedAt: now, ...row }));

const EVENTS: Omit<Prisma.EventCreateManyInput, "id" | "updatedAt">[] = [
  {
    slug: "bienvenida-primer-ciclo",
    title: "Bienvenida a primer ciclo",
    description: "Recibimos a los estudiantes de primer ciclo para que se sientan escuchados y apoyados desde el primer día.",
    date: dateOnly("2026-04-14"),
    type: "comunidad",
    commitMessage: "feat(bienvenida): aquí nadie empieza solo",
    para: "primer ciclo",
  },
  {
    slug: "semana-del-estudiante-2026",
    title: "Semana del Estudiante 2026",
    description: "Esto es lo que vivimos durante la semana:",
    date: dateOnly("2026-02-01"),
    datePrecision: "month",
    type: "evento",
    commitMessage: "merge(semana-del-estudiante): FLISOL, ponencias, talleres y casas abiertas",
    highlights: ["FLISOL", "Ponencias sobre tendencias tecnológicas", "Talleres: impuestos y cómo potenciar tu CV", "Casas abiertas"],
  },
  {
    slug: "taller-git-desde-cero",
    title: "Taller: Git desde cero",
    description: "Commits, ramas y pull requests con ejercicios guiados. Trae tu laptop con Git instalado.",
    date: dateOnly("2026-09-18"),
    type: "taller",
    commitMessage: "feat(taller-git): primer commit para todos",
    hora: "15:00",
    lugar: "Laboratorio 3, Bloque de Computación",
    para: "todos los ciclos",
  },
  {
    slug: "hackathon-unl-2026",
    title: "Hackathon UNL 2026",
    description: "24 horas para construir una solución a un problema real de la universidad. Equipos de 3 a 5 personas.",
    date: daysFromNow(19),
    type: "evento",
    commitMessage: "feat(hackathon): 24 horas, un problema real",
    hora: "08:00",
    lugar: "Auditorio de la Facultad",
    para: "estudiantes UNL",
    featured: true,
    highlights: ["Mentores de la industria", "Premios para los tres primeros lugares", "Comida incluida"],
    registrationMode: "unl",
    registrationCapacity: 60,
    registrationDeadline: daysFromNow(15),
  },
  {
    slug: "charla-ia-en-la-industria",
    title: "Charla: IA en la industria local",
    description: "Egresados que trabajan con IA cuentan qué hacen en el día a día y qué buscan al contratar.",
    date: daysFromNow(9),
    type: "charla",
    commitMessage: "docs(ia): lo que nadie te cuenta del primer trabajo",
    hora: "17:30",
    lugar: "Sala de conferencias, Bloque de Computación",
    para: "público general",
    registrationMode: "open",
    registrationCapacity: 120,
  },
  {
    slug: "noche-de-juegos",
    title: "Noche de juegos de mesa",
    description: "Una pausa antes de exámenes: juegos de mesa, pizza y buena compañía.",
    date: daysFromNow(33),
    type: "comunidad",
    commitMessage: "chore(comunidad): pausa antes de exámenes",
    hora: "18:00",
    lugar: "Sala de estudiantes",
    para: "todos los ciclos",
  },
];

const NEWS: Omit<Prisma.NewsItemCreateManyInput, "id" | "updatedAt">[] = [
  {
    slug: "abren-inscripciones-hackathon",
    title: "Abren las inscripciones para el Hackathon UNL 2026",
    summary: "Hay 60 cupos para estudiantes de la UNL. Inscríbete con tu correo institucional.",
    body: "Este año el hackathon dura **24 horas** y los equipos trabajan sobre problemas reales de la universidad.\n\n- Equipos de 3 a 5 personas\n- Mentores de la industria\n- Premios para los tres primeros lugares",
    publishedAt: dateOnly(daysFromNow(-2).toISOString().slice(0, 10)),
  },
  {
    slug: "resultados-elecciones-directiva",
    title: "Nueva directiva para el periodo 2026",
    summary: "Conoce a quienes representan a la carrera este año.",
    body: "Gracias a todas las personas que votaron. La nueva directiva ya está trabajando en el plan anual.",
    publishedAt: dateOnly("2026-05-10"),
  },
  {
    slug: "laboratorio-abierto-fines-de-semana",
    title: "El laboratorio abre los sábados",
    summary: "Desde noviembre el laboratorio 3 abre los sábados de 9:00 a 13:00 para proyectos y estudio.",
    body: "Después de varias solicitudes, logramos que el laboratorio abra los sábados por la mañana.",
    publishedAt: dateOnly(daysFromNow(-12).toISOString().slice(0, 10)),
  },
];

type Db = Prisma.TransactionClient;

async function seed(prisma: Db) {
  await prisma.siteSettings.create({
    data: {
      id: SITE_SETTINGS_ID,
      tagline: "La asociación de estudiantes de Computación de la UNL",
      description: "Eventos, talleres y comunidad para quienes estudian Computación en la Universidad Nacional de Loja.",
      about: "Somos la asociación de estudiantes de Computación. Organizamos talleres, charlas y eventos, y representamos a la carrera ante la facultad.",
      updatedAt: now,
    },
  });

  await prisma.event.createMany({ data: EVENTS.map((event) => ({ id: randomUUID(), isPublished: true, updatedAt: now, ...event })) });
  await prisma.newsItem.createMany({ data: NEWS.map((item) => ({ id: randomUUID(), isPublished: true, updatedAt: now, ...item })) });

  await prisma.faq.createMany({
    data: ordered([
      { question: "¿Quién puede participar en los eventos?", answer: "Cualquier estudiante de la carrera. Algunos eventos también están abiertos al público.", command: "aso events --open" },
      { question: "¿Cómo me inscribo a un evento?", answer: "Desde la tarjeta del evento en esta página, con el botón de inscripción." },
      { question: "¿Cómo puedo proponer un taller?", answer: "Escríbenos por Instagram o en el foro, en la categoría Propuestas." },
      { question: "¿La asociación cobra alguna cuota?", answer: "No. Todas las actividades son gratuitas para los estudiantes." },
    ]),
  });

  await prisma.terminalCommand.createMany({
    data: ordered([
      { command: "aso --about", description: "Quiénes somos", output: "Asociación de estudiantes de Computación · UNL" },
      { command: "aso events --next", description: "Próximo evento", output: "Charla: IA en la industria local" },
      { command: "aso join", description: "Cómo participar", output: "Inscríbete en cualquier evento o escríbenos en el foro." },
    ]),
  });

  await prisma.pillar.createMany({
    data: ordered([
      { word: "Comunidad", title: "Nadie empieza solo", text: "Acompañamos a cada ciclo, desde la bienvenida hasta la graduación." },
      { word: "Aprendizaje", title: "Más allá del aula", text: "Talleres y charlas sobre lo que la industria usa hoy." },
      { word: "Representación", title: "Tu voz en la facultad", text: "Llevamos las propuestas de los estudiantes a las autoridades." },
    ]),
  });

  await prisma.socialLink.createMany({
    data: ordered([
      { platform: "instagram", label: "Instagram", handle: "@aso_computacion", url: "https://www.instagram.com/aso_computacion/", note: "Anunciamos primero aquí", blurb: "Eventos, fotos y anuncios, primero aquí." },
      { platform: "tiktok", label: "TikTok", handle: "@aso_computacion_unl", url: "https://www.tiktok.com/@aso_computacion_unl" },
      { platform: "linkedin", label: "LinkedIn", handle: "ASO Computación", url: "https://www.linkedin.com/company/aso-computacion-unl/" },
      { platform: "twitch", label: "Twitch", handle: "ASO_Computacion", url: "https://www.twitch.tv/aso_computacion" },
    ]),
  });

  await prisma.boardMember.createMany({
    data: ordered(
      [
        { name: "Emilio Jaramillo", role: "Presidente" },
        { name: "Viviana Córdova", role: "Vicepresidenta" },
        { name: "Miguel Armas", role: "Secretario" },
        { name: "Kiara Condoy", role: "Tesorera" },
        { name: "Marco Chiliguano", role: "Alterno de Vicepresidente" },
        { name: "Alejandro Padilla", role: "Alterno de Tesorero" },
        { name: "Melissa Contento", role: "Alterna de Secretaria" },
      ].map((member, index) => ({ ...member, ...demoImage("photo", PEOPLE[index], `Foto de demostración de ${member.name}`) })),
    ),
  });

  await prisma.impactStat.createMany({
    data: ordered([
      { value: "24", label: "eventos este año" },
      { value: "850+", label: "estudiantes alcanzados" },
      { value: "12", label: "talleres prácticos" },
      { value: "5", label: "aliados" },
    ]),
  });

  await prisma.testimonial.createMany({
    data: ordered([
      { quote: "El taller de Git me salvó el proyecto integrador. Ahora todo mi equipo trabaja con ramas.", name: "Daniela Ríos", role: "Estudiante de 5.º ciclo", ...demoImage("photo", "samples/people/bicycle.jpg", "Foto de demostración de Daniela Ríos") },
      { quote: "En la bienvenida conocí a mis primeros amigos de la carrera.", name: "Kevin Torres", role: "Estudiante de 1.er ciclo" },
      { quote: "La charla con egresados me ayudó a decidir en qué especializarme.", name: "Andrea Maldonado", role: "Estudiante de 8.º ciclo" },
    ]),
  });

  await prisma.sponsor.createMany({
    data: ordered([
      { name: "Facultad de Energía", url: "https://unl.edu.ec/", ...demoImage("logo", "samples/logo.png", "Logo de demostración") },
      { name: "Club de Software Libre Loja", ...demoImage("logo", "cloudinary_icon_blue.png", "Logo de demostración") },
    ]),
  });

  await seedForum(prisma);
}

async function seedForum(prisma: Db) {
  const categories = ordered([
    { slug: "general", name: "General", description: "Preguntas y conversaciones de la carrera." },
    { slug: "materias", name: "Materias", description: "Dudas sobre clases, tareas y exámenes." },
    { slug: "propuestas", name: "Propuestas", description: "Ideas de talleres y eventos para la asociación." },
  ]).map(({ isPublished: _published, ...category }) => category);
  await prisma.forumCategory.createMany({ data: categories });
  const [general, materias, propuestas] = categories;

  const members = ["Daniela Ríos", "Kevin Torres", "Andrea Maldonado", "Luis Ochoa"].map((displayName, index) => ({
    id: randomUUID(),
    email: `demo${index + 1}@unl.edu.ec`,
    googleSub: `demo-google-sub-${index + 1}`,
    displayName,
    lastLoginAt: daysFromNow(-index),
  }));
  await prisma.forumMember.createMany({ data: members });
  const [daniela, kevin, andrea, luis] = members;

  const thread = (categoryId: string, authorId: string, title: string, body: string, daysAgo: number) => ({
    id: randomUUID(),
    categoryId,
    authorId,
    title,
    body,
    createdAt: daysFromNow(-daysAgo),
    updatedAt: daysFromNow(-daysAgo),
    lastActivityAt: daysFromNow(-daysAgo),
  });
  const threads = [
    thread(materias.id, kevin.id, "¿Cómo preparo el examen de Estructuras de Datos?", "Me cuesta entender los árboles AVL. ¿Algún recurso que les haya servido?", 6),
    thread(propuestas.id, andrea.id, "Taller de Docker para principiantes", "Propongo un taller de Docker: muchos lo usamos en prácticas y nadie nos lo enseñó.", 4),
    thread(general.id, luis.id, "¿Alguien para el equipo del hackathon?", "Busco 2 personas para el hackathon. Sé backend con Node; nos falta frontend y diseño.", 2),
    thread(general.id, daniela.id, "Recomendaciones de laptop para la carrera", "Entro a 6.º ciclo y necesito cambiar de laptop. ¿Qué me recomiendan con un presupuesto medio?", 1),
  ];
  await prisma.forumThread.createMany({ data: threads });
  const [avl, docker, hackathon] = threads;

  const reply = (threadId: string, authorId: string, body: string, hoursAfter: number, base: Date) => ({
    id: randomUUID(),
    threadId,
    authorId,
    body,
    createdAt: new Date(base.getTime() + hoursAfter * 60 * 60 * 1000),
    updatedAt: new Date(base.getTime() + hoursAfter * 60 * 60 * 1000),
  });
  const replies = [
    reply(avl.id, daniela.id, "A mí me sirvió visualgo.net: ves cada rotación paso a paso.", 3, avl.createdAt),
    reply(avl.id, andrea.id, "Haz los ejercicios del libro a mano antes de programarlos. Las rotaciones se entienden dibujando.", 8, avl.createdAt),
    reply(docker.id, luis.id, "¡Me apunto! Podría ayudar con la parte de docker compose.", 5, docker.createdAt),
    reply(hackathon.id, kevin.id, "Yo hago frontend con React. Te escribo por el foro.", 2, hackathon.createdAt),
  ];
  await prisma.forumReply.createMany({ data: replies });

  for (const [threadId, replyList] of [
    [avl.id, replies.slice(0, 2)],
    [docker.id, replies.slice(2, 3)],
    [hackathon.id, replies.slice(3, 4)],
  ] as const) {
    await prisma.forumThread.update({ where: { id: threadId }, data: { lastActivityAt: replyList[replyList.length - 1].createdAt } });
  }
  await prisma.forumThread.update({ where: { id: avl.id }, data: { bestReplyId: replies[0].id } });

  await prisma.forumReaction.createMany({
    data: [
      { id: randomUUID(), memberId: kevin.id, replyId: replies[0].id },
      { id: randomUUID(), memberId: luis.id, replyId: replies[0].id },
      { id: randomUUID(), memberId: daniela.id, threadId: docker.id },
      { id: randomUUID(), memberId: kevin.id, threadId: docker.id },
    ],
  });

  await prisma.forumReport.create({
    data: { id: randomUUID(), reporterId: daniela.id, threadId: hackathon.id, reason: "Demo: reporte de prueba para la cola de moderación." },
  });
}

async function hasContent(prisma: PrismaClient): Promise<boolean> {
  const counts = await Promise.all([
    prisma.event.count(),
    prisma.newsItem.count(),
    prisma.faq.count(),
    prisma.boardMember.count(),
    prisma.forumCategory.count(),
    prisma.siteSettings.count(),
  ]);
  return counts.some((count) => count > 0);
}

async function clearContent(prisma: Db) {
  for (const step of [
    prisma.forumReport.deleteMany(),
    prisma.forumReaction.deleteMany(),
    prisma.forumThread.updateMany({ data: { bestReplyId: null } }),
    prisma.forumReply.deleteMany(),
    prisma.forumThread.deleteMany(),
    prisma.forumCategory.deleteMany(),
    prisma.forumSession.deleteMany(),
    prisma.forumMember.deleteMany(),
    prisma.eventRegistration.deleteMany(),
    prisma.eventPhoto.deleteMany(),
    prisma.event.deleteMany(),
    prisma.newsItem.deleteMany(),
    prisma.faq.deleteMany(),
    prisma.terminalCommand.deleteMany(),
    prisma.pillar.deleteMany(),
    prisma.socialLink.deleteMany(),
    prisma.boardMember.deleteMany(),
    prisma.impactStat.deleteMany(),
    prisma.testimonial.deleteMany(),
    prisma.sponsor.deleteMany(),
    prisma.siteSettings.deleteMany(),
  ]) {
    await step;
  }
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const unknown = args.filter((arg) => arg !== "--replace");
  if (unknown.length > 0) fail(`Unknown argument: ${unknown.join(" ")}. Usage: npm run seed:demo [-- --replace]`, 2);
  const replace = args.includes("--replace");
  const target = localDatabase();

  const prisma = new PrismaClient();
  try {
    const existing = await hasContent(prisma);
    if (existing && !replace) {
      fail(`The database ${target} already has content. Run with --replace to delete it and seed the demo. Nothing was written.`, 2);
    }
    await prisma.$transaction(
      async (tx) => {
        if (existing) await clearContent(tx);
        await seed(tx);
      },
      { timeout: 60_000 },
    );
    console.log(`Demo content seeded into ${target}.`);
  } catch (error) {
    console.error(`Seeding failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

await main();
