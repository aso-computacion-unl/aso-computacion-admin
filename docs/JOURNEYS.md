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
- **After a failed sign-in** (`/foro?error=<code>`): an alert above the button, which becomes "Entrar de nuevo con Google".

| Code | Message |
| --- | --- |
| `unavailable` | "El acceso al foro no está disponible ahora. Intente más tarde." |
| `failed` | "No se pudo completar el acceso con Google. Inténtelo de nuevo." |
| `denied` | "Solo pueden entrar estudiantes con su cuenta institucional verificada." plus the hint about a suspended account ("…es posible que la moderación haya suspendido su cuenta: escriba a la directiva de ASO.") |
| `verification` | "No pudimos verificar su cuenta con Google en este momento. Inténtelo de nuevo en unos minutos." |

- An unknown `error` or a foreign `next` is ignored.

### F2. A visitor follows a deep link

- **Entry**: `/foro/hilo/<id>`, `/foro/c/<slug>`, `/foro/c/<slug>/nuevo`, `/foro/eventos`.
- **Expected**: redirect to `/foro?next=<path>`; after signing in the student lands on the page they asked for.
- `next` is kept only for `/foro…` and `/inscripciones/<slug>`; anything else ends at `/foro`.

### F3. A student signs in with Google

- **Entry**: "Entrar con Google" → `/foro/auth/google/start` → Google → `/foro/auth/google/callback`.
- **First time**: the account is created (active, display name from Google) with a 7-day session.
- **Expected**: `forum_sid` cookie set, redirect to `next` or `/foro`. A previous session in the same browser is revoked.
- **Refused** (→ F1 with `denied`): login switched off, email not verified, domain not `@unl.edu.ec` or `hd` claim missing, no Google `sub`, email tied to another Google identity, suspended member.
- **Failures** (→ F1): config missing or unexpected error → `unavailable`; Google error, missing/mismatched state cookie → `failed`; Google down → `verification`.

### F4. A student browses threads

- **Entry**: `/foro`, with `?estado=resueltos`, `?categoria=<slug>`, `?pagina=N` (20 per page).
- **Sees**: the rail (Abiertos / Resueltos counts, categories, link to Inscripciones) and the thread list.
- **Empty states**: "Todavía no hay categorías." / "La directiva las irá creando. Vuelva pronto."; "Todavía no hay hilos[ en X]." / "Sea la primera persona en abrir uno."; "No hay hilos abiertos…" / "Todos los hilos ya están resueltos."; "No hay hilos resueltos…" / "Un hilo queda resuelto cuando se marca su mejor respuesta."
- **Edges**: a page past the end shows the last page; unknown category → 404; `/foro/c/<slug>` → `/foro?categoria=<slug>` keeping filters; `/foro/<anything else>` → 404 inside the forum; a render error → "Algo salió mal" with "Reintentar" and "Volver al foro".

### F5. A student reads a thread

- **Entry**: `/foro/hilo/<id>`.
- **Sees**: status chip (Abierto / Resuelto / Cerrado), the opening post, replies oldest first, the best answer anchored at `#mejor`. On each reply: «Me sirvió»; «Reportar» on other people's posts; «Marcar como mejor respuesta» for the thread author while the thread is not locked.
- **Locked thread**: no reply form; "Hilo cerrado por la moderación" / "Se puede leer, pero ya no admite respuestas nuevas."
- **Edges**: hidden or unknown thread → 404. Hidden replies disappear with no placeholder (D4).

### F6. A student opens a thread

- **Entry**: `/foro/c/<slug>/nuevo` (also from the "new thread" menu and row).
- **Steps**: title (≤ 120), Markdown body (≤ 10 000) with live preview, publish.
- **Expected**: lands on `/foro/hilo/<id>` with the new thread.
- **Errors** (each with a "Volver al foro" link):

