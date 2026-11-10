export type SystemShareMethod = 'system' | 'system_link';
type Capabilities = { share?: (data: ShareData) => Promise<void>; canShare?: (data: ShareData) => boolean };

/** Synchronous choice keeps the share call inside the user's gesture. */
export function prepareShare(file: File, url: string, title: string, capabilities: Capabilities = navigator): { method: SystemShareMethod; data: ShareData } | null {
  if (typeof capabilities.share !== 'function') return null;
  try {
    if (capabilities.canShare?.({ files: [file] })) return { method: 'system', data: { files: [file], title, url } };
  } catch { /* link sharing can still work without file sharing */ }
  return { method: 'system_link', data: { title, url } };
}
