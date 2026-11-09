# User journeys: forum and registrations

**Status: decided (2026-11-09).** Written from the code on `feat/qa-flujos` (registrations include the email confirmation of PRs #99-#103). Each journey says what the person does and sees today. Where the product owner decided a change, the journey links its decision (`D#`, at the end); the decision row is the specification until the journey is rewritten. This file is the specification the e2e tests (`e2e/`) check against.

Conventions:

- **Actor**: visitor (no session), student (forum member, `@unl.edu.ec` Google account), external person (open form), editor, admin.
- UI copy is quoted verbatim in Spanish, the language of the site.
- Each journey keeps a stable id (`F#` forum, `R#` registrations) so tests can name the journey they cover.

## Forum

### F1. A visitor opens the forum

- **Actor**: visitor. **Entry**: `/foro`.
- **Sees**: the sign-in gate "Su carrera se resuelve aquí", three tiles (Preguntar / Proponer / Armar equipo), the button "Entrar con Google" and "Solo con su correo @unl.edu.ec. La primera vez se crea su cuenta." No forum content, no categories, no counts. The top bar has only the theme toggle.
- **A suspended member** (the browser still holds the cookie of that member's session, which the suspension closed): instead of the gate, the notice "Su cuenta del foro está suspendida" with "La moderación suspendió su cuenta, por eso no puede ver ni publicar en el foro." and "escriba a la directiva de ASO", and the button "Entrar con otra cuenta de Google" (D1). No forum content, no name, no way to act: the notice only changes the words. Only the holder of that member's own signed cookie sees it; a visitor, an expired or foreign cookie, an admin session and an active member see the gate or the forum as before, so nothing can be learned about an account from outside. Any page of the forum ends here for that member (`/foro/hilo/<id>` → `/foro?next=…` → the notice).
- **After a failed sign-in** (`/foro?error=<code>`): an alert above the button, which becomes "Entrar de nuevo con Google".

| Code | Message |
| --- | --- |
| `unavailable` | "El acceso al foro no está disponible ahora. Intente más tarde." |
| `failed` | "No se pudo completar el acceso con Google. Inténtelo de nuevo." |
| `denied` | "Solo pueden entrar estudiantes con su cuenta institucional verificada." |
| `suspended` | "Su cuenta del foro está suspendida. Para resolverlo, escriba a la directiva de ASO." (D1; only after Google proved the account is theirs) |
| `verification` | "No pudimos verificar su cuenta con Google en este momento. Inténtelo de nuevo en unos minutos." |

- An unknown `error` or a foreign `next` is ignored.

### F2. A visitor follows a deep link

- **Entry**: `/foro/hilo/<id>`, `/foro/c/<slug>`, `/foro/c/<slug>/nuevo`. (`/foro/eventos` is no longer a forum page: it redirects out, R3.)
- **Expected**: redirect to `/foro?next=<path>`; after signing in the student lands on the page they asked for.
- `next` is kept only for `/foro…` and `/inscripciones/<slug>`; anything else ends at `/foro`.
- **A sign-in that began on an event's page** (`next=/inscripciones/<slug>`, R2) also *fails* back to that page, with `?error=<code>` and told in registration words (D5, D8): the forum landing never shows a registration student a forum screen. A suspended account gets the generic `denied` there; the suspension code is for the forum landing only.

### F3. A student signs in with Google

- **Entry**: "Entrar con Google" → `/foro/auth/google/start` → Google → `/foro/auth/google/callback`.
- **First time**: the account is created (active, display name from Google) with a 7-day session.
- **Expected**: `forum_sid` cookie set, redirect to `next` or `/foro`. A previous session in the same browser is revoked.
- **Refused** (→ F1 with `denied`): login switched off, email not verified, domain not `@unl.edu.ec` or `hd` claim missing, no Google `sub`, email tied to another Google identity. A suspended member is refused with `suspended` (→ F1, D1), apart from these; no session is opened.
- **Failures** (→ F1): config missing or unexpected error → `unavailable`; Google error, missing/mismatched state cookie → `failed`; Google down → `verification`.

### F4. A student browses threads

- **Entry**: `/foro`, with `?estado=resueltos`, `?categoria=<slug>`, `?pagina=N` (20 per page).
- **Sees**: the rail (Abiertos / Resueltos counts and the categories) and the thread list. The forum is only the forum: no registrations page, no link to one, no "Eventos" group in the rail or on phones (D8).
- **Empty states**: "Todavía no hay categorías." / "La directiva las irá creando. Vuelva pronto."; "Todavía no hay hilos[ en X]." / "Sea la primera persona en abrir uno."; "No hay hilos abiertos…" / "Todos los hilos ya están resueltos."; "No hay hilos resueltos…" / "Un hilo queda resuelto cuando se marca su mejor respuesta."
- **Edges**: a page past the end shows the last page; unknown category → 404; `/foro/c/<slug>` → `/foro?categoria=<slug>` keeping filters; `/foro/<anything else>` → 404 inside the forum; a render error → "Algo salió mal" with "Reintentar" and "Volver al foro".

### F5. A student reads a thread

- **Entry**: `/foro/hilo/<id>`.
- **Sees**: status chip (Abierto / Resuelto / Cerrado), the opening post, replies oldest first, the best answer anchored at `#mejor`. On each reply: «Me sirvió»; «Reportar» on other people's posts; «Marcar como mejor respuesta» for the thread author while the thread is not locked.
- **Locked thread**: no reply form; "Hilo cerrado por la moderación" / "Se puede leer, pero ya no admite respuestas nuevas."
- **Hidden reply** (D4): it keeps its place in the order as a card that says "Respuesta oculta por la moderación", with no text, author, time, reactions, «Me sirvió», «Reportar» or best-answer button. The server builds it from the id alone, so the hidden text, its author and its reactions never reach the browser (neither the markup nor the component props). The count "N respuestas" is of the replies that can be read. Hiding a reply also clears it as the thread's best answer; should the thread still point at a hidden reply, the best-answer slot (`#mejor`) shows the same placeholder.
- **Edges**: hidden or unknown thread → 404.

### F6. A student opens a thread

- **Entry**: `/foro/c/<slug>/nuevo` (also from the "new thread" menu and row).
- **Steps**: title (≤ 120), Markdown body (≤ 10 000) with live preview, publish.
- **Expected**: lands on `/foro/hilo/<id>` with the new thread.
- **A draft** (D5): title and text are also kept in this tab's `sessionStorage` while typing (one draft per category), given back when the form opens again (after signing in, the sign-in returns to `/foro/c/<slug>/nuevo`), and forgotten once the thread is published, on «Cerrar sesión» and when the tab closes.
- **Errors** (each with a "Volver al foro" link):

| Case | Message |
| --- | --- |
| Title empty or too long | "El título es obligatorio y admite hasta 120 caracteres." |
| Body empty or too long | "El texto es obligatorio y admite hasta 10000 caracteres en un hilo y 5000 en una respuesta." |
| Posting too fast (3 per minute, 30 per hour, threads and replies together) | "Está publicando muy rápido: el límite es de 3 publicaciones por minuto. Puede volver a intentarlo en 1 minuto." or "…de 30 publicaciones por hora. Puede volver a intentarlo en 60 minutos." (D3: names the limit that tripped; the wait is in whole minutes, rounded up: "1 minuto" / "N minutos") |
| Session gone | "Inicie sesión para participar en el foro." with the link "Iniciar sesión" (to `/foro?next=<this page>`) instead of "Volver al foro"; what was typed stays (D5) |
| Suspended | "Su cuenta no puede participar en el foro." |
| Unknown category | "No se encontró la publicación." |
| Unexpected | "Ocurrió un error inesperado. Intente nuevamente." |

### F7. A student replies

- **Entry**: the reply form at the bottom of a thread.
- **Steps**: body (≤ 5 000), publish.
- **Expected**: the box clears, "Respuesta publicada." and the reply appears.
- **Errors**: as F6 (the throttle message, and the session-gone message with "Iniciar sesión" back to `/foro/hilo/<id>`), plus a locked thread (also if it is locked while writing): "Este hilo está cerrado: no admite respuestas ni cambios."
- **A draft** (D5): the reply is kept like F6's, one draft per thread; the box comes back with its text after signing in, and clears for good once the reply is published.

### F8. A student reacts, picks the best answer, reports

- **«Me sirvió»**: toggles at once and reverts if the server refuses. Works on locked threads. Not offered on the opening post (D2).
- **Best answer**: only the thread author; marking it solves the thread; doing it again ("Quitar de mejor respuesta") reopens it. Others get "Solo quien abrió el hilo puede elegir la mejor respuesta."
- **Report**: a reason (Spam o publicidad, Contenido ofensivo o acoso, Fuera de tema, Información falsa o engañosa, Otro motivo) and an optional note (≤ 400). Success: "Reporte enviado. La moderación lo revisará." A second report of the same post while the first is open: "Ya reportó esta publicación. La moderación la revisará."

### F9. A student signs out

- **Entry**: «Cerrar sesión» in the identity chip ("Estudiante UNL").
- **Expected**: session revoked, cookie cleared, back at the F1 gate. Works even when the session had already expired.

### F10. A student is suspended while signed in

- **Expected** (D1): the next page shows the suspension notice of F1 ("Su cuenta del foro está suspendida… escriba a la directiva de ASO") instead of the sign-in gate, and the member still gets no forum content: the guard keeps refusing the session, so no read or action succeeds. Actions in flight answer "Inicie sesión para participar en el foro." (with the same way back to the page, F6/F7). Signing in again with the same Google account ends at `/foro?error=suspended`; the member can enter with another account from the notice. A moderator's «Reactivar la cuenta» brings the member back at their next sign-in.

### F11. A moderator works the report queue

- **Actor**: editor or admin. **Entry**: `/admin/foro/reportes`.
- **Sees**: tabs Abiertos / Cerrados with counts; one report at a time ("N de M", Anterior / Siguiente) with the post excerpt, author, reporter and reason.
- **Actions**: Ocultar / Mostrar, Ignorar, Suspender… (with confirmation) / Reactivar la cuenta, Marcar como resuelto, Cerrar / Reabrir el hilo, «Ver el hilo completo» (new tab). Optional note ≤ 500 ("La nota admite hasta 500 caracteres.").
- **Expected**: each change is applied and audited; suspending ends the member's sessions.
- **Concurrency**: "Sin cambios: otra persona ya lo había hecho." (nothing audited); "Otra persona ya cerró este reporte."; "No se encontró la publicación, el reporte o la cuenta. Puede que ya no exista."
- **Empty**: "No hay reportes abiertos" / "Todavía no se cerró ningún reporte."
- **Members list** (`/admin/foro/miembros`, same roles, reached from the report queue): every member newest first, 20 per page, with display name, email, status (Activo / Suspendido, and the day it was suspended), the day they joined and their last sign-in ("Sin ingresos registrados" when none). A search by name or email (`?q=`, ignores case; shareable URL) and the "Todos / Suspendidos" filter (`?estado=suspendidos`) combine; «Quitar búsqueda» clears it. A suspended member has «Reactivar la cuenta», the same action as on a report card (same rules, same audit entry `forum.member.reactivate`, "Cuenta reactivada." / "Sin cambios: otra persona ya lo había hecho."). Nothing else: suspending stays on the report card, and there is no delete or ban.
- **Members empty states**: "Todavía no hay miembros. Aparecen aquí cuando un estudiante entra al foro con su cuenta de la UNL."; "No hay cuentas suspendidas."; "No hay miembros que coincidan con «texto»." with «Quitar la búsqueda».

### F12. An admin manages categories

- **Actor**: admin only (an editor is sent home). **Entry**: `/admin/foro/categorias`.
- **Steps**: list with thread counts, create (goes last), edit (blank slug or description keeps the current value), delete.
- Form errors and delete rules: to map in T4.

## Registrations

A published event has one registration mode: `none`, `unl` (students, with their UNL Google account, which is the forum's sign-in under the hood) or `open` (anyone, email confirmed). Registrations are a section of their own, apart from the forum (D8): a public list at `/inscripciones` and one page per event at `/inscripciones/<slug>`, both under the same top bar ("Inscripciones", whose brand leads to the list; no "Foro" anywhere). Unknown, unpublished or trashed events → 404. Every screen of this section says "Inscripciones", never "foro".

### R1. Someone opens an event without registration

- **Mode**: `none`. **Sees**: under the registrations' bar, the ticket, "Pase libre — No necesita inscribirse: solo llegue.", and the `.ics` only when the event has an exact day that has not passed.

### R2. A student registers for a UNL event

- **Mode**: `unl`. **Entry**: `/inscripciones/<slug>` (from the list, R3, or a shared link).
- **Signed out**: "Entre con su correo @unl.edu.ec para reservar su cupo." and "Entrar con Google" (→ F3 with `next=/inscripciones/<slug>`, back to the page). After a failed sign-in the page shows the reason above the button, in registration words ("El acceso no está disponible ahora…", "No se pudo completar el acceso con Google…", "Esa cuenta no puede entrar. Use su correo institucional @unl.edu.ec.", "No pudimos verificar su cuenta con Google…"), and the button reads "Intentar de nuevo".
- **Google login not configured** (S8): instead of the sign-in, "La inscripción con cuenta UNL no está disponible en este momento. Inténtelo de nuevo más tarde." (a full or closed event still says so first; someone already signed in can still reserve).
- **Signed in**: "Se reservará a nombre de <nombre>" and "Reservar mi cupo". No form: name and email come from the forum account. The seat is taken at once.
- **Expected**: "Usted ya está inscrito en este evento." and the `.ics`, plus a line on whether a reminder will be emailed.
- **Errors**:

| Case | Message |
| --- | --- |
| Already registered | "Ya está inscrito en este evento." |
| Full | "Ya no quedan cupos para este evento." |
| Closed (checked before full) | "Las inscripciones de este evento ya cerraron." |
| Mode changed meanwhile | "Este evento no admite inscripción con cuenta UNL." |
| Event gone | "No se encontró el evento." |
| Session expired (D5) | "Su sesión terminó. Entre de nuevo con su cuenta @unl.edu.ec para reservar su cupo." and, where the login works, an "Entrar con Google" button that returns to this same event page |
| Account not allowed or suspended (D5) | "Su cuenta no puede reservar cupos. Use su cuenta institucional @unl.edu.ec." |
| Unexpected | "Ocurrió un error inesperado. Intente nuevamente." |

- A full or closed event shows its message instead of the button, before anyone tries.

### R3. Someone finds the events they can register for

- **Entry**: `/inscripciones`, public: no sign-in, no session read (D8). The landing and the old forum address link to it.
- **Sees**: under the registrations' bar, "Inscripciones" and one card per event that takes a registration **right now**, UNL and open form alike: the date on a stub, the title, "Con cuenta UNL" or "Abierta al público", date, hour and place, a two-line description, and the live seats ("Quedan N cupos", "Queda 1 cupo", "Sin límite de cupos"). The kicker counts them ("3 eventos con inscripción abierta").
- **Order**: soonest first, events without a date last, the title breaking ties. A card leads to `/inscripciones/<slug>`; the card is a link, the title is its heading.
- **Left out**: events that are closed (deadline or day passed), full, free entry (`none`), drafts, scheduled or withdrawn.
- **Empty**: "No hay inscripciones abiertas." / "Cuando la directiva abra una, la verá aquí." and the kicker "Sin inscripciones abiertas".
- A failed read is an error page, not an empty list: an empty one would say nothing is open when it could not be read.
- `/foro/eventos` → 308 to `/inscripciones` (the query string is kept); `/foro/eventos/<slug>` → 308 to `/inscripciones/<slug>`.

### R4. An external person registers with the open form

- **Mode**: `open`. **Entry**: `/inscripciones/<slug>`, no session.
- **Steps**: name, email, institution, career (optional), semester 1-12 (optional), Turnstile when configured, send.
- **Expected**: "Revise su correo": the registration is **pending** and takes no seat; the email link is valid 48 h; mentions the spam folder.
- **Checked in the browser before sending**: "Escriba su nombre.", "Escriba su correo.", "Escriba su institución.", "Revise su correo: no parece una dirección válida.", plus length and invalid-character messages.
- **Server answers**:

| Case | Answer | Message |
| --- | --- | --- |
| 6th attempt in 10 min from the same client | 429 | "Hizo varios intentos seguidos. Vuelva a intentarlo en N minutos." |
| Turnstile failed | 400 `captcha` | "No pudimos comprobar que usted es una persona. Complete la verificación e inténtelo de nuevo." |
| Turnstile unavailable or misconfigured | 503 `unavailable` | "La inscripción no está disponible en este momento. Inténtelo de nuevo en unos minutos." |
| Invalid field | 400 `validation` | under the field |
| Mail not configured or provider down | 503 `email_unavailable` | "No pudimos enviarle el correo de confirmación en este momento. Inténtelo de nuevo en unos minutos." |
| Daily mail budget used up | 503 `email_budget` | "Hoy ya enviamos todos los correos de confirmación que podemos. Inténtelo de nuevo mañana." (D12) |
| Event gone or no longer open | 404 | "Este evento ya no recibe inscripciones desde aquí." |
| Closed / full | 409 | the form is replaced by the reason |
| Email already confirmed | 409 `duplicate` | "Ya hay una inscripción con ese correo para este evento. No necesita hacer nada más." (D10) |
| Email still pending | 201 | same pending row, new 48 h window and new link (D9) |
| Network failure | — | "No pudimos enviar su inscripción. Revise su conexión e inténtelo de nuevo." |

### R5. The external person confirms the email

- **Entry**: the link `/inscripciones/<slug>/confirmar?token=…`.
- **Sees**: the ticket and "Confirmar mi cupo". Opening the link never confirms by itself (mail scanners open links).
- **Expected after the click**: "Listo, su cupo está reservado" with the `.ics`; the seat is taken now.

| Case | Message |
| --- | --- |
| Already confirmed | "Su cupo ya estaba reservado" |
| Full at confirmation time (stays pending) | "Cupos agotados" |
| Closed at confirmation time (stays pending) | "Las inscripciones cerraron" |
| Link or row older than 48 h | "Este enlace venció" |
| Bad, foreign or unknown token | "Este enlace no sirve" |
| Event no longer open | 404 page (D11) |
| Too many attempts | "Demasiados intentos. Espere N minutos..." |
| Service unavailable | "No pudimos confirmar su cupo. El servicio no está disponible…" with retry |
| Network failure | "Revise su conexión e inténtelo de nuevo." |

- An unconfirmed registration is deleted after 48 h (R7).

### R6. Registered people get a reminder

- **Actor**: the daily cron. **When**: events with an exact day 1 to 3 days ahead (Ecuador time), mode `unl` or `open`.
- **Expected**: one email per confirmed person, nearest events first, never twice. A failed send is retried the next day. Stops early on budget, time, 3 provider failures in a row, or missing configuration.
- People who register less than a day before get no reminder (D13). There is no way to cancel from the email (D7).

### R7. Old registration data is deleted

- **Actor**: the daily cron.
- **Expected**: registrations are deleted 90 days after the event's last day; pending ones after 48 h; events without a date are never purged. Each run that deletes something writes an `event.registration_purge` audit entry with the count only.

### R8. An admin sets up registration on an event

- **Entry**: the event form, "Tiene inscripción" switch, "Cuenta UNL" / "Formulario abierto", "Cupos" (1-5000, empty = no limit), "Cierre" (Ecuador time, empty = when the day passes).
- **Where people register**: both modes on `/inscripciones/<slug>`, which is also listed at `/inscripciones` (R3) while it is open; the admin copies that link from R9.
- **Errors**: "Elija una forma de inscripción de la lista.", "Indique un número entero de 1 a 5000.", "Indique una fecha y hora válidas."
- Changing mode or lowering seats when people are already registered is not checked (D14).

### R9. Staff see, delete and export registrations

- **Actor**: editor and admin see; only admin deletes and exports. **Entry**: `/admin/registrations?evento=<id>` (`/admin/events/<id>/registrations` redirects there).
- **Sees**: upcoming and past events on the left, the registrants table on the right; empty: "Ningún evento pide inscripción todavía…".
- **Delete**: "Se borrarán los datos de X y se liberará su cupo." / "Esta acción no se puede deshacer." Audited without the name.
- **Export CSV**: spreadsheet-safe, audited with the count only. Editor → 403.
- **Empty states per event**: no registration, not published, and UNL or open: the copyable link `/inscripciones/<slug>` with "Copiar link" (D15; without `AUTH_URL` it shows the path and names the missing setting). The open-form text no longer points to the landing card.

### R10. The landing shows live seats

- `GET /api/public/events/seats`: public, no personal data; `closed` wins over `full`.

## Decisions

Taken with the product owner on 2026-11-09. The journeys above describe today's behaviour; where a row below applies, **the row is the specification** and wins over the journey text. Each journey is rewritten to the decided behaviour when its change lands, and the e2e tests check the decided behaviour.

| # | Journey | Decision | Expected behaviour |
| --- | --- | --- | --- |
| D1 | F10 | Tell a suspended student at once | **Built** (`e2e/forum-ux.spec.ts`). Opening the forum with a suspended account shows a suspension notice ("escriba a la directiva de ASO") instead of the sign-in gate; the sign-in refusal for a suspended account is its own message, apart from domain or verification refusals |
| D2 | F8 | Build it now | A student edits their own thread and replies (shown as "editado"); «Me sirvió» is offered on the opening post too |
| D3 | F6 | Name the limit, in minutes | **Built** (`e2e/forum-ux.spec.ts`). The throttle message says which limit was hit (per minute or per hour) and the wait in minutes |
| D4 | F5 | Visible placeholder | **Built** (`e2e/forum-ux.spec.ts`). A hidden reply leaves "Respuesta oculta por la moderación" in its place, without its content; a hidden best answer shows the same placeholder |
| D5 | F6, F7, R2 | Keep text, return, own wording | **Built** (forum: F6, F7, `e2e/forum-ux.spec.ts`; registrations: R2, `e2e/audit-registration.spec.ts`, unit tests of the action, the event page and the sign-in return): an expired session keeps the typed text and the sign-in link returns to the same page; the registration screens use registration wording, never "participar en el foro", and a failed sign-in that began on an event's page comes back to it |
| D6 | F11 | Simple members list | `/admin/foro/miembros`: search, "suspendidos" filter, Reactivar (built; `e2e/forum-members-admin.spec.ts`) |
| D7 | R2, R4, R6 | Build cancellation now | A registered person can say they cannot attend and free the seat: a link in the confirmation and reminder emails, and on the event page for UNL students |
| D8 | F4, R3 | Forum and registrations are separate sections | **Built** (`e2e/audit-registration.spec.ts`, `e2e/forum-member.spec.ts`, `e2e/event-page.spec.ts`). The forum is only the forum (no registrations page or link). `/inscripciones` is a public list, no sign-in, of every event taking registrations (UNL and open), with its own top bar (no "Foro"). `/foro/eventos` redirects there. UNL students still prove their UNL Google account to reserve, but the screens say "Inscripciones", never "foro" |
| D9 | R4 | Only the latest link works | Registering again while pending makes the previous link answer "Este enlace no sirve" |
| D10 | R4 | Accept | "Ya hay una inscripción con ese correo…" stays |
| D11 | R5 | Clear message | The confirm page of an event no longer open says "Este evento ya no recibe inscripciones" instead of a 404 |
| D12 | R4, R6 | Reserve budget for confirmations | Reminders use at most ~70 % of the daily email cap; the rest stays for confirmation emails |
| D13 | R6 | No reminder | People who register less than a day before get no reminder (unchanged) |
| D14 | R8 | Warn and confirm | Changing the mode or lowering seats below the registered count asks "Este evento ya tiene N inscritos…" before saving |
| D15 | R9 | Copyable link | **Built** (`e2e/audit-registration.spec.ts`). Open events show the copyable `/inscripciones/<slug>` link in the admin, like UNL |

Found while mapping coverage:

- **UNL mode with Google not configured** (S8, **built**: `e2e/event-page.spec.ts`, `e2e/audit-registration.spec.ts`). The page used to offer "Entrar con Google", which ended at the `unavailable` error, though `docs/DEPLOY.md` said it did not. It now asks `isForumEnabled` (`src/infrastructure/forum/forum-config.ts`) and says the UNL registration is not available right now instead of offering a sign-in that cannot work (R2).
- **F12 categories**: name required, ≤ 60; description optional, ≤ 200; blank slug derived from the name on create and kept on edit; invalid or taken slug → error on the slug field; new category goes last; delete refused while it has any thread, hidden ones too: "La categoría todavía tiene hilos y no se puede eliminar."
- **Display name**: set once from Google at sign-up and never updated; there is no way to change it.
