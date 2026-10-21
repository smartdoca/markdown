import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const assetFileNames = (asset: { name?: string }) => asset.name?.endsWith('.css') ? 'style.css' : 'assets/[name][extname]'

export default defineConfig({
  plugins: [react()],
  build: {
    lib: { entry: 'src/lib/index.ts' },
    rollupOptions: {
      external: id => !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('src/'),
      output: [
        { format: 'es', entryFileNames: 'index.js', chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames },
        { format: 'cjs', entryFileNames: 'index.cjs', chunkFileNames: 'chunks/[name]-[hash].cjs',
          assetFileNames },
      ],
    },
  },
})
