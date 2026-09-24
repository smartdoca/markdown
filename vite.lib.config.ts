import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    lib: { entry: 'src/lib/index.ts', formats: ['es', 'cjs'], fileName: format => format === 'es' ? 'index.js' : 'index.cjs' },
    rollupOptions: {
      external: id => !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('src/'),
      output: { assetFileNames: asset => asset.name?.endsWith('.css') ? 'style.css' : 'assets/[name][extname]' },
    },
  },
})
