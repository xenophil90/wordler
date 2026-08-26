// Ausgabe als Datei. Alles entsteht im Browser, nichts wird hochgeladen.

const MIME = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };

export function canvasToBlob(canvas, format, quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('errExportFailed'))),
      MIME[format] || MIME.png,
      format === 'png' ? undefined : quality,
    );
  });
}

export function svgToBlob(svg) {
  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Erst nach dem Klick freigeben, sonst bricht der Download in Safari ab.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function copyToClipboard(canvas) {
  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
    throw new Error('errClipboardUnsupported');
  }
  const blob = await canvasToBlob(canvas, 'png');
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

export function safeFilename(base, ext) {
  const name = String(base || 'wordcloud')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'wordcloud';
  return `${name}.${ext}`;
}
