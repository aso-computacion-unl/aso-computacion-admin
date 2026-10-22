## Qué cambia

<!-- Una o dos frases. Enlazá el issue: Closes #123 -->

## Cómo lo probé

<!-- No hay CI: marcá lo que corriste localmente. -->

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run test:integration` (si toqué la base, Prisma o una migración)
- [ ] `npm run build`
- [ ] Revisé el cambio con `npm run dev` en celular (390 px) y escritorio (si es visual)

## Antes de pedir revisión

- [ ] El PR tiene menos de ~400 líneas cambiadas, o explico por qué no se puede dividir
- [ ] Toda server action nueva llama a `requireAdminSession()` primero y tiene su test sin sesión
- [ ] No agrega datos de contacto a la directiva
- [ ] Si cambia `/api/public/content`, hay un PR coordinado en `aso-computacion-landing`
- [ ] Si agrega una migración, es nueva (no edita una existente) y lo anoté para aplicarla en producción
- [ ] No incluye secretos, archivos `.env` ni datos personales
- [ ] Actualicé el README o `docs/DEPLOY.md` si cambié cómo se usa o se despliega algo

## Capturas (si es visual)
