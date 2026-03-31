import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/corrector/',
  server: {
    port: 25000,
    host: true,
    allowedHosts: ['spark-787d-1.tail6cba9f.ts.net', 'ai-corrector.spark-787d-1.tail6cba9f.ts.net'],
    origin: 'https://spark-787d-1.tail6cba9f.ts.net/corrector',
    proxy: {
      '/corrector/api/lt': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/corrector\/api\/lt/, '')
      },
      '/v1': {
        target: 'http://127.0.0.1:30000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
})