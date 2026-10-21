import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Optional absolute unpacked tarball directory for consumer-level browser acceptance.
  const packageDirectory = loadEnv(mode, '.', 'EXMD_').EXMD_TEST_PACKAGE_DIR
  return {
    plugins: [react()],
    resolve: {
      dedupe: ['react', 'react-dom', 'yjs', '@codemirror/state', '@codemirror/view'],
      alias: [
        { find: '@smartdoca/markdown/style.css', replacement: packageDirectory ? packageDirectory + '/dist/style.css' : new URL('./src/styles.css', import.meta.url).pathname },
        { find: '@smartdoca/markdown', replacement: packageDirectory ? packageDirectory + '/dist/index.js' : new URL('./src/lib/index.ts', import.meta.url).pathname },
      ],
    },
    build: { outDir: 'demo-dist' },
  }
})