| Case | Message |
| --- | --- |
| Title empty or too long | "El título es obligatorio y admite hasta 120 caracteres." |
| Body empty or too long | "El texto es obligatorio y admite hasta 10000 caracteres en un hilo y 5000 en una respuesta." |
| Posting too fast (3 per minute, 30 per hour, threads and replies together) | "Está publicando muy rápido. Espere un momento y vuelva a intentarlo." + "Puede volver a intentarlo en N s." (D3) |
| Session gone | "Inicie sesión para participar en el foro." (D5) |
| Suspended | "Su cuenta no puede participar en el foro." |
| Unknown category | "No se encontró la publicación." |
| Unexpected | "Ocurrió un error inesperado. Intente nuevamente." |

### F7. A student replies

- **Entry**: the reply form at the bottom of a thread.
- **Steps**: body (≤ 5 000), publish.
- **Expected**: the box clears, "Respuesta publicada." and the reply appears.
- **Errors**: as F6, plus a locked thread (also if it is locked while writing): "Este hilo está cerrado: no admite respuestas ni cambios."

### F8. A student reacts, picks the best answer, reports

- **«Me sirvió»**: toggles at once and reverts if the server refuses. Works on locked threads. Not offered on the opening post (D2).
- **Best answer**: only the thread author; marking it solves the thread; doing it again ("Quitar de mejor respuesta") reopens it. Others get "Solo quien abrió el hilo puede elegir la mejor respuesta."
- **Report**: a reason (Spam o publicidad, Contenido ofensivo o acoso, Fuera de tema, Información falsa o engañosa, Otro motivo) and an optional note (≤ 400). Success: "Reporte enviado. La moderación lo revisará." A second report of the same post while the first is open: "Ya reportó esta publicación. La moderación la revisará."

### F9. A student signs out

- **Entry**: «Cerrar sesión» in the identity chip ("Estudiante UNL").
- **Expected**: session revoked, cookie cleared, back at the F1 gate. Works even when the session had already expired.

### F10. A student is suspended while signed in

- **Expected today**: the next page shows the F1 gate as if signed out; actions in flight answer "Su cuenta no puede participar en el foro." or "Inicie sesión para participar en el foro." The reason only shows after trying to sign in again (`denied` hint) (D1).

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

A published event has one registration mode: `none`, `unl` (students, with the forum Google account) or `open` (anyone, email confirmed). Every event has its page at `/inscripciones/<slug>`; unknown, unpublished or trashed events → 404.

### R1. Someone opens an event without registration

- **Mode**: `none`. **Sees**: the ticket, "Pase libre — No necesita inscribirse: solo llegue.", and the `.ics` only when the event has an exact day that has not passed.

### R2. A student registers for a UNL event

- **Mode**: `unl`. **Entry**: `/inscripciones/<slug>`.
- **Signed out**: "Entre con su correo @unl.edu.ec para reservar su cupo." and "Entrar con Google" (→ F3 with `next=/inscripciones/<slug>`, back to the page).
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
| Session expired | "Inicie sesión para participar en el foro." (D5) |
| Account not allowed or suspended | "Su cuenta no puede participar en el foro." (D5) |
| Unexpected | "Ocurrió un error inesperado. Intente nuevamente." |

- A full or closed event shows its message instead of the button, before anyone tries.

### R3. A student finds UNL events from the forum

- **Entry**: `/foro/eventos` (signed out: "Su pase de estudiante" sign-in, `next=/foro/eventos`).
- **Sees**: open UNL events with live seats, or "No hay inscripciones abiertas." / "Cuando la directiva abra una, la verá aquí." with «Volver a los hilos». Open-form events are not listed (D8).
- `/foro/eventos/<slug>` → 308 to `/inscripciones/<slug>`.

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
- **Errors**: "Elija una forma de inscripción de la lista.", "Indique un número entero de 1 a 5000.", "Indique una fecha y hora válidas."
- Changing mode or lowering seats when people are already registered is not checked (D14).

### R9. Staff see, delete and export registrations

