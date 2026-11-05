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

## Reglas de la rama `main`

`main` es lo que está desplegado. Está protegida:

- Nadie empuja directo a `main`: todo cambio entra por un Pull Request.
- Cada PR necesita **1 aprobación** de otra persona.
- No se permite `force push` ni borrar `main`.
- La CI (GitHub Actions) tiene que pasar en verde para mergear. Corre tres jobs en cada PR: `checks` (auditoría de dependencias de producción con `npm audit`, que falla con avisos altos o críticos; lint; typecheck; tests unitarios con umbral de cobertura; build), `integration` (tests con Postgres) y `e2e` (Playwright contra el build, con Postgres). No usa secretos. SonarCloud analiza además cada PR (la configuración está en `.sonarcloud.properties`).
- Dependabot abre PRs semanales: las actualizaciones menores y de parche llegan agrupadas; las mayores, por separado.

## Flujo de trabajo

1. **Issue primero.** Para algo más grande que una errata, abra o elija un issue y comente que lo tomará.
2. **Rama nueva desde `main` actualizado:**
   ```sh
   git switch main && git pull
   git switch -c tipo/descripcion-corta   # ej.: fix/subida-fotos, feat/filtro-eventos
   ```
3. **Commits pequeños** con [Conventional Commits](https://www.conventionalcommits.org/es/): `feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`. El mensaje describe el cambio en inglés, en imperativo: `fix: keep the photo order after a failed upload`.
4. **Entorno local** (Node 22 y Docker): copie `.env.example` a `.env` y complételo según la [referencia técnica](docs/REFERENCIA.md#environment-variables). Use una base de Postgres propia, nunca la de producción.
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

### Tamaño de los PRs

Un PR debería poder revisarse en menos de una hora: idealmente **menos de 400 líneas cambiadas**. Si es más grande, divídalo en varios PRs que se puedan revisar por separado.

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
