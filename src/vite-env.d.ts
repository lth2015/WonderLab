/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the API server when it is not served from the same origin. */
  readonly VITE_API_BASE?: string;
}
