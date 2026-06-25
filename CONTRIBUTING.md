# 🤝 Guía para Contribuir — Contributing Guide

**Gracias por tu interés en ReportaVNZLA.** / **Thank you for your interest in ReportaVNZLA.**

ReportaVNZLA es una plataforma humanitaria sin fines de lucro creada para el seguimiento de personas afectadas por el terremoto de Venezuela 2026. Tu ayuda — ya sea código, datos, correcciones o ideas — puede salvar vidas y reunir familias.

---

ReportaVNZLA is a non-profit humanitarian platform built to track people affected by the Venezuela 2026 earthquake. Your help — whether code, data, corrections, or ideas — can save lives and reunite families.

---

## 📋 Tabla de Contenidos — Table of Contents

1. [Configuración Local — Local Setup](#-configuración-local--local-setup)
2. [Estructura del Proyecto — Project Structure](#-estructura-del-proyecto--project-structure)
3. [Estilo de Código — Code Style](#-estilo-de-código--code-style)
4. [Convenciones de Commits — Commit Conventions](#-convenciones-de-commits--commit-conventions)
5. [Flujo de Pull Requests — PR Workflow](#-flujo-de-pull-requests--pr-workflow)
6. [Plantillas de Issues — Issue Templates](#-plantillas-de-issues--issue-templates)
7. [Contribución de Datos — Data Contribution](#-contribución-de-datos--data-contribution)
8. [Guía Comunitaria — Community Guidelines](#-guía-comunitaria--community-guidelines)
9. [Contacto — Contact](#-contacto--contact)

---

## 🛠️ Configuración Local — Local Setup

### Requisitos — Prerequisites

- **Node.js** 18+
- **npm** 9+
- **Cuenta en Neon** (PostgreSQL serverless) — [neon.tech](https://neon.tech)
- **Git**

### Pasos — Steps

```bash
# 1. Clonar el repositorio
git clone https://github.com/<org>/reportavnzla.git
cd reportavnzla

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.local.example .env.local
```

Edita `.env.local` con tus credenciales:

```env
# PostgreSQL (Neon) — Obligatorio
DATABASE_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/reportavnzla?sslmode=require

# Vercel Blob (fotos/videos) — Opcional para desarrollo
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx

# IA - GLM-5 Turbo — Opcional para desarrollo
GLM_API_KEY=xxx
GLM_API_BASE=https://open.bigmodel.cn/api/paas/v4

# Sync con venezuelatebusca.com — Opcional
VTB_SUPABASE_URL=https://ihcnbvkwkiyxlkhuwapu.supabase.co
VTB_SUPABASE_KEY=eyJhbG...c3fQ.xxx

# Site
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SITE_NAME=ReportaVNZLA
```

```bash
# 4. Sincronizar el esquema de la base de datos con Drizzle
npm run db:push

# 5. Iniciar el servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

### Scripts Disponibles — Available Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` | Linting con ESLint (Next.js config) |
| `npm run db:push` | Sincronizar schema → DB (Drizzle) |
| `npm run db:generate` | Generar migraciones SQL |
| `npm run db:migrate` | Ejecutar migraciones pendientes |
| `npm run db:studio` | Drizzle Studio (visor visual de DB) |
| `npm run scrape:sync` | Sincronizar datos de fuentes externas |
| `npm run ai:analyze` | Analizar noticias con IA (GLM-5) |

---

## 📁 Estructura del Proyecto — Project Structure

```
reportavnzla/
├── src/
│   ├── app/                  # Next.js 14 App Router
│   │   ├── api/              # API Routes
│   │   │   ├── personas/     # CRUD de personas
│   │   │   ├── medios/       # Fotos y videos
│   │   │   └── stats/        # Estadísticas
│   │   ├── page.tsx          # Página principal
│   │   └── layout.tsx        # Layout global
│   ├── components/           # Componentes React reutilizables
│   └── db/
│       ├── schema.ts         # Esquema Drizzle ORM (tablas, enums)
│       └── index.ts          # Conexión a Neon PostgreSQL
├── scripts/
│   └── sync-vtb.ts           # Sincronización con venezuelatebusca.com
├── drizzle/                  # Migraciones generadas
├── drizzle.config.ts         # Configuración de Drizzle Kit
├── public/                   # Archivos estáticos
├── .env.local.example        # Plantilla de variables de entorno
├── tailwind.config.ts        # Configuración de Tailwind CSS
└── tsconfig.json             # TypeScript (strict mode)
```

---

## 🎨 Estilo de Código — Code Style

### TypeScript

- **Strict mode** habilitado (`"strict": true` en `tsconfig.json`).
- Usa el alias `@/*` para importaciones desde `src/`:

  ```typescript
  // ✅ Correcto
  import { personas } from '@/db/schema'
  import { MapView } from '@/components/MapView'

  // ❌ Evitar
  import { personas } from '../db/schema'
  ```

- Usa **Zod** para validación de datos en formularios y API routes.
- Tipado explícito en funciones públicas; infiere tipos internos cuando sea claro.

### React / Next.js

- Componentes funcionales con hooks. Sin clases.
- **App Router** (Next.js 14) — usa `app/`, no `pages/`.
- Server Components por defecto; marca `"use client"` solo cuando necesites interactividad del navegador (event handlers, useState, useEffect).
- Extrae componentes reutilizables a `src/components/`.
- Usa `clsx` + `tailwind-merge` para clases condicionales (o la utilidad `cn` si existe).

### Tailwind CSS

- Usa las clases de Tailwind; evita CSS inline o archivos CSS adicionales.
- Respeta el `tailwind.config.ts` existente — no agregues colores/espaciados custom sin consenso.
- Diseño **mobile-first** — la plataforma se usa en emergencias desde móviles.

### Naming

| Elemento | Convención |
|---|---|
| Archivos de componentes | `PascalCase.tsx` (ej: `MapView.tsx`) |
| Archivos de utilidades | `kebab-case.ts` (ej: `date-utils.ts`) |
| Directorios | `kebab-case` (ej: `api/`, `db/`) |
| Variables y funciones | `camelCase` |
| Constantes | `UPPER_SNAKE_CASE` |
| Tablas Drizzle | `camelCase` en código, `snake_case` en DB (mapeado automático) |

### Linting

Antes de enviar un PR, asegúrate de que el linting pase:

```bash
npm run lint
```

---

## ✍️ Convenciones de Commits — Commit Conventions

Usamos **Conventional Commits** ([conventionalcommits.org](https://www.conventionalcommits.org/)).

### Formato

```
<tipo>(<alcance>): <descripción>
```

### Tipos

| Tipo | Uso |
|---|---|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `docs` | Cambios en documentación |
| `style` | Formato, punto y coma, espaciado (sin cambio de lógica) |
| `refactor` | Refactorización sin cambio de funcionalidad |
| `perf` | Mejora de rendimiento |
| `test` | Tests nuevos o corregidos |
| `build` | Cambios en build o dependencias |
| `ci` | Cambios en configuración CI/CD |
| `chore` | Mantenimiento general |
| `data` | Agregar/modificar datos o fuentes de datos |

### Ejemplos

```
feat(mapa): agregar filtro por estado en el mapa interactivo
fix(api): corregir búsqueda por cédula con espacios
data(sync): agregar nueva fuente de datos:保护协会
docs(readme): actualizar instrucciones de setup
```

### Buena práctica — Best Practice

Commits pequeños y enfocados. Un commit = un cambio lógico. Escribe la descripción en **español o inglés** — lo que prefieras, pero sé consistente dentro de un PR.

---

## 🔀 Flujo de Pull Requests — PR Workflow

### 1. Fork y Branch

```bash
# Fork en GitHub, luego:
git clone https://github.com/<tu-usuario>/reportavnzla.git
cd reportavnzla
git checkout -b feat/nombre-descriptivo
```

### 2. Desarrolla y commitea

```bash
git add .
git commit -m "feat(descripcion): lo que hiciste"
```

### 3. Actualiza con main/master

```bash
git fetch origin
git rebase origin/master   # o merge, pero rebase mantiene el historial limpio
```

### 4. Push y abre PR

```bash
git push origin feat/nombre-descriptivo
```

Abre un Pull Request contra `master` desde el fork.

### 5. Checklist del PR

Antes de solicitar review, verifica:

- [ ] `npm run lint` pasa sin errores
- [ ] `npm run build` compila exitosamente
- [ ] Si cambia el schema de DB: `npm run db:push` funciona y la migración es correcta
- [ ] Si agrega funcionalidad nueva: la probaste localmente
- [ ] Si hay cambios en `.env.local.example`: documentaste las nuevas variables
- [ ] El PR describe claramente qué cambia y por qué
- [ ] No hay datos sensibles (tokens, contraseñas) en el código

### 6. Review y Merge

- Un maintainer revisará el PR.
- Puede haber solicitudes de cambios — responde con calma y claridad.
- Una vez aprobado, se mergeará a `master`.

---

## 🐛 Plantillas de Issues — Issue Templates

Cuando abras un issue, usa estas etiquetas para facilitar su organización:

### Bug Report

```markdown
## 🐛 Bug: <título breve>

**Qué pasa:** Describe el problema.
**Qué debería pasar:** Describe el comportamiento esperado.
**Pasos para reproducir:**
1. ...
2. ...
3. ...

**Capturas de pantalla:** (si aplica)
**Navegador/Dispositivo:** ...
**Prioridad:** 🔴 Alta / 🟡 Media / 🟢 Baja
```

### Feature Request

```markdown
## ✨ Feature: <título breve>

**Problema que resuelve:** ¿Por qué es útil?
**Propuesta:** Describe brevemente tu idea.
**Ejemplos de uso:** (si aplica)
**Prioridad:** 🔴 Alta / 🟡 Media / 🟢 Baja
```

### Data Issue / Reporte de Datos

```markdown
## 📊 Data: <título breve>

**Tipo:** Datos incorrectos / Datos faltantes / Nueva fuente
**Detalles:** Describe el problema con los datos o la fuente propuesta.
**Fuente:** URL o referencia de los datos correctos.
**Impacto:** Cuántos registros afecta.
```

### Labels Disponibles

| Label | Uso |
|---|---|
| `bug` | Error en el código |
| `enhancement` | Nueva funcionalidad |
| `data` | Issues relacionados con datos |
| `sync` | Problemas de sincronización con fuentes externas |
| `documentation` | Mejoras a la documentación |
| `accessibility` | Mejoras de accesibilidad |
| `mobile` | Problemas específicos de móvil |
| `urgent` | Necesita atención inmediata |
| `good first issue` | Bueno para contribuidores nuevos |
| `help wanted` | Se necesita ayuda |

---

## 📊 Contribución de Datos — Data Contribution

Los datos son el corazón de esta plataforma. Puedes contribuir de varias maneras:

### Agregar una Nueva Fuente de Datos

1. **Crea un script de sincronización** en `scripts/`:

   ```typescript
   // scripts/sync-nueva-fuente.ts
   /**
    * Sincronización con [Nombre de la Fuente]
    * Extrae registros y los inserta en nuestra DB
    * Uso: npx tsx scripts/sync-nueva-fuente.ts
    */

   async function fetchRecords() {
     // Implementa la lógica de extracción
   }

   async function sync() {
     console.log('🔄 Sincronizando con [Fuente]...')
     // ...
   }

   sync()
   ```

2. **Mapea al esquema de Drizzle** — usa los campos definidos en `src/db/schema.ts`:

   ```typescript
   import { personas } from '@/db/schema'
   // Campos obligatorios: nombre, apellido, estado
   // Campos opcionales: cedula, edad, genero, ultimaUbicacion, etc.
   ```

3. **Registra la fuente** insertando en la tabla `fuentesDatos` con el tipo apropiado:
   - `supabase` — Fuentes tipo Supabase
   - `scraping` — Extracción via web scraping
   - `manual` — Carga manual
   - `ia` — Procesamiento con inteligencia artificial
   - `api` — API REST o GraphQL

4. **Agrega las variables de entorno necesarias** a `.env.local.example`.

5. **Agrega el script** a `package.json`:

   ```json
   "sync:nueva-fuente": "tsx scripts/sync-nueva-fuente.ts"
   ```

### Reportar Datos Incorrectos

Si encuentras datos erróneos (nombres mal escritos, estados incorrectos, duplicados):

1. Abre un issue con la etiqueta `data`.
2. Incluye el ID del registro (si es visible) o los datos de la persona.
3. Describe cuál es la información correcta.
4. Un maintainer validará y corregirá.

### Directrices para Datos

- ⚠️ **Respeto a la privacidad:** No incluyas datos sensibles innecesarios (direcciones exactas, teléfonos privados).
- ✅ **Verificabilidad:** Prefiere fuentes oficiales o verificables.
- 🔄 **Deduplicación:** Antes de insertar, verifica que el registro no exista (usa `externalId` para fuentes externas).
- 📝 **Trazabilidad:** Registra la fuente de cada dato en `fuentesDatos` y referencia con `fuenteId`.

---

## 🤝 Guía Comunitaria — Community Guidelines

### Nuestros Valores — Our Values

Esta es una **plataforma humanitaria**. Por encima de cualquier tecnología, las personas son lo primero.

1. **🫂 Empatía** — Trata a todos con respeto y compasión. Las personas que usan esta plataforma pueden estar en situaciones de crisis.

2. **🌍 Inclusión** — Bienvenidos todos los backgrounds, idiomas y niveles de experiencia. Usamos español e inglés indistintamente.

3. **🎯 Enfoque humanitario** — Todo trabajo en este proyecto debe priorizar el beneficio a las personas afectadas. Si una discusión técnica se aleja de ese objetivo, redirigamos la conversación.

4. **🔍 Precisión** — Los datos pueden impactar vidas reales. Sé cuidadoso/a con los cambios que afecten datos de personas.

5. **🤲 Colaboración** — Ninguna contribución es demasiado pequeña. Un fix de typo vale tanto como una nueva funcionalidad.

### Comportamiento Esperado — Expected Behavior

- Ser respetuoso/a en issues, PRs y discusiones.
- Dar feedback constructivo.
- Aceptar feedback con apertura.
- Preguntar antes de asumir — si no estás seguro/a, pregunta.
- Priorizar accesibilidad y usabilidad (la plataforma se usa en emergencias).

### Comportamiento Inaceptable — Unacceptable Behavior

- Acoso, insultos o ataques personales.
- Discriminación de cualquier tipo.
- Divulgación de datos personales de personas reportadas fuera de la plataforma.
- Uso de la plataforma para fines políticos, comerciales o de desinformación.
- Spam o promoción no relacionada.

Si observas un comportamiento inaceptable, contacta a los maintainers directamente (ver sección de contacto).

### Código de Conducta

Este proyecto sigue el [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Al participar, aceptas sus términos.

---

## 📞 Contacto — Contact

- **🌐 Sitio web:** [reportavnzla.com](https://reportavnzla.com)
- **📧 Email:** contact/reportavnzla (ver repositorio para dirección actualizada)
- **💬 Issues:** Abre un issue en este repositorio para cualquier pregunta.
- **⚠️ Emergencias:** Esta plataforma no es un servicio de emergencia. Si estás en una situación de emergencia:
  - **911** (Movistar)
  - **112** (Digitel)
  - **\*1** (Movilnet)
  - **171** (Cantv fijo)

---

> *Iniciativa solidaria · Sin fines de lucro · Terremoto Venezuela 2026*
>
> *Solidarity initiative · Non-profit · Venezuela Earthquake 2026*

**¡Gracias por contribuir! Cada línea de código, cada dato corregido y cada idea compartida cuenta.** 💛🇻🇪

**Thank you for contributing! Every line of code, every corrected data point, and every shared idea counts.** 💛🇻🇪
