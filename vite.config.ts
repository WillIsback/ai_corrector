import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 25000,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
