<div align="center">

<img src="https://reportavnzla.com/reportavnzla.jpg" alt="ReportaVNZLA" width="120" height="120" style="border-radius:16px" />

# ReportaVNZLA — Venezuela Te Encuentra

**Plataforma humanitaria sin fines de lucro para el registro y seguimiento de personas desaparecidas, encontradas y fallecidas tras el terremoto de Venezuela 2026.**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet)](https://leafletjs.com/)
[![Neon PostgreSQL](https://img.shields.io/badge/Neon-PostgreSQL-0EA5E9?logo=neon&logoColor=white)](https://neon.tech/)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?logo=vercel)](https://vercel.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

**🌐 [Demo en vivo — reportavnzla.com](https://reportavnzla.com)**

[Reportar persona](https://reportavnzla.com) · [Ver mapa](https://reportavnzla.com) · [Contribuir](#-cómo-contribuir)

</div>

---

## 📖 Descripción / Description

### Español

**ReportaVNZLA** es una plataforma de código abierto, sin fines de lucro, creada para ayudar a las familias y rescatistas durante la emergencia del terremoto de Venezuela 2026. Permite:

- 🔍 **Buscar** personas reportadas por nombre, cédula o estado
- 📍 **Geolocalizar** en un mapa interactivo las últimas ubicaciones conocidas
- ➕ **Reportar** nuevas personas desaparecidas, encontradas o fallecidas
- 📊 **Consultar estadísticas** en tiempo real del registro
- 🔄 **Sincronizar** datos con fuentes externas como [venezuelatebusca.com](https://venezuelatebusca.com)

Todos los datos son públicos y abiertos para maximizar la utilidad durante la emergencia.

### English

**ReportaVNZLA** is an open-source, non-profit humanitarian platform created to help families and rescue teams during the Venezuela 2026 earthquake emergency. It enables:

- 🔍 **Search** for reported persons by name, ID number, or status
- 📍 **Geolocate** last known locations on an interactive map
- ➕ **Report** new missing, found, or deceased persons
- 📊 **View real-time statistics** of the registry
- 🔄 **Synchronize** data from external sources like [venezuelatebusca.com](https://venezuelatebusca.com)

All data is public and open to maximize its usefulness during the emergency.

---

## ✨ Características / Features

| Función | Descripción |
|---------|-------------|
| 🗺️ **Mapa interactivo** | Visualización en tiempo real con marcadores por estado (buscado, encontrado, fallecido) usando Leaflet |
| 🔎 **Búsqueda avanzada** | Filtro por nombre, apellido, cédula, estado y paginación |
| 📝 **Reporte ciudadano** | Formulario para registrar personas desaparecidas con datos del reportante |
| 📸 **Carga de medios** | Subida de fotos y videos adjuntos por persona (Vercel Blob) |
| 📊 **Estadísticas en vivo** | Conteo total, por estado: buscados, encontrados, fallecidos |
| 🔄 **Sincronización VTB** | Script de sincronización con [venezuelatebusca.com](https://venezuelatebusca.com) |
| 📱 **Responsive** | Diseño adaptado para móviles, tablets y escritorio |
| 🌙 **UI clara** | Interfaz optimizada para uso urgente con colores por severidad |
| 🔓 **Datos abiertos** | API REST pública para consumo de terceros |
| 🧪 **Validación** | Schemas Zod para validación de entrada en frontend y backend |

---

## 🛠️ Stack Tecnológico / Tech Stack

| Área | Tecnología |
|------|-----------|
| **Framework** | [Next.js 14](https://nextjs.org/) (App Router, Server Components) |
| **Lenguaje** | [TypeScript 5.4](https://www.typescriptlang.org/) |
| **Frontend** | [React 18](https://react.dev/), [Tailwind CSS 3.4](https://tailwindcss.com/) |
| **Mapas** | [Leaflet 1.9](https://leafletjs.com/) + [react-leaflet 4.2](https://react-leaflet.js.org/) |
| **Base de datos** | [Neon PostgreSQL](https://neon.tech/) (Serverless) |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team/) |
| **Validación** | [Zod](https://zod.dev/) |
| **Storage** | [Vercel Blob](https://vercel.com/docs/storage) |
| **Scraping** | [Cheerio](https://cheerio.js.org/) |
| **Despliegue** | [Vercel](https://vercel.com/) |

---

## 📁 Estructura del Proyecto / Project Structure

```
reportavnzla/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Layout raíz (metadata, SEO, Leaflet CSS)
│   │   ├── page.tsx                # Página principal (Server Component)
│   │   ├── HomeClient.tsx          # Componente cliente principal
│   │   ├── globals.css             # Estilos globales + Tailwind
│   │   └── api/
│   │       ├── personas/
│   │       │   ├── route.ts        # GET (listar) / POST (crear) / PATCH (actualizar)
│   │       │   └── [id]/
│   │       │       └── route.ts    # GET por ID
│   │       ├── stats/
│   │       │   └── route.ts        # GET estadísticas
│   │       └── medios/
│   │           └── route.ts        # POST subir fotos/videos
│   ├── components/
│   │   ├── Map.tsx                 # Mapa interactivo Leaflet con marcadores
│   │   ├── PersonCard.tsx          # Tarjeta de persona en el listado
│   │   ├── PersonDetail.tsx        # Vista detallada de persona
│   │   ├── AddPersonModal.tsx      # Modal para reportar nueva persona
│   │   ├── SearchBar.tsx           # Barra de búsqueda y filtros
│   │   └── StatsBar.tsx            # Barra de estadísticas en vivo
│   ├── db/
│   │   ├── schema.ts               # Esquema Drizzle (5 tablas)
│   │   └── index.ts                # Conexión Neon + Drizzle
│   └── lib/
│       ├── validators.ts           # Schemas Zod (persona, aviso, medio, búsqueda)
│       ├── blob.ts                 # Utilidades para Vercel Blob
│       └── utils.ts                # Utilidades generales (fechas, formatos)
├── scripts/
│   ├── sync-vtb.ts                 # Sincronización con venezuelatebusca.com
│   ├── debug-db.js                 # Debug de conexión a base de datos
│   └── debug-drizzle.js            # Debug de queries Drizzle
├── drizzle/                        # Migraciones generadas por Drizzle Kit
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── postcss.config.js
```

---

## 📡 API / Endpoints

La API REST es pública y no requiere autenticación.

### `GET /api/personas`

Listar personas con paginación y filtros.

**Parámetros de consulta:**

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `q` | `string` | `""` | Búsqueda por nombre, apellido o cédula |
| `estado` | `string` | `""` | Filtro: `buscado`, `encontrado`, `fallecido` |
| `page` | `number` | `0` | Página (base 0) |
| `limit` | `number` | `24` | Resultados por página (máx. 100) |

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "nombre": "María",
      "apellido": "González",
      "cedula": "V-12345678",
      "edad": 32,
      "genero": "femenino",
      "ultimaUbicacion": "Caracas, Los Teques",
      "descripcion": "Última vez vista en...",
      "fotoUrl": "https://...",
      "estado": "buscado",
      "lat": 10.49,
      "lng": -66.88,
      "fechaEncontrado": null,
      "notas": null,
      "reportadoPorNombre": "Juan González",
      "reportadoPorTelefono": "+58 412-1234567",
      "reportadoPorEmail": "juan@email.com",
      "createdAt": "2026-06-20T14:30:00Z",
      "updatedAt": "2026-06-20T14:30:00Z"
    }
  ],
  "totalCount": 1523,
  "page": 0,
  "totalPages": 64
}
```

---

### `POST /api/personas`

Crear un nuevo reporte de persona.

**Body (JSON):**
```json
{
  "nombre": "María",
  "apellido": "González",
  "cedula": "V-12345678",
  "edad": 32,
  "genero": "femenino",
  "ultimaUbicacion": "Caracas, Los Teques",
  "descripcion": "Última vez vista en la zona de Los Teques...",
  "estado": "buscado",
  "lat": 10.49,
  "lng": -66.88,
  "reportadoPorNombre": "Juan González",
  "reportadoPorTelefono": "+58 412-1234567",
  "reportadoPorEmail": "juan@email.com"
}
```

**Campos requeridos:** `nombre`, `apellido`, `reportadoPorNombre`

**Response (201):** Retorna el registro creado completo con `id`.

---

### `PATCH /api/personas`

Actualizar estado o notas de una persona existente.

**Body (JSON):**
```json
{
  "id": "uuid-de-la-persona",
  "estado": "encontrado",
  "notas": "Encontrada en refugio de Los Teques",
  "fechaEncontrado": "2026-06-22T10:00:00Z"
}
```

**Response (200):** Retorna el registro actualizado.

---

### `GET /api/personas/[id]`

Obtener detalle de una persona por su UUID.

**Response (200):** Retorna el objeto persona completo.
**Response (404):** `{ "error": "No encontrado" }`

---

### `GET /api/stats`

Estadísticas globales del registro.

**Response (200):**
```json
{
  "total": 1523,
  "buscados": 980,
  "encontrados": 489,
  "fallecidos": 54
}
```

---

### `POST /api/medios`

Subir foto o video adjunto a una persona.

**Content-Type:** `multipart/form-data`

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `personaId` | `string` (UUID) | ✅ | ID de la persona |
| `tipo` | `string` | ❌ | `foto` o `video` (default: `foto`) |
| `descripcion` | `string` | ❌ | Descripción del medio |
| `file` | `File` | ✅ | Archivo a subir |

**Response (201):** Retorna el registro de medio con URL pública.

---

## 🔧 Variables de Entorno / Environment Variables

Crear un archivo `.env.local` en la raíz del proyecto:

```env
# ── Base de datos Neon PostgreSQL ─────────────────────────
DATABASE_URL=postgresql://user:password@ep-xxxx.region.aws.neon.tech/dbname?sslmode=require

# ── Vercel Blob (storage de fotos/videos) ────────────────
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxx

# ── Sincronización con venezuelatebusca.com (opcional) ────
VTB_SUPABASE_URL=https://xxx.supabase.co
VTB_SUPABASE_KEY=eyJhbGciOiJIUzI1NiIs...

# ── Scraping de noticias (opcional) ──────────────────────
NEWS_SCRAPER_API_KEY=
```

> ⚠️ **Importante:** Nunca commitear `.env.local`. El archivo `.env.local.example` puede servir como referencia.

---

## 🚀 Instalación y Desarrollo / Getting Started

### Prerrequisitos

- [Node.js](https://nodejs.org/) 18+
- [npm](https://www.npmjs.com/) o [pnpm](https://pnpm.io/) o [yarn](https://yarnpkg.com/)
- Una cuenta en [Neon](https://neon.tech/) para la base de datos
- Una cuenta en [Vercel](https://vercel.com/) para despliegue (opcional para dev)

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/bitupx00/reportavnzla.git
cd reportavnzla

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.local.example .env.local
# Editar .env.local con tus valores reales

# Generar migraciones de Drizzle
npm run db:generate

# Aplicar migraciones a la base de datos
npm run db:push

# (Opcional) Abrir Drizzle Studio para explorar la DB
npm run db:studio
```

### Desarrollo local

```bash
npm run dev
# Abre http://localhost:3000
```

### Build de producción

```bash
npm run build
npm start
```

---

## 🌐 Despliegue / Deployment

### Vercel (recomendado)

1. Conectar el repositorio en [vercel.com/new](https://vercel.com/new)
2. Configurar las variables de entorno en **Settings → Environment Variables**
3. Desplegar automáticamente con cada push a `master`

### Manual

```bash
npm run build
# Los archivos estáticos quedarán en .next/
# Usar un servidor Node.js compatible o exportar como static
```

---

## 📊 Esquema de Base de Datos / Database Schema

| Tabla | Descripción |
|-------|-------------|
| `personas` | Personas reportadas (buscado, encontrado, fallecido) |
| `avisos` | Avisos/testimonios asociados a una persona |
| `medios` | Fotos y videos adjuntos por persona |
| `zonas_afectadas` | Zonas geográficas afectadas con severidad |
| `fuentes_datos` | Registro de fuentes de datos externas (VTB, scraping, IA, etc.) |

**Enums:** `estado_persona`, `medio_tipo`, `severidad_zona`, `fuente_tipo`

---

## 📡 Fuentes de Datos / Data Sources

| Fuente | URL | Tipo | Descripción |
|--------|-----|------|-------------|
| venezuelatebusca.com | [venezuelatebusca.com](https://venezuelatebusca.com) | Supabase API | Sincronización bidireccional de registros de desaparecidos |
| Reportes ciudadanos | reportavnzla.com | Manual | Entrada directa por el formulario web |
| Noticias | Varios medios | Scraping (Cheerio) | Extracción automática de información de medios |
| Inteligencia artificial | — | IA | Análisis automático de noticias y cruces de datos |

---

## 🤝 Cómo Contribuir / How to Contribute

¡Gracias por querer ayudar! Esta es una iniciativa comunitaria y toda colaboración es bienvenida.

### Pasos para contribuir

1. **Fork** el repositorio
2. Crea una rama feature: `git checkout -b feature/nombre-de-tu-feature`
3. Haz tus cambios: `git commit -m 'feat: describe tu cambio'`
4. Sube tu rama: `git push origin feature/nombre-de-tu-feature`
5. Abre un **Pull Request** describiendo tus cambios

### Convenciones de commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

| Prefijo | Uso |
|---------|-----|
| `feat:` | Nueva funcionalidad |
| `fix:` | Corrección de bug |
| `docs:` | Cambios en documentación |
| `style:` | Formato, espacios, sin cambios de lógica |
| `refactor:` | Refactorización de código |
| `chore:` | Tareas de mantenimiento |

### Áreas de contribución prioritarias

- 🌍 **Internacionalización:** Traducciones a idiomas indígenas venezolanos
- ♿ **Accesibilidad:** Mejoras WCAG para personas con discapacidad
- 📱 **PWA:** Soporte offline y notificaciones push
- 🔔 **Alertas:** Sistema de alertas por zona
- 🧠 **IA/ML:** Detección automática de duplicados, matching facial
- 📊 **Dashboards:** Panel de administración para rescatistas
- 🏗️ **Infraestructura:** Scripts de backup, monitoreo

---

## 🆘 Recursos de Emergencia / Emergency Resources

| Recurso | Enlace / Teléfono |
|---------|-------------------|
| 🌐 **ReportaVNZLA** | [reportavnzla.com](https://reportavnzla.com) |
| 🔍 **Venezuela Te Busca** | [venezuelatebusca.com](https://venezuelatebusca.com) |
| 🏛️ **Protección Civil Venezuela** | [protectorcivil.gob.ve](http://www.proteccioncivil.gob.ve/) |
| 📞 **Emergencias 171** | **171** |
| 🚑 **Ambulancia 911** | **911** |
| 🔥 **Bomberos** | **171** |
| 🏥 **Cruz Roja Venezolana** | [cruzroja.org.ve](https://www.cruzroja.org.ve/) |
| 📱 **UCV Emergencias** | +58 212-605-3000 |

> ⚠️ **Nota:** En caso de emergencia real, llama primero al **171** o **911**. Esta plataforma es un complemento de información, no reemplaza los servicios oficiales de emergencia.

---

## ⚖️ Licencia / License

MIT License — Ver archivo [LICENSE](./LICENSE).

> **Nota importante:** Este proyecto es **sin fines de lucro** y de carácter humanitario. Los datos recopilados son información pública destinada exclusivamente a facilitar la búsqueda y localización de personas durante la emergencia del terremoto. No se recopila ni procesa información con fines comerciales.

---

## 📬 Contacto / Contact

| Canal | Enlace |
|-------|--------|
| 🐙 **GitHub** | [github.com/bitupx00/reportavnzla](https://github.com/bitupx00/reportavnzla) |
| 🌐 **Sitio web** | [reportavnzla.com](https://reportavnzla.com) |
| 📧 **Email** | contacto@reportavnzla.com |

---

<div align="center">

**Hecho con ❤️ por la comunidad venezolana y para la comunidad venezolana.**

*Si esta plataforma te ayudó a encontrar a un ser querido, cuéntanos en GitHub Issues.*

---

<b>ReportaVNZLA — Venezuela Te Encuentra 🇻🇪</b>

</div>
