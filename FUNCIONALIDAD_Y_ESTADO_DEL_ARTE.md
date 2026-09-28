# Funcionalidad del Segundo Cerebro y Estado del Arte

> Documento de onboarding técnico. Explica qué hace el dashboard, cómo está construido, de qué depende y en qué estado se encuentra hoy (septiembre 2026).
> Audiencia: un programador que toma el proyecto por primera vez.

---

## 1. Qué es

**Segundo Cerebro** es el *Dashboard de Seguimiento Country* de Dropi para **Paraguay (PY)** y **Argentina (AR)**. Lo usa el área de Regional Commercial Operations para seguir, día a día y mes a mes:

- **Órdenes**: ingresadas, movilizadas, entregadas y devueltas, contra las metas mensuales.
- **Proveedores y dropshippers**: ranking, gestión y seguimiento.
- **Operación logística**: el estado de las guías, el comparativo contra el mes anterior y la proyección del cierre.
- **Finanzas** por país, **CRM** comercial, **KPIs y OKRs**.

Producción: **https://segundo-cerebro-sigma.vercel.app**

---

## 2. Stack

| Capa | Tecnología |
|---|---|
| Framework | **Next.js 16.2.2** (App Router, `middleware.ts`) |
| UI | React 19.2.4 + Tailwind CSS 4 (`@tailwindcss/postcss`), tema claro/oscuro propio (`ThemeProvider`) |
| Lenguaje | TypeScript 5 |
| Base de datos | **Supabase** (Postgres), accedido **solo desde el servidor** con la service role key |
| Autenticación | Propia: JWT HS256 (`jose`) en la cookie `sc-auth-token`, contraseñas hasheadas con `bcryptjs` |
| Hosting / CI | **Vercel**: deploy automático en cada push a `main` |
| Repositorio | GitHub: `Razi8907/segundo-cerebro` |
| Runtime local | Node.js 20.x, npm |

> ⚠️ **Next.js 16 trae cambios que rompen compatibilidad.** Antes de tocar APIs de Next, lee la documentación incluida en `node_modules/next/dist/docs/` (ver `AGENTS.md`).

### Dependencias

**Runtime**

| Paquete | Uso |
|---|---|
| `next`, `react`, `react-dom` | Framework |
| `@supabase/supabase-js` | Cliente de Postgres/Supabase (`app/lib/supabase.ts`) |
| `jose` | Firma y verificación del JWT (`app/lib/auth.ts`, `middleware.ts`) |
| `bcryptjs` | Hash de contraseñas de los usuarios |
| `recharts` | Todos los gráficos |
| `xlsx` (SheetJS) | Parseo de los Excel exportados de Dropi (en el navegador y en el servidor) |
| `html-to-image` | Botón para descargar gráficos como imagen (`ChartDownloadBtn`) |

**Desarrollo:** `typescript`, `eslint` + `eslint-config-next`, `tailwindcss`, `@types/*`.

**Fuera de la app (scripts locales):** Python 3 con `pandas` y `numpy` (`scripts/process_argentina.py`) y bash (`scripts/upload-dropi.sh`).

---

## 3. Cómo levantarlo

```bash
git clone https://github.com/Razi8907/segundo-cerebro.git
cd segundo-cerebro
npm install
# crear .env.local (ver abajo)
npm run dev          # http://localhost:3000
npm run build        # compilación de producción (tiene que pasar sin errores antes de cada push)
npm run lint
```

### Variables de entorno (`.env.local`, NO se commitea)

