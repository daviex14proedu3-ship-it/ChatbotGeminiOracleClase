import { OptimizedWebPResult } from '../types';

export interface WebPOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0 (default 0.82)
}

/**
 * Converts any image file to an optimized WebP file entirely in the browser before sending to the server.
 */
export async function convertImageToWebP(
  file: File,
  options: WebPOptions = {}
): Promise<OptimizedWebPResult> {
  const { maxWidth = 1920, maxHeight = 1920, quality = 0.82 } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('No se pudo inicializar el contexto 2D de Canvas.'));
        }

        // Clean background for transparency or transparent PNGs
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Fallo al exportar imagen a formato WebP.'));
            }

            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const webpFileName = `${baseName}.webp`;
            const webpFile = new File([blob], webpFileName, { type: 'image/webp' });

            const originalSize = file.size;
            const newSize = blob.size;
            const savingsPercent = Math.max(
              0,
              Math.round(((originalSize - newSize) / originalSize) * 100)
            );

            const dataUrl = canvas.toDataURL('image/webp', quality);

            resolve({
              file: webpFile,
              blob,
              dataUrl,
              originalName: file.name,
              originalSize,
              newSize,
              savingsPercent,
              width,
              height,
            });
          },
          'image/webp',
          quality
        );
      };

      img.onerror = () => {
        reject(new Error('El archivo seleccionado no es una imagen válida o compatible.'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Error al leer el archivo desde el disco.'));
    };

    reader.readAsDataURL(file);
  });
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
