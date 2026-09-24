import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Optional absolute unpacked tarball directory for consumer-level browser acceptance.
  const packageDirectory = loadEnv(mode, '.', 'EXMD_').EXMD_TEST_PACKAGE_DIR
  return {
    plugins: [react()],
    resolve: {
      dedupe: ['react', 'react-dom', 'yjs', '@codemirror/state', '@codemirror/view'],
      alias: packageDirectory ? [
        { find: 'exmd-collaborative-editor/style.css', replacement: packageDirectory + '/dist/style.css' },
        { find: 'exmd-collaborative-editor', replacement: packageDirectory + '/dist/index.js' },
      ] : [],
    },
    build: { outDir: 'demo-dist' },
  }
})