| Variable | Qué es | Dónde se obtiene |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | Supabase → Settings → API (proyecto `ucsgohhwbingslzfrhjy`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anon/publishable | Ídem |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service role (acceso total, solo servidor) | Ídem |
| `JWT_SECRET` | Secreto para firmar las sesiones | Pedirlo al owner; debe coincidir con el de Vercel |
| `DATA_UPLOAD_SECRET` | Token de los endpoints de carga automática | Pedirlo al owner; debe coincidir con el de Vercel |

Las mismas 5 variables están configuradas en Vercel → Settings → Environment Variables.

---

## 4. Arquitectura

```
Navegador (componentes cliente "use client")
   │  fetch /api/...
   ▼
middleware.ts ── verifica el JWT de la cookie, el rol admin para /admin y la franja horaria de acceso
   │
   ▼
app/api/**/route.ts (route handlers, runtime Node)
   │  getSupabase() → service role key
   ▼
Supabase Postgres (tablas + funciones RPC)
```

- **Todo el acceso a datos pasa por las rutas `/api`**. El navegador nunca habla directo con Supabase.
- `app/lib/supabase.ts` crea un cliente nuevo en cada llamada, usando la service role key.
- `app/lib/useDashboardData.ts` usa los JSON estáticos de `data/dashboard_data*.json` como *fallback* mientras carga el snapshot real.

### Autenticación y permisos
- Login: `POST /api/auth/login` valida el usuario contra la tabla `users` (bcrypt) y firma un JWT que dura **8 h**.
- El payload del JWT incluye: `role` (`admin` o no), `can_download`, `access_comercial`, `access_operaciones`, `access_finanzas`, `access_start_hour` y `access_end_hour`.
- `middleware.ts`:
  - Si no hay sesión: las páginas redirigen a `/login` y las rutas `/api` devuelven **401 JSON** (no hay redirect, para evitar el 405 en los POST).
  - `/admin` exige `role === "admin"`.
  - Si la hora actual (zona **America/Asuncion**) está fuera de la franja del usuario, las páginas devuelven 403 o hacen logout.
  - Rutas públicas: `/login`, `/api/auth/*`, `/api/data/upload` y `/api/data/upload-xlsx`. Estas dos últimas se protegen con `DATA_UPLOAD_SECRET`.
- `/admin` es el ABM de usuarios y permisos (`/api/admin/users`).

### Estructura de carpetas

```
app/
  page.tsx               Home: elegir país
  login/                 Pantalla de login
  admin/                 Gestión de usuarios (solo admin)
  paraguay/page.tsx      Dashboard PY (pestañas por sector)
  argentina/page.tsx     Dashboard AR (misma estructura)
  components/            ~50 componentes de UI (uno por módulo)
  lib/                   auth, supabase, parsers, builders y hooks
  api/                   Route handlers (auth, data/*, finanzas, admin)
  actions/               Server actions
  types.ts
data/                    JSON de fallback del dashboard
scripts/                 Automatización local (subida de datos de Dropi)
supabase_*.sql           Esquema, funciones y políticas de seguridad (se aplican a mano)
middleware.ts
```

---

## 5. Funcionalidad por módulo

Cada página de país (`/paraguay` y `/argentina`) tiene un **selector de mes** (abril a septiembre 2026; hay una vista Q2) y **pestañas por sector**. Cada pestaña se muestra solo si el usuario tiene el permiso correspondiente.

### 📊 Comercial (`access_comercial`)
| Sub-pestaña | Componentes | Qué muestra |
|---|---|---|
| General | `KPICards`, `TrendChart`, `DevolucionesChart`, `ProjectionChart`, `EfficiencyChart`, `ProveedoresRanking`, `ProveedoresTable`, `SellersTable`, `ProductsAnalysis`, `OperationalUpload`, `StrategicSimulator`, `ProductGoalPlanner` | KPIs del mes contra la meta, tendencias, proyección, rankings. Aquí se **sube el Excel de Dropi** |
| Acciones Urgentes | `AccionesUrgentes`, `DailyTracker` | Seguimiento diario y simulador de proyección (también muestra el mes anterior hasta el día 15) |
| Proveedores | `ProveedoresPanel` → órdenes en poder del proveedor, guías no despachadas, Stock Top 50 | Seguimiento en vivo por proveedor, con alertas de cobertura de stock |
| Análisis y Recomendaciones | `AnalisisRecomendaciones` | Diagnóstico automático |
| Mínimo Diario / Semanal / Mensual | `MinimoDiario`, `MinimoSemanal`, `MinimoMensual` | Cuánto hay que hacer por período para llegar a la meta |
| Dropshippers | `OpsBreakdown`, `DropshipperManager`, `GestionDropshippers` | Gestión por dropshipper (Diario, Proyección Mensual, Mensual cerrado, notas) |
| CRM | `CRMCentroGestion` | Registro de interacciones comerciales |

### 🎯 Estrategia Usuarios
`EstrategiaUsuarios` y `UsuariosRegistrados`: cohortes de usuarios registrados (`usuarios-cohort-builder.ts`, `estrategia-builder.ts`).

### 🏭 Operaciones (`access_operaciones`)
`OperacionesPanel`:
- **Dashboard operativo** (`OperationsDashboard`): estado de las guías a partir de la tabla `operations_data`.
- **Comparativo + Proyección** (`ComparativoProyeccion`): compara el mes actual con el acumulado del mes anterior al mismo día. Clasifica las guías en A/B/C (se valida que Total = A+B+C) y proyecta la movilización por maduración.
  - Las *ingresadas* salen de `daily_tracking` (Seguimiento Diario), no del archivo de operaciones.
  - Regla PY: los estados terminales son ENTREGADO y DEVOLUCIÓN; el resto de lo movilizado cuenta como "en proceso".

### 💰 Finanzas (`access_finanzas`)
`FinanzasDashboard` (PY, con variantes Q1 y H1), `FinanzasDashboardAR` y `FinanzasEditor`: P&L y punto de equilibrio. Los datos de AR están en `ar_finanzas_data` (`/api/finanzas/ar`).

### 📋 Seg. Comercial y 🎯 KPIs & OKRs
`SeguimientoComercial` (tabla `seguimiento_comercial`) y `KpisOkrDashboard` (tabla `kpis_okr`).

---

## 6. Datos: cómo entran y dónde viven

### Tablas principales (Supabase)
| Tabla / RPC | Contenido |
|---|---|
| `dashboard_snapshots` | Snapshot JSON del dashboard comercial por país. Lo envía Power BI vía `POST /api/data/upload` |
| `operational_snapshots` | Agregados del Excel operativo de Dropi (se sube desde `OperationalUpload` o `/api/data/upload-xlsx`) |
| `operations_data` | Detalle guía por guía, **acumulado por snapshot** (`country`, `mes`, `fecha_carga`). Unos **7,7 M de filas** |
| `daily_tracking` | Seguimiento diario de ingresadas y movilizadas (se puede borrar un día puntual) |
| `uploads` | Historial de cargas |
| `users` | Usuarios, roles y permisos de la app |
| `crm_interacciones`, `seguimiento_comercial`, `kpis_okr`, `dropshipper_gestion` | Módulos comerciales |
| `proveedor_ordenes_seguimiento`, `proveedor_seguimiento_meta`, `product_stock`, `producto_stock` | Proveedores y stock |
| `resumen_operacional` | Resumen persistido (`app/actions/persistResumenOperacional.ts`) |
| `ar_finanzas_data` | Finanzas de Argentina |
| RPC `get_ops_daily`, `get_ops_mov_live`, `get_ops_clasif`, `ops_upload_history` | Agregaciones de operaciones calculadas en Postgres |

El SQL de todo esto está en los archivos `supabase_*.sql` de la raíz, incluidas las fases de seguridad (`security_phase1_test`, `security_phase2_lockdown`, `security_rollback`). **No hay sistema de migraciones**: los scripts se corren a mano en el SQL Editor de Supabase.

### Flujos de ingesta
1. **Power BI → `/api/data/upload`**: JSON con `{country, data, secret}`, que se guarda en `dashboard_snapshots`.
2. **Excel de Dropi → Operaciones**: el usuario sube el `.xlsx` en `OperationalUpload`. El navegador lo parsea con `xlsx` (`app/lib/operational-parse.ts`) y lo envía en **lotes pequeños con reintentos**; si hay timeout, parte el lote de forma adaptativa.
3. **Automatización local (Mac del owner)**: `scripts/upload-dropi.sh` corre con `launchd` todos los días a las 9:30. Toma los Excel que Cowork descarga de Dropi y los envía por POST a `/api/data/upload-xlsx` con `Authorization: Bearer $DATA_UPLOAD_SECRET`.
4. **Uploads de proveedores y usuarios**: se piden URLs firmadas (`.../upload-url`) y se sube el archivo a Supabase Storage.

---

## 7. Estado actual (septiembre 2026)

**Funcionando en producción:** los dashboards de PY y AR con todos los módulos de arriba, septiembre como mes meta, el comparativo con proyección, el panel de proveedores y la carga resistente a timeouts.

**Trabajo reciente (últimos commits):**
- La carga de operaciones ya aguanta statement timeouts: lotes pequeños, reintentos y división automática.
- Botón "Borrar día" en el seguimiento diario; las lecturas usan `no-store` para traer siempre el dato fresco.
- `KPICards` es defensivo y hay un `ErrorBoundary` por sección, para que ninguna pantalla quede en blanco.
- El estatus de las guías se detecta por el **contenido** de la columna (el export de Dropi cambia de formato).

### Problemas conocidos y deuda técnica
1. **Volumen de `operations_data`**: cada carga agrega un snapshot nuevo. Los timeouts se resolvieron con el índice `(country, mes, fecha_carga)`. **Regla del negocio: nunca borrar histórico.**
2. **El export "CARGA DIARIA" de Dropi viene filtrado**: no trae CANCELADO, PENDIENTE ni PEND CONFIRMACIÓN, así que la clasificación A/B/C no cierra contra el total esperado hasta que se suba el export completo.
3. **Los meses están hardcodeados**: hay cadenas `isAbril … isSeptiembre` y campos `meta_*_<mes>` en `paraguay/page.tsx`, `argentina/page.tsx` y varios componentes. Para agregar un mes hay que editar varios archivos. Conviene refactorizarlo a una lista o configuración de meses.
4. **Componentes muy grandes**: `OperationsDashboard` (~2.500 líneas), `OperationalUpload` (~1.800), `AnalisisRecomendaciones` (~1.500), `DailyTracker` (~1.400). Mucho `any`.
5. **Sin tests automatizados** y **sin migraciones versionadas**.
6. **Vercel rechaza el deploy ante cualquier error de tipos.** Antes de cada push hay que correr `npx tsc --noEmit` o `npm run build`.
7. **Endpoints de mantenimiento puntuales** (`/api/data/fix-delete-day24`, `/api/data/fix-meta-ar`): se usaron una vez y se pueden eliminar.
8. **Secretos**: `auth.ts` y `middleware.ts` tienen un fallback `"dev-secret-change-in-production"` si falta `JWT_SECRET`. Los scripts locales no deben llevar el secreto escrito en el código: tienen que leerlo de una variable de entorno.
9. **Duplicados de iCloud**: si el repo vive dentro de iCloud aparecen copias `* 2` (`app 2/`, `node_modules 2/`, etc.). No son parte del proyecto: no se commitean y se deben ignorar o borrar. Lo recomendable es clonar fuera de iCloud.

### Convenciones de trabajo
- Rama `main`. Cada push despliega en Vercel.
- Commits con el formato `tipo(módulo): descripción` en español (`feat(proveedores): ...`, `fix(operaciones): ...`).
- Todo cambio tiene que valer para los dos países: los componentes reciben `country="py" | "ar"`.

---

## 8. Prompt para retomar el proyecto (IA / Antigravity)

```
Vas a trabajar en "Segundo Cerebro", el dashboard de seguimiento comercial, operativo y financiero
de Dropi para Paraguay y Argentina.

Repositorio: https://github.com/Razi8907/segundo-cerebro (rama main; cada push despliega
en Vercel: https://segundo-cerebro-sigma.vercel.app).

Antes de hacer cualquier cosa:
1. Lee FUNCIONALIDAD_Y_ESTADO_DEL_ARTE.md (arquitectura, módulos, tablas, estado y deuda técnica)
   y AGENTS.md.
2. Es Next.js 16.2.2 + React 19 + TypeScript + Tailwind 4. Next 16 tiene cambios que rompen
   compatibilidad: consulta node_modules/next/dist/docs/ antes de usar APIs de Next.
3. Los datos están en Supabase (proyecto ucsgohhwbingslzfrhjy) y se acceden SOLO desde las
   rutas app/api con la service role key (app/lib/supabase.ts). El login es propio
   (JWT con jose en la cookie sc-auth-token, validado en middleware.ts).
4. Crea .env.local con NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
   SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET y DATA_UPLOAD_SECRET (te los paso aparte).
   Después: npm install && npm run dev.

Reglas:
- Todo cambio tiene que funcionar para country "py" y "ar".
- Nunca borres datos históricos de Supabase (operations_data acumula snapshots a propósito).
- Antes de cada push corre `npx tsc --noEmit` y `npm run build`: Vercel falla ante
  cualquier error de tipos.
- Ignora las carpetas o archivos duplicados que terminan en " 2" (son copias de iCloud).
- Commits en español con el formato tipo(módulo): descripción.
- Si un cambio toca el esquema, escríbelo como un archivo supabase_<tema>.sql y avísame antes
  de aplicarlo.

Primera tarea: confirma que levantaste el proyecto en local, resume en 5 líneas lo que
entendiste de la arquitectura y espera mis instrucciones.
```