- **Actor**: editor and admin see; only admin deletes and exports. **Entry**: `/admin/registrations?evento=<id>` (`/admin/events/<id>/registrations` redirects there).
- **Sees**: upcoming and past events on the left, the registrants table on the right; empty: "Ningún evento pide inscripción todavía…".
- **Delete**: "Se borrarán los datos de X y se liberará su cupo." / "Esta acción no se puede deshacer." Audited without the name.
- **Export CSV**: spreadsheet-safe, audited with the count only. Editor → 403.
- **Empty states per event**: no registration, not published, UNL (copyable link). For open events the text points to the landing card and gives no link (D15).

### R10. The landing shows live seats

- `GET /api/public/events/seats`: public, no personal data; `closed` wins over `full`.

## Decisions

Taken with the product owner on 2026-11-09. The journeys above describe today's behaviour; where a row below applies, **the row is the specification** and wins over the journey text. Each journey is rewritten to the decided behaviour when its change lands, and the e2e tests check the decided behaviour.

| # | Journey | Decision | Expected behaviour |
| --- | --- | --- | --- |
| D1 | F10 | Tell a suspended student at once | Opening the forum with a suspended account shows a suspension notice ("escriba a la directiva de ASO") instead of the sign-in gate; the sign-in refusal for a suspended account is its own message, apart from domain or verification refusals |
| D2 | F8 | Build it now | A student edits their own thread and replies (shown as "editado"); «Me sirvió» is offered on the opening post too |
| D3 | F6 | Name the limit, in minutes | The throttle message says which limit was hit (per minute or per hour) and the wait in minutes |
| D4 | F5 | Visible placeholder | A hidden reply leaves "Respuesta oculta por la moderación" in its place, without its content; a hidden best answer shows the same placeholder |
| D5 | F6, F7, R2 | Keep text, return, own wording | An expired session keeps the typed text, the sign-in link returns to the same page, and registration screens use registration wording, never "participar en el foro" |
| D6 | F11 | Simple members list | `/admin/foro/miembros`: search, "suspendidos" filter, Reactivar (built; `e2e/forum-members-admin.spec.ts`) |
| D7 | R2, R4, R6 | Build cancellation now | A registered person can say they cannot attend and free the seat: a link in the confirmation and reminder emails, and on the event page for UNL students |
| D8 | F4, R3 | Forum and registrations are separate sections | The forum is only the forum (no registrations page or link). `/inscripciones` is a public list, no sign-in, of every event taking registrations (UNL and open), with its own top bar (no "Foro"). `/foro/eventos` redirects there. UNL students still prove their UNL Google account to reserve, but the screens say "Inscripciones", never "foro" |
| D9 | R4 | Only the latest link works | Registering again while pending makes the previous link answer "Este enlace no sirve" |
| D10 | R4 | Accept | "Ya hay una inscripción con ese correo…" stays |
| D11 | R5 | Clear message | The confirm page of an event no longer open says "Este evento ya no recibe inscripciones" instead of a 404 |
| D12 | R4, R6 | Reserve budget for confirmations | Reminders use at most ~70 % of the daily email cap; the rest stays for confirmation emails |
| D13 | R6 | No reminder | People who register less than a day before get no reminder (unchanged) |
| D14 | R8 | Warn and confirm | Changing the mode or lowering seats below the registered count asks "Este evento ya tiene N inscritos…" before saving |
| D15 | R9 | Copyable link | Open events show the copyable `/inscripciones/<slug>` link in the admin, like UNL |

Found while mapping coverage:

- **UNL mode with Google not configured.** No branch hides the registration (`isForumEnabled`, `src/infrastructure/forum/forum-config.ts:52`, is never called); the page offers "Entrar con Google", which ends at the `unavailable` error. `docs/DEPLOY.md:190` says the page does not offer it. Under D8 the page says the UNL registration is not available right now instead of offering a sign-in that cannot work.
- **F12 categories**: name required, ≤ 60; description optional, ≤ 200; blank slug derived from the name on create and kept on edit; invalid or taken slug → error on the slug field; new category goes last; delete refused while it has any thread, hidden ones too: "La categoría todavía tiene hilos y no se puede eliminar."
- **Display name**: set once from Google at sign-up and never updated; there is no way to change it.
