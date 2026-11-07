# Cómo colaborar

Gracias por ayudar con el panel de administración de ASO Computación. Esta guía es para la directiva y para cualquier estudiante que quiera aportar.

## ¿Desea cambiar contenido o código?

| Quiero… | Dónde se hace | ¿Necesito Git? |
|---|---|---|
| Publicar un evento, subir fotos, editar la FAQ, la directiva, los pilares o las redes, moderar el foro | En el **panel** ya desplegado, con su cuenta de Google y el rol que le asignó un administrador (editor o administrador) | No |
| Cambiar cómo funciona el panel (pantallas, reglas, API pública) | En **este repositorio**, con un Pull Request | Sí |
| Cambiar el sitio público (diseño, textos fijos) | En el repositorio **`aso-computacion-landing`** | Sí |
| Reportar un error o proponer una idea | Abriendo un **issue** en este repositorio | No |

Si no sabe por dónde empezar, abra un issue y lo revisamos juntos.

## Preparar el entorno local

Se hace una sola vez. Necesita **Node 22** (la versión exacta está en `.nvmrc`; con `nvm use` basta), **Docker** y Git.

1. **Una base de Postgres propia para desarrollar.** Nunca use la de producción. Con Docker:
   ```sh
   npm run db:dev
   ```
   Levanta Postgres en segundo plano y espera a que esté listo; los datos se conservan entre ejecuciones. Para apagarlo use `npm run db:dev:stop`.
   Su `DATABASE_URL` queda así: `postgresql://postgres:postgres@localhost:55432/aso_admin_dev`. La base que usan los tests (`docker-compose.test.yml`) es otra: la levantan y la borran los propios comandos de test, no la use para desarrollar.
