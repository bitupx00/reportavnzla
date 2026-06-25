# ReportaVNZLA — Auditoría técnica y plan de mejoras

> Revisión de https://reportavnzla.com/ (Next.js 14 App Router · Tailwind · Drizzle/Neon · Leaflet · Vercel).
> Objetivo: hacerla **más intuitiva, más rápida, más accesible y más confiable**, con foco en el contexto real (post-terremoto en Venezuela = **conectividad pobre, mayoría en Android, WhatsApp como canal dominante**).
>
> Prioridades: **P0** = crítico/hacer ya · **P1** = importante · **P2** = mejora.

---

## 0. Diagnóstico rápido (lo que detecté en vivo)

| Área | Hallazgo | Severidad |
|---|---|---|
| Rendimiento | La home es `export const dynamic = 'force-dynamic'` **y además** `HomeClient` hace `fetchPersonas()` en `useEffect` al montar → **doble carga** (SSR + refetch cliente) que descarta el render del servidor | P0 |
| Rendimiento | Fuente **Inter** referenciada en CSS/Tailwind pero **nunca se carga** (no hay `next/font` ni `<link>`), cae a `system-ui` → tipografía inconsistente | P1 |
| Rendimiento | **Leaflet CSS** se carga desde `unpkg.com` (CDN externo, render-blocking, punto único de fallo) | P1 |
| Rendimiento | Imágenes con `<img>` crudo (no `next/image`): sin `srcset`, sin optimización, sin `width/height` → CLS y MBs de más en redes lentas | P0 |
| Accesibilidad | **24 imágenes, las 24 sin `alt`** | P0 |
| Accesibilidad | Banner de emergencia con `animation: pulse infinite` sin respetar `prefers-reduced-motion` | P1 |
| SEO/Social | Hay OG/Twitter tags pero **falta `og:image`** y `metadataBase` → al compartir en WhatsApp/redes no sale tarjeta con imagen | P0 |
| SEO | Sin `robots.txt`, `sitemap.xml`, ni JSON-LD estructurado | P1 |
| PWA/Móvil | Sin `manifest.json` ni service worker → no instalable, no funciona offline (clave tras un sismo) | P1 |
| Privacidad | Cédula, teléfono y email (de la persona y de quien reporta) se exponen **públicos y completos**; `POST /api/personas` sin anti-spam/captcha | P0 |
| UX | Sitio vacío (0 registros) sin seed/onboarding; CTA principal poco persistente en móvil; sin botón **Compartir por WhatsApp** | P1 |

---

## 1. ⭐ Slider superior de fotos de personas (lo pedido)

**Requisito:** franja horizontal arriba, **6 fotos a la vez**, que **rota de 6 en 6 cada 4 segundos**, responsive.

### 1.1 Comportamiento y decisiones
- Muestra solo personas **con `fotoUrl`** (las que tienen cara para reconocer).
- **Auto-rotación cada 4 s** avanzando **grupos completos** (de 6 en 6 en desktop).
- **Responsive por viewport** (fotos visibles a la vez):
  - Móvil chico (<480px): **2–3**
  - Móvil/Tablet (480–1024px): **3–4**
  - Desktop (≥1024px): **6**
- **Pausa** al pasar el mouse o al enfocar con teclado (no rota mientras alguien lee).
- Respeta **`prefers-reduced-motion`** (no auto-rota si el usuario pidió menos movimiento).
- Cada foto es un **botón accesible** (abre el detalle), con **anillo de color por estado** (rojo=buscado, verde=encontrado, gris=fallecido) y **`alt` descriptivo**.
- **Swipe táctil** nativo (scroll-snap como mejora opcional) + **puntos (dots)** de navegación.
- Ubicación recomendada: **debajo del header, antes del hero**, con un título tipo *"Personas reportadas — ayúdanos a reconocerlas"*.

### 1.2 Componente listo para pegar — `src/components/PersonasSlider.tsx`

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'

interface Persona {
  id: string
  nombre: string
  apellido: string
  fotoUrl: string | null
  estado: string
  ultimaUbicacion?: string | null
}

