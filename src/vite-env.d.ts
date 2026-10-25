/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the API server when it is not served from the same origin. */
  readonly VITE_API_BASE?: string;
}

/** Written in by vite.config.ts at build time. */
declare const __BUILD__: { sha: string; experiment: 'dev' | 'poc-r1' | 'poc-gift-r1'; scene: 'local' | 'ai' };
