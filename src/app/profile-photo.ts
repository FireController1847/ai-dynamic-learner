import { PROFILE_AVATAR_DATA_LIMIT } from './profile-storage.ts';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const AVATAR_SIZE = 256;
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

// Normalize uploads into small, safe, still JPEGs rather than persisting
// arbitrary image bytes or large original files in browser storage.
export async function prepareProfilePhoto(file: File): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Choose a JPG, PNG, WebP, or GIF image.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Choose a photo smaller than 8 MB.');
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('This image could not be opened.'));
      element.src = url;
    });
    const { naturalWidth: width, naturalHeight: height } = image;
    if (!width || !height || width * height > 100_000_000) {
      throw new Error('This photo has unsupported dimensions.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo processing is unavailable in this browser.');

    // Center-crop to square. A white background preserves transparent uploads
    // when encoding into the smaller JPEG format.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    const sourceSize = Math.min(width, height);
    context.drawImage(image, (width - sourceSize) / 2, (height - sourceSize) / 2,
      sourceSize, sourceSize, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

    const result = canvas.toDataURL('image/jpeg', 0.82);
    if (!result.startsWith('data:image/jpeg;base64,') ||
      result.length > PROFILE_AVATAR_DATA_LIMIT) {
      throw new Error('This photo is too large to keep locally.');
    }
    return result;
  } finally {
    URL.revokeObjectURL(url);
  }
}
