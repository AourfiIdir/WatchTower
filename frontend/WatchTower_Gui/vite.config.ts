import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    proxy: {
      '/monitors': 'http://localhost:3000',
      '/accounts': 'http://localhost:3000',
      '/checks': 'http://localhost:3000',
      '/incidents': 'http://localhost:3000',
      '/config': 'http://localhost:3000',
    },
  },
})