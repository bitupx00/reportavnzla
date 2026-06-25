import { z } from 'zod'

export const personaSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido').max(100),
  apellido: z.string().min(1, 'Apellido requerido').max(100),
  cedula: z.string().max(20).optional().nullable(),
  edad: z.coerce.number().min(0).max(150).optional().nullable(),
  genero: z.enum(['masculino', 'femenino', 'otro']).optional().nullable(),
  ultimaUbicacion: z.string().max(500).optional().nullable(),
  descripcion: z.string().max(2000).optional().nullable(),
  fotoUrl: z.string().url().optional().nullable(),
  estado: z.enum(['buscado', 'encontrado', 'fallecido']).default('buscado'),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  reportadoPorNombre: z.string().min(1, 'Tu nombre es requerido').max(150),
  reportadoPorTelefono: z.string().max(30).optional().nullable(),
  reportadoPorEmail: z.string().email().max(150).optional().nullable(),
})

export const avisoSchema = z.object({
  personaId: z.string().uuid(),
  nombreAviso: z.string().min(1, 'Nombre requerido').max(150),
  telefonoAviso: z.string().max(30).optional().nullable(),
  mensaje: z.string().min(1, 'Mensaje requerido').max(2000),
})

export const medioSchema = z.object({
  personaId: z.string().uuid(),
  tipo: z.enum(['foto', 'video']),
  url: z.string().url(),
  descripcion: z.string().max(500).optional().nullable(),
})

export const searchSchema = z.object({
  q: z.string().max(200).optional().default(''),
  estado: z.enum(['buscado', 'encontrado', 'fallecido', '']).optional().default(''),
  ubicacion: z.string().max(100).optional().default(''),
  page: z.coerce.number().min(0).default(0),
  limit: z.coerce.number().min(1).max(100).default(24),
})

export type PersonaInput = z.infer<typeof personaSchema>
export type AvisoInput = z.infer<typeof avisoSchema>
export type MedioInput = z.infer<typeof medioSchema>
export type SearchInput = z.infer<typeof searchSchema>
