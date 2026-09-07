const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.72;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function isAskImageFile(file: File | null | undefined): boolean {
  if (!file) return false;
  if (ALLOWED.has(file.type)) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(file.name || '');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = src;
  });
}

export async function compressScreenshot(file: File): Promise<{ mime: 'image/jpeg'; data: string; previewUrl: string }> {
  if (!isAskImageFile(file)) {
    throw new Error('Use a PNG, JPEG, or WebP screenshot.');
  }
  const previewUrl = URL.createObjectURL(file);
  const img = await loadImage(previewUrl);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width || 1, img.height || 1));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare that screenshot.');
  ctx.drawImage(img, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
  if (!data) throw new Error('Could not prepare that screenshot.');
  return { mime: 'image/jpeg', data, previewUrl };
}