2. **Variables de entorno.** Copie `.env.example` a `.env` y complete los valores `__REPLACE_*__` según la [referencia técnica](docs/REFERENCIA.md#environment-variables). Para entrar sin configurar Google, alcanza con `ADMIN_PASSWORD` (al menos 16 caracteres) y `ADMIN_SECRET` (al menos 32; puede generarlo con `openssl rand -base64 32`). El archivo `.env` nunca se sube a Git.
3. **Instalar y preparar la base:**
   ```sh
   npm ci                      # también genera el cliente de Prisma
   npx prisma migrate deploy   # crea las tablas
   npm run seed:demo           # opcional: contenido de ejemplo
   ```
   `seed:demo` se niega a correr contra una base que no sea local, así que no puede dañar producción por error.
4. **Arrancar:** `npm run dev` y abra <http://localhost:3000>. Entre con la contraseña de `ADMIN_PASSWORD`.
5. **Para los tests de punta a punta**, instale el navegador una vez: `npm run e2e:browsers`.

Si algo falla en estos pasos, abra un issue: es un error de la guía, no suyo.

## Flujo de trabajo y colaboración

El orden es siempre el mismo, sea cual sea su rol:

1. **Issue primero.** Para algo más grande que una errata, abra o elija un issue y comente que lo tomará.
2. **Rama nueva desde `main` actualizado:**
   ```sh
   git switch main && git pull
   git switch -c tipo/descripcion-corta   # ej.: fix/subida-fotos, feat/filtro-eventos
   ```
3. **Commits pequeños** con [Conventional Commits](https://www.conventionalcommits.org/es/): `feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`. El mensaje describe el cambio en inglés, en imperativo: `fix: keep the photo order after a failed upload`.
4. **Entorno local** listo, como se explica en [Preparar el entorno local](#preparar-el-entorno-local).
5. **Compruebe localmente** antes de pedir revisión; la CI corre lo mismo en el PR:
   ```sh
   npm ci
   npm run lint
   npm run typecheck
   npm run test:coverage      # tests unitarios + umbral de cobertura
   npm run test:integration   # levanta su propio Postgres con Docker
   npm run build
   ```
   Los flujos críticos de punta a punta (login, publicar un evento y verlo en la API pública, foro, inscripciones) viven en `e2e/`: `npm run e2e:browsers` una vez y luego `npm run e2e` (también usa Docker; la CI lo corre como el job `e2e`). Para correr un solo archivo: `npm run e2e -- e2e/forum.spec.ts`.
   Si cambió algo visual, revíselo con `npm run dev` en celular (390 px) y escritorio.
6. **Abra el PR** contra `main`, complete la plantilla y enlace el issue (`Closes #12`).
7. **Revisión.** Responda los comentarios con commits nuevos en la misma rama; no reescriba la historia de una rama que ya está en revisión.
8. **Merge.** Quien aprueba (o quien abrió el PR, una vez aprobado) hace el merge y borra la rama.

### Reglas de la rama `main`

`main` es lo que está desplegado. Está protegida:

- Nadie empuja directo a `main`: todo cambio entra por un Pull Request.
- Cada PR necesita **1 aprobación** de otra persona. GitHub le pide la revisión al mantenedor de forma automática (`.github/CODEOWNERS`).
- No se permite `force push` ni borrar `main`.
- La CI (GitHub Actions) tiene que pasar en verde para mergear. Corre tres jobs en cada PR: `checks` (auditoría de dependencias de producción con `npm audit`, que falla con avisos altos o críticos; lint; typecheck; tests unitarios con umbral de cobertura; build), `integration` (tests con Postgres) y `e2e` (Playwright contra el build, con Postgres). No usa secretos. SonarCloud analiza además cada PR (la configuración está en `.sonarcloud.properties`), y el workflow `Docs` construye el portal de documentación.
- Dependabot abre PRs semanales: las actualizaciones menores y de parche llegan agrupadas; las mayores, por separado.
  Las menores y de parche se aprueban y se mergean solas cuando pasan los checks obligatorios
  (`.github/workflows/dependabot-auto-merge.yml`); las mayores esperan revisión manual.

### Tamaño de los PRs

Un PR debería poder revisarse en menos de una hora: idealmente **menos de 400 líneas cambiadas**. Si es más grande, divídalo en varios PRs que se puedan revisar por separado.

### Cambios que tocan los dos repositorios

Si su cambio agrega o modifica un campo de la API pública, necesita un PR en este repositorio y otro en [`aso-computacion-landing`](https://github.com/aso-computacion-unl/aso-computacion-landing):

1. Mergee primero el del panel: la landing no puede leer un campo que la API todavía no envía.
2. Enlace cada PR desde el otro.
3. Actualice `docs/openapi.yaml` en el mismo PR del panel.
4. Si quita, renombra o cambia el tipo de un campo, suba `PUBLIC_CONTENT_SCHEMA_VERSION` y avise en el PR: la landing rechaza una versión que no conoce, así que necesita su propio cambio antes del siguiente despliegue.

## Guía por rol

Un mismo PR puede tocar varios roles; lea las secciones que le correspondan. Las [reglas del código](#reglas-del-código-que-no-se-negocian) valen para todos.

### Backend

El código sigue una **arquitectura hexagonal** en `src/`. Las dependencias van siempre hacia adentro:

| Capa | Qué vive ahí | Puede importar |
|---|---|---|
| `src/domain/` | Entidades y reglas puras (evento, noticia, slug, ventana de publicación) | Nada externo |
| `src/application/` | Casos de uso (`use-cases/`), puertos (`ports/`), DTO y mappers | `domain` |
| `src/infrastructure/` | Adaptadores: repositorios Prisma, Cloudinary, autenticación, Sentry | `application`, `domain` y librerías |
| `src/interface/` | Server actions (`admin/<entidad>/actions.ts`), guards, DTO públicos | Todo lo anterior |

Un test (`architecture-boundaries.test.ts`) falla si `domain` o `application` importan Next.js, Prisma, Cloudinary, Auth.js o `jose`.

**Agregar una server action:**

1. El guard va en la primera línea: `requireSession()`, `requireRole("EDITOR")` o `requireRole("ADMIN")`. Un test lo comprueba.
2. Sume una fila en `src/tests/support/action-policy.ts` con su rol y su registro de auditoría: sin esa fila, su suite falla.
3. Escriba el test que prueba que sin sesión (o con un rol insuficiente) no escribe nada.
4. La lógica va en un caso de uso de `application/`, no en la action.

**Cambiar la base de datos:** edite `prisma/schema.prisma` y genere una migración nueva con `npx prisma migrate dev --name descripcion` contra su base local. Nunca edite una migración ya mergeada. Anote en el PR que la migración hay que aplicarla en producción (ver `docs/DEPLOY.md`).

**Tests:**

- **Unitarios** en `src/tests/unit/`, con el nombre `*.test.ts`, en una carpeta que repite la capa que prueban (`domain/`, `application/`, `interface/`…). No usan base de datos.
- **De integración** en `src/tests/integration/infrastructure/`, con el nombre `*.integration.test.ts`. Prueban los repositorios contra un Postgres real. Cada suite nueva se **registra a mano** en `src/tests/support/integration-suites.ts`; si no, no corre.

### Frontend

La interfaz usa **Next.js 16 (App Router)**, **React 19** y **Tailwind 4**.

| Dónde | Qué hay |
|---|---|
| `app/admin/` | Una carpeta por sección del panel (`events`, `news`, `faqs`, `usuarios`…); los componentes compartidos del panel, en `app/admin/_components/` |
| `app/foro/` | El foro de estudiantes: categorías (`c/[slug]`), hilos (`hilo/[id]`) y eventos |
| `app/login/`, `app/invitacion/` | Acceso y aceptación de invitaciones |
| `components/ui/` | Componentes base (botón, input, select, switch…) al estilo [shadcn/ui](https://ui.shadcn.com) |
| `app/globals.css` | Los tokens de diseño (colores, tipografías) en el bloque `@theme` de Tailwind |

**Reglas prácticas:**

- Reutilice los componentes de `components/ui/` antes de crear uno nuevo, y use los colores del `@theme` en lugar de valores sueltos.
- El panel (`/admin`) abre en el tema claro editorial; el foro y el login siguen al sistema. La elección del usuario con el botón de tema siempre manda. Los tintes (`tint-red`, `tint-blue`, `tint-navy`, `success`) van siempre con su texto (`on-tint-*`) y cada par tiene su prueba de contraste en `admin-contrast-and-overlays.test.ts`.
- Las páginas no hablan con Prisma: llaman a una server action o a un caso de uso.
- El panel se usa mucho desde el celular. Revise cada cambio en **390 px** y en escritorio, con el teclado (Tab) y con el lector de pantalla si agrega un control nuevo.
- Si su cambio se ve, agregue capturas de antes y después en el PR.
- Los flujos de pantalla se prueban con Playwright (ver [QA](#qa)); si cambia un flujo crítico, actualice su spec en `e2e/`. Un evento, una pregunta o una novedad publicados se guardan en dos pasos ("Publicar" abre la vista previa y "Sí, publicar" guarda): en los specs use `publish(page)` de `e2e/publish.ts`.

### QA

QA no necesita escribir código para aportar: probar, reproducir y reportar bien también es colaborar.

**Probar y reportar:**

- Pruebe en el entorno local con `npm run seed:demo`, nunca con datos reales.
- Reporte cada error con la plantilla **Bug** de los issues: qué pasó, cómo se reproduce paso a paso, dispositivo y navegador, y capturas.
- Para revisar un PR, bájelo (`gh pr checkout <número>`), pruébelo y comente lo que encontró. La sección «Cómo lo probé» de la plantilla del PR dice qué revisar.

**Pruebas automatizadas:**

| Nivel | Dónde | Comando |
|---|---|---|
| Unitarias | `src/tests/unit/` | `npm run test` (o `npm run test:coverage`) |
| Integración | `src/tests/integration/` | `npm run test:integration` |
| Punta a punta | `e2e/*.spec.ts` | `npm run e2e` (un solo archivo: `npm run e2e -- e2e/forum.spec.ts`) |

- `npm run e2e` levanta su propia base con Docker, construye la app, corre Playwright y borra todo al terminar. Si un test falla en la CI, el job `e2e` sube los resultados (trazas incluidas) como artefacto `e2e-test-results`.
- La cobertura tiene un umbral mínimo en `vitest.config.ts`: no se baja para que un PR pase. Si baja, faltan tests.
- Los specs `audit-*.spec.ts` se pueden correr contra una instancia que ya está en marcha con `npm run e2e:live -- e2e/<spec>` (sin construir ni crear una base; la URL va en `LIVE_BASE_URL`, y `ADMIN_PASSWORD` y `DATABASE_URL` tienen que ser los de esa instancia).

## Reglas del código que no se negocian

Protegen la seguridad del panel y la privacidad de la directiva. Un PR que las rompe no se mergea:

- **Cada server action verifica la sesión y el rol** como primera instrucción: `requireSession()` si puede llamarla cualquier usuario con sesión, o `requireRole("ADMIN")` si es solo para administradores. Tiene además una fila en `src/tests/support/action-policy.ts` y un test que prueba que sin sesión no escribe nada (ver la [referencia técnica](docs/REFERENCIA.md#server-actions-are-guarded-individually)).
- **El foro es una zona aparte.** Las acciones y lecturas del foro verifican `requireForumMember()` / `requireForumPageMember()` (cookie `forum_session`, nunca la del admin) y nunca devuelven el correo de un estudiante en un DTO. Una cookie del foro no puede pasar un guard del admin, ni al revés: hay tests que lo prueban y no se tocan para que pasen (ver la [referencia técnica](docs/REFERENCIA.md#the-forum-is-a-separate-zone)).
- **La directiva solo tiene nombre, cargo y foto.** Nada de teléfono, correo, edad ni redes personales: hay tests que fallan si aparecen esos campos en el modelo o en una migración.
- **Migraciones solo hacia adelante.** No edite una migración ya mergeada; agregue una nueva. Las migraciones de producción se aplican a mano (ver `docs/DEPLOY.md`).
- **La API pública solo expone lo publicado.** Cualquier campo nuevo en `/api/public/content` es un cambio de contrato con la landing: coordine el PR en los dos repositorios. Agregar un campo no cambia `schemaVersion`; quitar, renombrar o cambiar el tipo de uno sí (`PUBLIC_CONTENT_SCHEMA_VERSION`), y la landing rechaza una versión que no conoce. Hay tests que fijan las claves exactas de cada objeto.
- **Comportamiento nuevo, test nuevo.** Escriba primero el test que falla, después el código.

## Buenas prácticas para la directiva

- **Secretos fuera de Git.** Nunca suba archivos `.env`, contraseñas, tokens ni URLs de deploy hooks. Las credenciales se comparten por un gestor de contraseñas, no por WhatsApp ni en un issue.
- **Fotos con permiso.** Solo publique fotos de eventos en las que las personas aceptaron aparecer.
- **Revisiones amables.** Comente el código, no a la persona. Si algo no queda claro, pregunte.
- **Cambio de directiva.** Cuando cambia la directiva:
  1. Sumar a las personas nuevas a la organización de GitHub y quitar a quienes salen.
  2. En el panel, en **Usuarios**: invitar a las personas nuevas (un administrador genera un enlace de un solo uso, que vence a los 7 días) y desactivar a quienes salen; en **Sesiones** se puede cerrar una sesión abierta al instante.
  3. Rotar `ADMIN_PASSWORD` en Vercel: es la contraseña de emergencia, y las personas que la conocían salen de la directiva. Rotarla no cierra las sesiones de nadie (cada sesión es una fila revocable, ver `docs/DEPLOY.md`); rotar `ADMIN_SECRET` sí cierra todas, también la suya.
  4. Revisar quién tiene acceso a Vercel, Neon, Cloudinary, Cloudflare (Pages y Turnstile) y al proyecto de Google Cloud del acceso con Google.

## Seguridad

Si encuentra una vulnerabilidad, **no abra un issue público**: siga [SECURITY.md](SECURITY.md).

## Licencia

Al contribuir, usted acepta que su aporte se publique bajo la [licencia MIT](LICENSE) del proyecto.
