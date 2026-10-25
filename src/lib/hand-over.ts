/**
 * Give the user a JSON file: through the share sheet on a phone (AirDrop,
 * mail, a chat with yourself), as a download elsewhere. Nothing is sent
 * anywhere unless the user picks where it goes.
 */
export async function handOver(name: string, data: unknown): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (window.matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return 'downloaded';
}
