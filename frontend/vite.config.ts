import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/ — defineConfig from vitest/config adds the typed
// `test` block while remaining a drop-in vite config.
export default defineConfig({
  plugins: [react()],
  test: {
    // Saga generators and the protocol helper are pure logic — no DOM needed.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
