# Roadmap — Dreamart Cash Control

Última actualización: 2026-08-25

## Estado actual

Herramienta interna en producción para Dreamart Photography Group (control de flujo de caja, CXC/CXP, posición bancaria multi-país/multi-moneda, calendario de pagos, forecast de liquidez y un agente de IA tipo "CFO" con datos reales). Usada hoy por 3 personas (cfo, contadora, viewer).

Trabajo hecho recientemente (agosto 2026):
- Autenticación real en todos los endpoints (antes no existía ninguna, a pesar de tener login). Roles: `viewer` (solo lectura) vs editor (`cfo`/`contadora`).
- Unificada la conversión de moneda (`backend/currency.py`) — antes varios endpoints no sabían convertir CRC/JMD/XCD y daban totales mal calculados en pagos, cobros y forecast.
- Reporte de Excel de "Others" separado de CXC/CXP (antes un solo botón mezclaba las tres cosas).
- Secretos (password de Postgres, JWT secret, password de Gmail) movidos de código hardcodeado a `backend/.env` (gitignored). La API key de Anthropic sigue expuesta en dos lugares — ver pendientes.
- `git init` + primer commit + repo remoto: **https://github.com/tyrion-Dreamart/Cash.git** (rama `main`).

## Pendiente inmediato — seguridad (no bloquea nada, pero no se debe posponer mucho)

- **Rotar** la API key de Anthropic (expuesta en texto plano en el servidor), el password de la app de Gmail, el password de Postgres, y el `JWT_SECRET` (además es muy corto — PyJWT ya advierte que está por debajo del mínimo recomendado de 32 bytes).
- Sacar las contraseñas reales en texto plano de `backend/create_users.py` y `backend/create_viewer.py` (estos archivos están excluidos de git, pero siguen en el disco del servidor).
- Cerrar CORS (`allow_origins=["*"]` hoy).
- Bugs puntuales conocidos, no urgentes: `contacts_router.update_contact` devuelve 500 en vez de 404 si el contacto no existe; matemática de dinero con `float` sin redondeo a centavos en varios lugares; `receivables.tsx` solo permite registrar un cobro parcial cuando el status ya es "cobrado" (al revés que payables/others).

## Visión de producto (conversación del 2026-08-25)

Meta declarada por el dueño (jair.lebrija@gmail.com / Jair): en **~3 meses**, publicar en App Store y Google Play con **suscripciones mensuales**, apuntando a **finanzas personales y dueños de negocio/PyMEs** en general — no solo Dreamart.

### Los 4 cambios estructurales grandes (en orden de prioridad recomendado)

1. **Multi-tenencia** — hoy ninguna tabla tiene dueño (`organization_id`/`user_id`); todo es una sola empresa. Es el cambio más importante y el más caro de posponer: cada feature nueva después de esto hay que rehacerla si se hace tarde. Incluye: columnas de tenant en cada tabla, flujo de registro/onboarding, invitar usuarios a una organización, reescribir roles.
2. **Des-Dreamart-ificar** — países fijos (México/Costa Rica/Jamaica/St. Lucia), terminología de "hotel", nombre "Dreamart" hardcodeado en reportes/correos → todo eso se vuelve configuración por cuenta, no código fijo.
3. **Rediseño mobile-first del frontend** — el frontend actual está pensado para escritorio (paddings fijos, tablas anchas). Necesario antes de empacar como app, no después.
4. **Empaquetado móvil** — con 3 meses, no se recomienda reescribir en nativo (React Native/Flutter) desde cero. Ruta realista: **Capacitor** envolviendo el mismo Next.js.

### Decisión de negocio pendiente (no técnica, pero bloquea el diseño de billing)

Cobrar la suscripción **dentro** de la app en iOS obliga a usar el sistema de compras in-app de Apple (se queda 15-30%), salvo que la app califique como "reader app" (no aplica aquí). La alternativa común es cobrar por Stripe desde la web y que la app móvil sea solo cliente — pero Apple revisa esto con lupa en apps financieras y puede rechazarla. Hay que decidir el enfoque de cobro **antes** de diseñar el flujo de suscripción, no después.

### Secuencia recomendada

1. Rotar secretos (rápido, ya identificado arriba)
2. Multi-tenencia (fundamental, bloqueante para todo lo demás)
3. Beta **web** generalizada + Stripe (validar que la gente paga, antes de pelear con Apple/Google)
4. Rediseño mobile-first
5. Empaquetado con Capacitor → App Store / Google Play
6. Resolver compliance de cobro in-app vs web-only con Apple/Google

## Deuda técnica conocida (no bloqueante, limpiar cuando haya tiempo)

- ~60 scripts `fix_*.py`/`debug*.py` de un solo uso en `backend/` (excluidos de git vía `.gitignore`, siguen en disco).
- Cero tests automatizados, sin CI.
- Ambiente único (no hay staging separado de producción).
- No verificado: si existen backups automáticos de Postgres.