const statusRing: Record<string, string> = {
  buscado: 'ring-red-500',
  encontrado: 'ring-green-500',
  fallecido: 'ring-gray-400',
}

/** Fotos visibles a la vez según el ancho de pantalla. */
function usePerView() {
  const [n, setN] = useState(6)
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth
      setN(w < 480 ? 2 : w < 768 ? 3 : w < 1024 ? 4 : 6)
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])
  return n
}

export default function PersonasSlider({
  personas,
  onSelect,
}: {
  personas: Persona[]
  onSelect: (id: string) => void
}) {
  const items = personas.filter((p) => p.fotoUrl) // solo con foto
  const perView = usePerView()
  const groups = Math.max(1, Math.ceil(items.length / perView))
  const [group, setGroup] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduceMotion = useRef(false)

  useEffect(() => {
    reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  // Si cambia el nº de grupos (resize) y el índice queda fuera, reiniciar.
  useEffect(() => {
    if (group >= groups) setGroup(0)
  }, [groups, group])

  // Auto-rotación cada 4 s (en grupos de `perView`).
  useEffect(() => {
    if (paused || groups <= 1 || reduceMotion.current) return
    const id = setInterval(() => setGroup((g) => (g + 1) % groups), 4000)
    return () => clearInterval(id)
  }, [paused, groups])

  if (items.length === 0) return null

  return (
    <section
      aria-label="Personas reportadas recientemente"
      aria-roledescription="carrusel"
      className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">
          🧑‍🤝‍🧑 Personas reportadas — ayúdanos a reconocerlas
        </h2>
        <span className="text-xs text-gray-400">{items.length} con foto</span>
      </div>

      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${group * 100}%)` }}
        >
          {Array.from({ length: groups }).map((_, gi) => (
            <div
              key={gi}
              className="grid w-full shrink-0 gap-3"
              style={{ gridTemplateColumns: `repeat(${perView}, minmax(0,1fr))` }}
              aria-hidden={gi !== group}
            >
              {items.slice(gi * perView, gi * perView + perView).map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelect(p.id)}
                  tabIndex={gi === group ? 0 : -1}
                  className="group flex flex-col items-center gap-2 rounded-lg p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  aria-label={`Ver a ${p.nombre} ${p.apellido} — estado: ${p.estado}`}
                >
                  {/* Reemplazar por next/image (ver §2.3) */}
                  <img
                    src={p.fotoUrl!}
                    alt={`Foto de ${p.nombre} ${p.apellido}`}
                    loading="lazy"
                    width={96}
                    height={96}
                    className={`h-16 w-16 rounded-full object-cover ring-4 sm:h-24 sm:w-24 ${
                      statusRing[p.estado] ?? 'ring-gray-300'
                    } ring-offset-2 transition-transform group-hover:scale-105`}
                  />
                  <span className="max-w-[6rem] truncate text-xs font-medium text-gray-700">
                    {p.nombre}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {groups > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5" role="tablist" aria-label="Grupos">
          {Array.from({ length: groups }).map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === group}
              aria-label={`Mostrar grupo ${i + 1} de ${groups}`}
              onClick={() => setGroup(i)}
              className={`h-2 rounded-full transition-all ${
                i === group ? 'w-6 bg-red-600' : 'w-2 bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
```

### 1.3 Integración en `HomeClient.tsx`
```tsx
import PersonasSlider from '@/components/PersonasSlider'
// ...
{/* Justo después de </header> y antes del <section> del hero */}
<div className="max-w-7xl mx-auto px-4 pt-6">
  <PersonasSlider personas={personas} onSelect={handleSelectPersona} />
</div>
```

### 1.4 Mejoras del slider (P2)
- **Avatar de respaldo** cuando `fotoUrl` es nulo (iniciales sobre color por estado) si quieres incluir a todos, no solo con foto.
- **Precarga** de la primera tanda con `loading="eager"` y el resto `lazy`.
- **Accesibilidad extra:** botón de play/pausa visible y `aria-live="off"` (carrusel no debe anunciar cada cambio).
- **Rendimiento:** si hay cientos de personas, limita el slider a las **30–40 más recientes** (las demás ya están en el listado/mapa).

---

## 2. Rendimiento (clave por la conectividad en Venezuela)

### 2.1 Quitar el doble fetch (P0)
`page.tsx` ya trae `initialPersonas` por SSR, pero `HomeClient` hace `fetchPersonas()` en `useEffect` al montar y **pisa** esos datos con otra petición. Resultado: doble consulta y parpadeo.
- **Fix:** elimina el `useEffect(() => { fetchPersonas() }, [])` inicial. Usa `initialPersonas` como estado y solo refetchea ante búsqueda/paginación/alta. Así el primer render es instantáneo (datos del server).

### 2.2 Caché / ISR en vez de `force-dynamic` total (P1)
La home entera es `force-dynamic` (DB en cada request). Para un sitio público de lectura masiva:
- Usa **revalidación** (`export const revalidate = 30`) o `unstable_cache`/`fetch` con `next: { revalidate: 30 }` para stats y listado, y deja dinámico solo lo que de verdad lo necesite.
- Beneficio: aguanta picos de tráfico (que los habrá tras un sismo) sin tumbar la DB Neon.

### 2.3 `next/image` en lugar de `<img>` (P0)
- Ya tienes `remotePatterns` en `next.config.js` (supabase + vercel-blob). Úsalo:
```tsx
import Image from 'next/image'
<Image src={p.fotoUrl!} alt={`Foto de ${p.nombre} ${p.apellido}`} width={96} height={96}
  className="rounded-full object-cover" sizes="96px" />
```
- Beneficios: AVIF/WebP automático, `srcset`, lazy, `width/height` (mata el CLS). En redes 3G/lentas reduce drásticamente los KB.
- Añade el host real de las fotos a `remotePatterns` si no es supabase/vercel-blob.

### 2.4 Fuente con `next/font` (P1)
Hoy Inter no carga. Reemplaza por self-hosting automático sin layout shift:
```tsx
// layout.tsx
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' })
// <html lang="es" className={inter.variable}>  y en tailwind fontFamily.sans usa var(--font-inter)
```
Elimina la dependencia de que el navegador tenga Inter.

### 2.5 Leaflet sin CDN externo (P1)
- Quita el `<link href="unpkg.com/leaflet.css">` del `<head>` e **importa el CSS desde el paquete** (`import 'leaflet/dist/leaflet.css'` en el componente `Map`, que ya es client-only). Evita render-blocking y caída si unpkg falla.
- **Marker clustering** (`leaflet.markercluster`) cuando haya muchos puntos: el mapa con cientos de marcadores se vuelve lento en móviles de gama baja.
- Considera **cargar el mapa bajo demanda** (botón "Ver mapa" o `IntersectionObserver`): Leaflet + tiles son pesados; en móvil muchos usuarios solo quieren buscar un nombre.

### 2.6 Presupuesto de bajo ancho de banda (P1)
- Objetivo: **first load JS < 150 KB** y **LCP < 2.5 s en 3G**. Mide con Lighthouse (modo móvil + throttling).
- Lazy-load del mapa, del modal de alta y del detalle (ya hay `dynamic` para el mapa; aplica igual a `AddPersonModal` y `PersonDetail`).
- Comprime las fotos al subir (ver §6) — son el mayor peso.

---

## 3. Responsividad (Android · tablet · navegador)

### 3.1 Lo que ya está bien
`max-w-7xl`, breakpoints `sm:`, grids `grid-cols-1 sm:grid-cols-2`, header sticky. La base responsive es correcta.

### 3.2 Ajustes recomendados
- **Targets táctiles ≥ 44×44px** (WCAG/Material): botones de paginación, dots del slider, enlaces del footer. Revisa el botón "Registrar persona" del header en móvil (queda apretado junto al logo) → en `<640px` muévelo a una fila propia o usa solo ícono + texto corto.
- **Altura del mapa adaptable:** hoy `.map-container { height: 500px }`. En móvil 500px ocupa casi toda la pantalla. Usa algo como `height: clamp(320px, 50vh, 520px)`.
- **CTA fija en móvil (P1):** barra inferior sticky con "📢 Reportar persona" + "🔍 Buscar" (los 2 objetivos del sitio siempre a un toque). En desktop no hace falta.
- **`dvh` para móvil:** usa `min-h-[100dvh]` en vez de `min-h-screen` para evitar saltos por la barra de URL de Chrome Android.
- **Safe areas (notch):** `padding` con `env(safe-area-inset-*)` en header/footer y en la CTA fija.
- **Tablets:** define explícitamente columnas en el listado (`PersonCard`) para `md:` (p.ej. 2→3→4 columnas). Verifica que el grid no quede con 1 sola columna gigante en 768–1024px.
- **Texto del banner de emergencia:** en pantallas muy chicas puede cortarse; permite 2 líneas o reduce el copy.
- **Prueba real en dispositivos:** Android Chrome (gama baja), iOS Safari, tablet 768px, desktop. Y orientación horizontal en móvil.

### 3.3 Breakpoints sugeridos (coherentes con el slider)
| Dispositivo | Ancho | Slider (fotos) | Listado (cols) |
|---|---|---|---|
| Móvil chico | <480 | 2 | 1 |
| Móvil | 480–767 | 3 | 2 |
| Tablet | 768–1023 | 4 | 3 |
| Desktop | ≥1024 | 6 | 4 |

---

## 4. Accesibilidad (a11y)

- **`alt` en todas las imágenes (P0):** fotos → `alt="Foto de {nombre} {apellido}"`; decorativas → `alt=""`. Hoy las 24 van sin `alt`.
- **`prefers-reduced-motion` (P1):** envolver el `pulse` del banner y el auto-slide:
```css
@media (prefers-reduced-motion: reduce) {
  .emergency-banner { animation: none; }
  * { scroll-behavior: auto; }
}
```
- **Contraste:** verifica el rojo `#dc2626` sobre fondos claros y el texto gris `text-gray-400/500` (algunos quedan bajo el 4.5:1 de WCAG AA). Sube a `gray-600/700` donde sea texto informativo.
- **Foco visible:** `focus-visible:ring` en todos los botones/enlaces e inputs (el slider ya lo trae).
- **Jerarquía de encabezados:** un solo `<h1>` (hoy el `<h1>` es "ReportaVNZLA" y el hero es `<h2>` — ok, pero asegúrate de no saltar niveles).
- **Mapa accesible:** Leaflet no es navegable por teclado por defecto. Ofrece el **listado** como alternativa equivalente (ya existe) y enlaza "ver en lista" desde el mapa.
- **Formularios (`AddPersonModal`):** `<label>` asociado a cada input, `aria-invalid`/mensajes de error, foco atrapado dentro del modal y retorno de foco al cerrar (focus trap).
- **Idioma:** `lang="es"` ✔.

---

## 5. SEO y compartir (vital: en Venezuela se comparte por WhatsApp)

- **`metadataBase` + `og:image` (P0):** sin imagen OG, al pegar el link en WhatsApp/Twitter no aparece tarjeta. Añade:
```tsx
export const metadata: Metadata = {
  metadataBase: new URL('https://reportavnzla.com'),
  openGraph: { images: ['/og-image.png'], /* 1200×630 */ },
  twitter: { images: ['/og-image.png'] },
}
```
  - Crea una OG image (estática o con `next/og` dinámica que muestre el contador de personas).
- **`robots.txt` y `sitemap.xml` (P1):** usa `app/robots.ts` y `app/sitemap.ts` de Next. Incluye las URLs de personas si haces páginas individuales (ver abajo).
- **Páginas por persona (P1):** rutas `/persona/[id]` indexables, con su propio `<title>`/OG (foto + nombre). Hoy todo vive en una sola SPA → Google no indexa cada caso y no se puede compartir el link directo de una persona. **Esto multiplica el alcance**: cada caso compartible y buscable en Google.
- **JSON-LD (P2):** `schema.org/Person` o `NGO` para la organización; mejora resultados enriquecidos.
- **Canonical** y `og:locale=es_VE` ✔ (ya está).

---

## 6. Privacidad, seguridad y anti-abuso (P0 — datos sensibles de personas reales)

- **Exposición de datos personales:** cédula, teléfono y email se muestran completos y públicos. Riesgo de doxing/estafas (típico tras desastres).
  - **Enmascara** por defecto: teléfono `0414-***-**67`, cédula `V-12.***.456`. Muestra completo solo tras una acción consciente ("Mostrar contacto") y con aviso.
  - Separa "datos de la persona" de "datos de quien reporta" (el reportante casi nunca debería ser público).
- **`POST /api/personas` sin protección:** hoy cualquiera publica sin límite. Añade:
  - **Rate limiting** por IP (Upstash/Vercel KV) y **honeypot** + **captcha** (hCaptcha/Cloudflare Turnstile) en el alta.
  - **Validación server-side estricta** con Zod (ya tienes `zod`): longitudes, formato de cédula/teléfono VE, coords dentro de Venezuela.
  - **Cola de moderación**: marcar nuevas altas como `pendiente` hasta revisión, o moderación reactiva con botón "Reportar contenido".
- **Subida de imágenes (`/api/medios`) (P0):** valida `Content-Type` y **tamaño máx** (p.ej. 5 MB), **recomprime** a WebP/máx 1024px del lado servidor, y aplica **moderación de contenido** (evitar imágenes inapropiadas). Hoy se sube a blob sin límites visibles.
- **Cabeceras de seguridad (P1):** CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` vía `next.config` headers o middleware.
- **CORS de la API pública** (`/api/v1/personas`): define orígenes/política explícita; documenta que es de solo lectura.
- **Cumplimiento:** publica una **política de privacidad** y un mecanismo para **solicitar borrado** de un registro (derecho de la familia a sacar a su ser querido una vez encontrado).

---

## 7. UX / intuitividad

- **Onboarding con datos (P1):** el sitio en 0 se ve "vacío/roto". Carga **seed real o demo** (zonas afectadas + algunas personas) para que se entienda de inmediato. El scraper (`scrape:sync`) y el analizador IA ya existen → actívalos para poblar.
- **Compartir por WhatsApp (P0 de impacto):** botón "Compartir" en cada persona y en el detalle:
```tsx
const url = `https://reportavnzla.com/persona/${id}`
const text = `🔴 BUSCAMOS a ${nombre} ${apellido}. Última ubicación: ${ultimaUbicacion}. Info: ${url}`
// https://wa.me/?text=${encodeURIComponent(text)}
```
  Es **el** canal en Venezuela; multiplica reencuentros.
- **Filtros como chips (P1):** "Todos / Buscados / Encontrados / Fallecidos" como botones tipo pill (más rápido que un `<select>` en móvil), con el conteo en cada uno.
- **Vista Mapa/Lista alternable en móvil (P1):** un toggle para no tener que hacer scroll por un mapa de 500px antes de llegar al buscador.
- **Estado "Encontrado" celebratorio (P2):** al marcar encontrado, micro-confirmación positiva ("💚 ¡Reencuentro registrado!") — refuerza el propósito.
- **Búsqueda tolerante (P1):** búsqueda por nombre con acentos/insensible a mayúsculas y por cédula; debounce en el input.
- **Indicadores de carga claros** y **skeletons** en cards/mapa (hoy hay spinner emoji; un skeleton se siente más rápido).
- **Contacto/cómo ayudar:** sección breve "¿Cómo ayudar?" (reportar, compartir, verificar) para canalizar voluntarios.

---

## 8. PWA / Offline (P1 — diferencial en zona de desastre)

- **`manifest.json`** (`app/manifest.ts`): nombre, `theme_color #dc2626`, íconos 192/512, `display: standalone` → **instalable en Android** ("Agregar a inicio").
- **Service worker** (next-pwa o Workbox): cachea el shell + últimas personas vistas para **funcionar con conexión intermitente**. Tras un sismo la red va y viene; poder abrir la app y ver lo último cacheado es enorme.
- **Offline fallback**: página "sin conexión" con los teléfonos de emergencia (171/911) siempre visibles.

---

## 9. Mapa (Leaflet)

- **Clustering** de marcadores (rendimiento con muchos puntos).
- **CSS local** (no unpkg) — ver §2.5.
- **Tiles:** ya hay CARTO/OSM; ten un **fallback** si un proveedor falla y respeta sus términos de uso/atribución.
- **Geolocalización opcional:** botón "cerca de mí" para centrar el mapa (con permiso).
- **Popups accesibles** y con foto + enlace al detalle.

---

## 10. Calidad de datos e integraciones

- **Deduplicación:** la misma persona puede reportarse varias veces (varias fuentes/familiares). Detecta duplicados por cédula/nombre+edad+zona y permite "fusionar".
- **Trazabilidad de fuente:** ya hay `fuentesDatos` + `fuenteId`; muéstralo en el detalle ("Fuente: scraping / manual / IA") para confianza.
- **Verificación:** badge "verificado" para registros confirmados por fuente oficial vs. ciudadanos.
- **Export de datos abiertos:** endpoint/descarga CSV/JSON (refuerza el "datos abiertos" que promete el sitio) con campos sensibles ya enmascarados.

---

## 11. Calidad de código / DevOps

- **Tests:** al menos unitarios de los validadores Zod y de la API `personas` (alta, búsqueda, marcar encontrado). E2E con Playwright del flujo "reportar → aparecer en lista/slider/mapa".
- **Manejo de errores de DB:** hoy los `catch` devuelven `[]`/0 silenciosamente. Añade logging (y un estado de "no se pudo cargar, reintentar") para no confundir "vacío" con "caído".
- **Validación de entorno:** valida `DATABASE_URL`/blob token al boot (fail-fast) para no desplegar roto.
- **Analítica respetuosa:** Plausible/Umami (sin cookies) para medir uso real y priorizar.
- **Monitoreo:** Sentry para errores cliente/servidor; un caído en una emergencia es crítico.
- **CI:** lint + typecheck + build en cada PR (Vercel ya da previews).

---

## 12. Checklist priorizado

### P0 — Hacer ya
- [ ] Slider superior de fotos (rota 6/6 cada 4 s, responsive) — §1
- [ ] `alt` en todas las imágenes — §4
- [ ] Quitar el doble fetch de `HomeClient` — §2.1
- [ ] `next/image` para fotos — §2.3
- [ ] `metadataBase` + `og:image` (tarjeta al compartir en WhatsApp) — §5
- [ ] Enmascarar datos personales + anti-spam/captcha en `POST /api/personas` + límites en subida de imágenes — §6
- [ ] Botón **Compartir por WhatsApp** — §7

### P1 — Importante
- [ ] `next/font` (Inter) y Leaflet CSS local — §2.4 / §2.5
- [ ] ISR/`revalidate` en vez de `force-dynamic` total — §2.2
- [ ] CTA fija móvil + altura de mapa adaptable + `dvh` + safe areas — §3
- [ ] `prefers-reduced-motion` + contraste + focus + labels en formularios — §4
- [ ] Páginas por persona `/persona/[id]` indexables + `robots.ts`/`sitemap.ts` — §5
- [ ] Filtros como chips + toggle Mapa/Lista en móvil — §7
- [ ] PWA: manifest + service worker + offline — §8
- [ ] Seed/demo para no verse vacío — §7

### P2 — Mejora
- [ ] Avatar de respaldo en slider · play/pausa — §1.4
- [ ] Marker clustering + geolocalización — §9
- [ ] Deduplicación + badge verificado + export datos abiertos — §10
- [ ] JSON-LD, analítica sin cookies, Sentry, tests E2E — §5/§11

---

### Métricas objetivo (medir con Lighthouse móvil, 3G)
- Performance ≥ 90 · Accesibilidad ≥ 95 · Best Practices ≥ 95 · SEO ≥ 95
- LCP < 2.5 s · CLS < 0.1 · First Load JS < 150 KB
