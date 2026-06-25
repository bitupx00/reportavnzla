import { pgTable, uuid, varchar, integer, text, real, boolean, timestamp, pgEnum, index } from 'drizzle-orm/pg-core'

export const estadoEnum = pgEnum('estado_persona', ['buscado', 'encontrado', 'fallecido'])
export const medioTipoEnum = pgEnum('medio_tipo', ['foto', 'video'])
export const severidadEnum = pgEnum('severidad_zona', ['critica', 'alta', 'media', 'baja'])
export const fuenteTipoEnum = pgEnum('fuente_tipo', ['supabase', 'scraping', 'manual', 'ia', 'api'])

// ── Personas registradas ────────────────────────────────────
export const personas = pgTable('personas', {
  id: uuid('id').defaultRandom().primaryKey(),
  nombre: varchar('nombre', { length: 100 }).notNull(),
  apellido: varchar('apellido', { length: 100 }).notNull(),
  cedula: varchar('cedula', { length: 20 }),
  edad: integer('edad'),
  genero: varchar('genero', { length: 20 }),
  ultimaUbicacion: text('ultima_ubicacion'),
  descripcion: text('descripcion'),
  fotoUrl: text('foto_url'),
  estado: estadoEnum('estado').default('buscado').notNull(),
  lat: real('lat'),
  lng: real('lng'),
  fechaEncontrado: timestamp('fecha_encontrado', { withTimezone: true }),
  notas: text('notas'),
  reportadoPorNombre: varchar('reportado_por_nombre', { length: 150 }),
  reportadoPorTelefono: varchar('reportado_por_telefono', { length: 30 }),
  reportadoPorEmail: varchar('reportado_por_email', { length: 150 }),
  fuenteId: uuid('fuente_id').references(() => fuentesDatos.id),
  externalId: varchar('external_id', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('personas_nombre_idx').on(table.nombre),
  index('personas_cedula_idx').on(table.cedula),
  index('personas_estado_idx').on(table.estado),
])

// ── Registro de sincronizaciones ─────────────────────────────
export const syncLog = pgTable('sync_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  source: varchar('source', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  totalFetched: integer('total_fetched').default(0),
  newInserted: integer('new_inserted').default(0),
  statusChanged: integer('status_changed').default(0),
  updated: integer('updated').default(0),
  errors: integer('errors').default(0),
  durationMs: integer('duration_ms'),
  details: text('details'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
})

// ── Avisos / testimonios sobre una persona ───────────────────
export const avisos = pgTable('avisos', {
  id: uuid('id').defaultRandom().primaryKey(),
  personaId: uuid('persona_id').references(() => personas.id, { onDelete: 'cascade' }).notNull(),
  nombreAviso: varchar('nombre_aviso', { length: 150 }).notNull(),
  telefonoAviso: varchar('telefono_aviso', { length: 30 }),
  mensaje: text('mensaje').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ── Fotos y videos adjuntos ─────────────────────────────────
export const medios = pgTable('medios', {
  id: uuid('id').defaultRandom().primaryKey(),
  personaId: uuid('persona_id').references(() => personas.id, { onDelete: 'cascade' }).notNull(),
  tipo: medioTipoEnum('tipo').notNull(),
  url: text('url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  descripcion: text('descripcion'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ── Zonas afectadas ─────────────────────────────────────────
export const zonasAfectadas = pgTable('zonas_afectadas', {
  id: uuid('id').defaultRandom().primaryKey(),
  nombre: varchar('nombre', { length: 200 }).notNull(),
  estado: varchar('estado', { length: 50 }).notNull(),
  lat: real('lat').notNull(),
  lng: real('lng').notNull(),
  radioKm: integer('radio_km').default(10),
  severidad: severidadEnum('severidad').default('media').notNull(),
  descripcion: text('descripcion'),
  fuenteId: uuid('fuente_id').references(() => fuentesDatos.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ── Fuentes de datos externas ────────────────────────────────
export const fuentesDatos = pgTable('fuentes_datos', {
  id: uuid('id').defaultRandom().primaryKey(),
  nombre: varchar('nombre', { length: 150 }).notNull(),
  url: text('url'),
  tipo: fuenteTipoEnum('tipo').notNull(),
  activa: boolean('activa').default(true).notNull(),
  lastSync: timestamp('last_sync', { withTimezone: true }),
  config: text('config'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ── Edificios dañados ──────────────────────────────────────
export const edificios = pgTable('edificios', {
  id: uuid('id').defaultRandom().primaryKey(),
  externalId: varchar('external_id', { length: 200 }),
  nombre: varchar('nombre', { length: 300 }).notNull(),
  direccion: text('direccion'),
  ciudad: varchar('ciudad', { length: 100 }),
  zona: varchar('zona', { length: 200 }),
  lat: real('lat'),
  lng: real('lng'),
  nivelDanio: varchar('nivel_danio', { length: 20 }), // total, severo, parcial
  estado: varchar('estado', { length: 50 }),
  fotoUrl: text('foto_url'),
  fuente: varchar('fuente', { length: 100 }),
  notas: text('notas'),
  nombresAtrapados: text('nombres_atrapados'),
  tieneDesaparecidos: boolean('tiene_desaparecidos').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('edificios_ciudad_idx').on(table.ciudad),
  index('edificios_danio_idx').on(table.nivelDanio),
])
