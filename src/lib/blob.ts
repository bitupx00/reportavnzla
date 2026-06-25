import { put } from '@vercel/blob'

export async function uploadFile(file: File, folder: string = 'media'): Promise<string> {
  const filename = `${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  const blob = await put(filename, file, {
    access: 'public',
    addRandomSuffix: true,
  })
  return blob.url
}

export async function uploadMultipleFiles(files: File[], folder: string = 'media'): Promise<string[]> {
  const uploads = files.map(file => uploadFile(file, folder))
  return Promise.all(uploads)
}

export function isVideo(file: File): boolean {
  return file.type.startsWith('video/')
}

export function isImage(file: File): boolean {
  return file.type.startsWith('image/')
}
