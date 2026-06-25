/**
 * Comprime una imagen (jpg/png/webp) en el navegador y devuelve un data URI
 * JPEG pequeño. Permite guardar fotos sin depender de un almacenamiento externo
 * (ej. cuando Vercel Blob no está configurado).
 */
export async function compressImageToDataUrl(
  file: File,
  maxDim = 1000,
  quality = 0.72
): Promise<string> {
  const readDataUrl = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result as string)
      fr.onerror = () => reject(new Error('read error'))
      fr.readAsDataURL(f)
    })

  const original = await readDataUrl(file)

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('image decode error'))
    i.src = original
  })

  let { width, height } = img
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.round((height * maxDim) / width)
      width = maxDim
    } else {
      width = Math.round((width * maxDim) / height)
      height = maxDim
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return original
  ctx.drawImage(img, 0, 0, width, height)
  try {
    return canvas.toDataURL('image/jpeg', quality)
  } catch {
    return original
  }
}
