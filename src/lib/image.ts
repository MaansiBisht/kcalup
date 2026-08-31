const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/** Long edge the model gets. More pixels do not buy better calorie estimates. */
const MAX_EDGE = 1280
const JPEG_QUALITY = 0.82

export function validateImage(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number])) {
    return 'That file type is not supported. Use a JPEG, PNG or WebP photo.'
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return 'That photo is larger than 8 MB. Try taking it again at a lower resolution.'
  }
  return null
}

/**
 * Shrink to MAX_EDGE and re-encode as JPEG before upload. Cuts upload time,
 * storage and analysis latency in one step. Falls back to the original file if
 * the browser cannot decode it — the server validates either way.
 */
export async function downscaleImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))

    if (scale === 1 && file.type === 'image/jpeg') {
      bitmap.close()
      return file
    }

    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    )
    return blob ?? file
  } catch {
    return file
  }
}
