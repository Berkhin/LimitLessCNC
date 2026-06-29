/// <reference types="vite/client" />

/** Which state-management implementation to mount at runtime. */
type StateMode = 'query' | 'saga';

interface ImportMetaEnv {
  readonly VITE_STATE_MODE: StateMode;
  readonly VITE_API_BASE_URL: string;
}
