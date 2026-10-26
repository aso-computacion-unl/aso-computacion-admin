# Cómo colaborar

Gracias por ayudar con el panel de administración de ASO Computación. Esta guía es para la directiva y para cualquier estudiante que quiera aportar.

## ¿Querés cambiar contenido o código?

| Quiero… | Dónde se hace | ¿Necesito Git? |
|---|---|---|
| Publicar un evento, subir fotos, editar la FAQ, la directiva, los pilares o las redes | En el **panel** ya desplegado, con la contraseña de la directiva | No |
| Cambiar cómo funciona el panel (pantallas, reglas, API pública) | En **este repositorio**, con un Pull Request | Sí |
| Cambiar el sitio público (diseño, textos fijos) | En el repositorio **`aso-computacion-landing`** | Sí |
| Reportar un error o proponer una idea | Abriendo un **issue** en este repositorio | No |

Si no sabés por dónde empezar, abrí un issue y lo vemos juntos.

## Reglas de la rama `main`

`main` es lo que está desplegado. Está protegida:

- Nadie empuja directo a `main`: todo cambio entra por un Pull Request.
- Cada PR necesita **1 aprobación** de otra persona.
- No se permite `force push` ni borrar `main`.
- La CI (GitHub Actions) tiene que pasar en verde para mergear: corre auditoría de dependencias de producción (`npm audit`, falla con avisos altos o críticos), lint, typecheck, tests unitarios con umbral de cobertura, tests de integración con Postgres y build en cada PR. No usa secretos.
- Dependabot abre PRs semanales: las actualizaciones menores y de parche llegan agrupadas; las mayores, por separado.

## Flujo de trabajo

1. **Issue primero.** Para algo más grande que un error de tipeo, abrí o elegí un issue y comentá que lo tomás.
2. **Rama nueva desde `main` actualizado:**
   ```sh
   git switch main && git pull
   git switch -c tipo/descripcion-corta   # ej.: fix/subida-fotos, feat/filtro-eventos
   ```
3. **Commits pequeños** con [Conventional Commits](https://www.conventionalcommits.org/es/): `feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`. El mensaje describe el cambio en inglés, en imperativo: `fix: keep the photo order after a failed upload`.
4. **Entorno local** (Node 22 y Docker): copiá `.env.example` a `.env` y completalo según el [referencia técnica](docs/REFERENCIA.md#environment-variables). Usá una base de Postgres propia, nunca la de producción.
5. **Comprobá localmente** antes de pedir revisión; la CI corre lo mismo en el PR:
   ```sh
   npm ci
   npm run lint
   npm run typecheck
   npm run test:coverage      # tests unitarios + umbral de cobertura
   npm run test:integration   # levanta su propio Postgres con Docker
   npm run build
   ```
   Si cambiaste algo visual, revisalo con `npm run dev` en celular (390 px) y escritorio.
6. **Abrí el PR** contra `main`, completá la plantilla y enlazá el issue (`Closes #12`).
7. **Revisión.** Respondé los comentarios con commits nuevos en la misma rama; no reescribas la historia de una rama que ya está en revisión.
8. **Merge.** Quien aprueba (o quien abrió el PR, una vez aprobado) hace el merge y borra la rama.

### Tamaño de los PRs

Un PR debería poder revisarse en menos de una hora: idealmente **menos de 400 líneas cambiadas**. Si es más grande, dividilo en varios PRs que se puedan revisar por separado.

## Reglas del código que no se negocian

Protegen la seguridad del panel y la privacidad de la directiva. Un PR que las rompe no se mergea:

- **Cada server action verifica la sesión** con `requireAdminSession()` como primera instrucción y tiene un test que prueba que sin sesión no escribe nada (ver la [referencia técnica](docs/REFERENCIA.md#server-actions-are-guarded-individually)).
- **La directiva solo tiene nombre, cargo y foto.** Nada de teléfono, correo, edad ni redes personales: hay tests que fallan si aparecen esos campos en el modelo o en una migración.
- **Migraciones solo hacia adelante.** No edites una migración ya mergeada; agregá una nueva. Las migraciones de producción se aplican a mano (ver `docs/DEPLOY.md`).
- **La API pública solo expone lo publicado.** Cualquier campo nuevo en `/api/public/content` es un cambio de contrato con la landing: coordiná el PR en los dos repositorios.
- **Comportamiento nuevo, test nuevo.** Escribí primero el test que falla, después el código.

## Buenas prácticas para la directiva

- **Secretos fuera de Git.** Nunca subas archivos `.env`, contraseñas, tokens ni URLs de deploy hooks. Las credenciales se comparten por un gestor de contraseñas, no por WhatsApp ni en un issue.
- **Fotos con permiso.** Solo publicá fotos de eventos en las que las personas aceptaron aparecer.
- **Revisiones amables.** Comentá el código, no a la persona. Si algo no queda claro, preguntá.
- **Cambio de directiva.** Cuando cambia la directiva:
  1. Sumar a las personas nuevas a la organización de GitHub y quitar a quienes salen.
  2. Rotar `ADMIN_PASSWORD` **y** `ADMIN_SECRET` en Vercel; cambiar solo la contraseña no cierra las sesiones abiertas (ver `docs/DEPLOY.md`).
  3. Revisar quién tiene acceso a Vercel, Neon, Cloudinary y Cloudflare.

## Seguridad

Si encontrás una vulnerabilidad, **no abras un issue público**: seguí [SECURITY.md](SECURITY.md).

## Licencia

Al contribuir aceptás que tu aporte se publique bajo la [licencia MIT](LICENSE) del proyecto.
