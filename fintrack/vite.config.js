import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdfjs-dist')) return 'pdf';
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          if (id.includes('xlsx') || id.includes('papaparse')) return 'parsers';
        }
      }
    }
  }
})
