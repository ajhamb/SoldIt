import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:3000', // Redirects frontend/api to backend
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true
      }
    }
  }
})
