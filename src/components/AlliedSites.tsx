// Sitios aliados. Para añadir más, agrega { url, nombre, desc } al arreglo.
const SITIOS: Array<{ url: string; nombre: string; desc: string }> = [
  { url: 'https://lonecesitovenezuela.com', nombre: 'Lo Necesito Venezuela', desc: 'Donaciones y necesidades' },
  { url: 'https://caracasayuda.com', nombre: 'Caracas Ayuda', desc: 'Ayuda en Caracas' },
  { url: 'https://terremotovenezuela.com', nombre: 'Terremoto Venezuela', desc: 'Información del sismo' },
  { url: 'https://venezuelareporta.com', nombre: 'Venezuela Reporta', desc: 'Reportes ciudadanos' },
  { url: 'https://ayuda.quedate.net', nombre: 'Ayuda Quédate', desc: 'Red de ayuda' },
  { url: 'https://terremotovenezuela.app', nombre: 'Terremoto Venezuela (App)', desc: 'App del terremoto' },
  { url: 'https://sosvenezuela2026.com', nombre: 'SOS Venezuela 2026', desc: 'Emergencia y SOS' },
  { url: 'https://quedate.net', nombre: 'Quédate', desc: 'Refugios y ayuda' },
  { url: 'https://desaparecidosterremotovenezuela.com', nombre: 'Desaparecidos Terremoto', desc: 'Personas desaparecidas' },
]

function favicon(url: string): string {
  try {
    const host = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`
  } catch {
    return ''
  }
}

export default function AlliedSites() {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4">
      <h3 className="mb-1 text-sm font-semibold text-gray-800">🤝 Plataformas aliadas</h3>
      <p className="mb-3 text-xs text-gray-400">Otras iniciativas que ayudan tras el terremoto. Visítalas y compártelas.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3">
        {SITIOS.map((s) => (
          <a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-2.5 py-2 hover:border-red-200 hover:bg-white transition-colors"
            title={s.nombre}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={favicon(s.url)}
              alt={s.nombre}
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 rounded"
              loading="lazy"
            />
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-gray-800">{s.nombre}</span>
              <span className="block truncate text-[11px] text-gray-400">{s.desc}</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}
