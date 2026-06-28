/**
 * Gate de administrador para los endpoints FR sensibles del demo (/fr).
 *
 * reportavnzla NO tiene sistema de sesión, así que los proxies que ESCRIBEN en
 * el índice real (/api/fr/index → poisoning) o que VUELCAN datos cross-source de
 * personas (/api/fr/reconcile, /api/fr/duplicates) no pueden quedar abiertos al
 * público. Los protegemos con un token de administrador server-side.
 *
 * Fail-closed: si `FR_ADMIN_TOKEN` no está configurado, se DENIEGA todo (no se
 * expone el índice ni se permite indexar). El token viaja en el header
 * `x-fr-admin` (o `?admin_token=` para pruebas). Nunca llega al navegador del
 * público; solo lo conoce quien opera la herramienta de admin.
 *
 * Lo PÚBLICO del demo (búsqueda 1:N y check-duplicate) NO usa este gate: solo
 * lee coincidencias por rostro y el FR-API ya no devuelve teléfono.
 */
export function frAdminOk(req: Request): boolean {
  const expected = process.env.FR_ADMIN_TOKEN || ''
  if (!expected) return false // fail-closed: sin token configurado, no se permite
  let got = req.headers.get('x-fr-admin') || ''
  if (!got) {
    try {
      got = new URL(req.url).searchParams.get('admin_token') || ''
    } catch {
      got = ''
    }
  }
  if (got.length !== expected.length) return false
  // Comparación en tiempo ~constante (evita timing leak del token).
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= got.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

/** Respuesta 403 estándar para una operación admin no autorizada. */
export function frAdminDenied(): Response {
  return new Response(
    JSON.stringify({ ok: false, error: 'No autorizado: esta operación requiere credenciales de administrador.' }),
    { status: 403, headers: { 'content-type': 'application/json' } },
  )
}
