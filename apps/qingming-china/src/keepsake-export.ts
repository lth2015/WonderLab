/** Export the actual sample design, with its sample marker, independently of UI controls. */
export async function createKeepsakeImage(art: SVGSVGElement): Promise<Blob> {
  if (document.fonts) await document.fonts.ready;
  const svg = art.cloneNode(true) as SVGSVGElement;
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', '1440'); svg.setAttribute('height', '1800');
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('sample render failed')); image.src = url; });
    const canvas = document.createElement('canvas'); canvas.width = 1440; canvas.height = 1800;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('canvas unavailable');
    ctx.drawImage(image, 0, 0, 1440, 1800);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('sample export failed')), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}
