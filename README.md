# 🇻🇪 ReportaVNZLA — Venezuela Te Encuentra

**Plataforma humanitaria sin fines de lucro para el seguimiento de personas afectadas por el terremoto de Venezuela 2026.**

> 🌐 **reportavnzla.com**

## 🎯 Objetivo

Registro centralizado y en tiempo real de personas **perdidas**, **rescatadas** y **fallecidas** tras el terremoto. Mapa interactivo de zonas afectadas. Datos abiertos para facilitar labores de rescate y reencuentro familiar.

**Esta es una iniciativa sin fines de lucro.** Todos los datos son públicos y gratuitos. No cobramos, no vendemos, no monetizamos.

## ✨ Funcionalidades

- 🗺️ **Mapa interactivo** con ubicaciones de personas reportadas y zonas afectadas
- 📋 **Registro de personas** — perdidas, rescatadas y fallecidas (con C.I.)
- 🔍 **Búsqueda avanzada** por nombre, cédula, ubicación, estado
- 📸 **Multimedia** — usuarios pueden añadir fotos y videos
- 🤖 **IA integrada** (GLM-5 Turbo) — análisis de noticias, enriquecimiento automático de datos
- 📊 **Dashboard** — estadísticas en tiempo real
- 🔄 **Sincronización** — absorbe datos de venezuelatebusca.com y otras fuentes
- 📱 **Mobile-first** — optimizado para uso en emergencias
- 🔓 **Datos abiertos** — API pública para ONGs, rescatistas y periodistas

## 🏗️ Arquitectura

| Componente | Tecnología |
|---|---|
| Frontend | Next.js 14 + React + Tailwind CSS |
| Mapa | Leaflet + OpenStreetMap |
| Base de datos | PostgreSQL (Neon Serverless) |
| ORM | Drizzle ORM |
| Storage | Vercel Blob (fotos/videos) |
| IA | GLM-5 Turbo (análisis de noticias) |
| Deploy | Vercel |
| API | Next.js API Routes |

## 🚀 Setup

```bash
npm install
cp .env.local.example .env.local
# Editar .env.local con tus credenciales
npm run dev
```

## 📡 Fuentes de datos

- venezuelatebusca.com (Supabase → PostgreSQL)
- Otras plataformas de desaparecidos
- Reportes de noticias (análisis con IA)
- Reportes directos de ciudadanos

## 🤝 Contribuir

Proyecto de código abierto sin fines de lucro. Pull requests, reportes de datos y correcciones son bienvenidos.

## ⚖️ Legal

Los datos publicados son responsabilidad exclusiva de quien los envía. Esta plataforma no verifica la información ni se hace responsable por el uso que terceros hagan de ella.

## 📞 Emergencias

- **911** (Movistar) · **112** (Digitel) · **\*1** (Movilnet) · **171** (Cantv fijo)

---

*Iniciativa solidaria · Sin fines de lucro · Terremoto Venezuela 2026*
