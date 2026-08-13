import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

import {defineConfig} from 'vite'

import {getEnginePackageInfo} from './scripts/engine-package.mjs'

const projectRoot = dirname(fileURLToPath(import.meta.url))
const {publicPath: enginePublicPath} = getEnginePackageInfo(projectRoot)

export default defineConfig({
  build: {
    // Three.js is intentionally isolated and audited separately. Its minified
    // size is stable and no longer inflates the application entry chunk.
    chunkSizeWarningLimit: 775,
    rolldownOptions: {
      input: {
        index: resolve(projectRoot, 'index.html'),
        'design-system': resolve(projectRoot, 'design-system.html'),
      },
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'three',
              test: /node_modules[\\/]three[\\/]/,
            },
          ],
        },
      },
    },
  },
  plugins: [
    {
      name: 'version-8thwall-engine-path',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          return html.replaceAll('__8THWALL_ENGINE_PATH__', enginePublicPath)
        },
      },
    },
  ],
})
