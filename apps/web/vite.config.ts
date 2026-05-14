import path from 'node:path'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/eea1': {
        target: process.env['VITE_API_TARGET'] ?? 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api': {
        target: process.env['VITE_API_TARGET'] ?? 'http://localhost:3001',
        changeOrigin: true,
      },
      '/test': {
        target: process.env['VITE_API_TARGET'] ?? 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
