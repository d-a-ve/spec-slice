import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { handleFetchSpecRequest } from './vite-plugin-fetch-spec.ts'

function fetchSpecApiPlugin(): Plugin {
  return {
    name: 'fetch-spec-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleFetchSpecRequest(req, res).then((handled: boolean) => {
          if (!handled) next()
        })
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleFetchSpecRequest(req, res).then((handled: boolean) => {
          if (!handled) next()
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), fetchSpecApiPlugin()],
})
