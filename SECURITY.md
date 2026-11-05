# Política de seguridad

## Cómo reportar una vulnerabilidad

No abra un issue público. Use el reporte privado de GitHub:

1. Pestaña **Security** de este repositorio.
2. **Report a vulnerability**.
3. Describa qué encontró, cómo reproducirlo y qué impacto tiene.

Solo la directiva y quien mantiene el proyecto ven el reporte. Respondemos en cuanto podamos; es un proyecto estudiantil voluntario, así que pedimos paciencia.

## Qué cuenta

- Credenciales, tokens o datos personales expuestos en el código, en el panel, en el foro o en la API pública (por ejemplo, el correo de un estudiante o de una persona inscrita en un evento).
- Formas de alterar el contenido publicado sin pasar por el panel de administración.
- Cualquier fallo del panel de administración (acceso con Google, roles y permisos, invitaciones, sesiones, el acceso de emergencia con contraseña, subida de imágenes).
- Cualquier fallo del foro de estudiantes: el acceso con la cuenta institucional, publicar o moderar sin permiso, o que una sesión del foro valga en el panel (o al revés).
- Cualquier fallo de las inscripciones a eventos: saltarse el control de cupos, la fecha límite o Turnstile, o leer, exportar o borrar inscripciones sin ser administrador.
- Códigos de vista previa o llamadas al cron de reconstrucción que funcionen sin el secreto.

## Qué no hacer

- No pruebe ataques contra el sitio en producción ni contra cuentas de otras personas.
- No acceda a datos que no son suyos más allá de lo necesario para demostrar el problema.
- No envíe inscripciones ni publicaciones de prueba en producción, ni intente agotar los cupos o los límites de uso.
