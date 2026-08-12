# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Seguridad del login y sincronización del esquema de BD (CRÍTICO)

El login (Google y email/contraseña) y las sesiones dependen de consultas a la tabla `users`. Cualquier cambio al modelo de Prisma que se commitee/pushee sin aplicar su migración a la base de datos de producción rompe TODAS las consultas a esa tabla (Prisma `P2022`: "The column `users.X` does not exist"), lo que se traduce en `401` al hacer login y en el cierre de sesiones en los dispositivos (los handlers de 401 ejecutan `clearSession`). Render auto-despliega la API en cada push a `main`, así que el esquema debe estar sincronizado ANTES de desplegar.

Reglas obligatorias:
1. Nunca modifiques un modelo de Prisma sin crear su migración (carpeta en `prisma/migrations/`).
2. Antes de un push que cambie el esquema, aplica las migraciones pendientes a producción: `npx prisma migrate deploy --schema=prisma/schema.prisma` (la API ya lo hace automáticamente al arrancar vía `prestart:prod` → `scripts/apply-migrations.js`).
3. Verifica con `npx prisma migrate status --schema=prisma/schema.prisma` que no queden migraciones pendientes antes de desplegar.
4. Tras desplegar, confirma el login (Google y credenciales) y revisa que en los logs de Render NO aparezca `PrismaClientKnownRequestError` ni "column does not exist".
5. No asumas que un `401` en `/auth/google` es un fallo de Google: revisa el log real detrás del error (en el backend puede ser un crasheo de BD disfrazado).
