/** Long edge and quality of photos sent to the server (docs/architecture/01-system-architecture.md §6.4). */
export const photoLongEdge = 2048
export const photoQuality = 0.85

/**
 * Shrinks a photo before upload: long edge at most 2048 px, JPEG 0.85. A phone photo of 4–8 MB becomes
 * a few hundred KB, which matters on a weak signal at the venue. The browser applies the EXIF orientation
 * when decoding; the server strips all metadata anyway.
 */
export async function compressPhoto(source: Blob | HTMLCanvasElement | HTMLVideoElement): Promise<Blob> {
  const image =
    source instanceof Blob ? await createImageBitmap(source, { imageOrientation: 'from-image' }) : source
  const width = image instanceof HTMLVideoElement ? image.videoWidth : image.width
  const height = image instanceof HTMLVideoElement ? image.videoHeight : image.height
  const scale = Math.min(1, photoLongEdge / Math.max(width, height))

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height)
  if ('close' in image) image.close()

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('encode failed'))),
      'image/jpeg',
      photoQuality,
    ),
  )
}

/** Saves a downloaded file (a blob fetched with the access token) under a name. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
