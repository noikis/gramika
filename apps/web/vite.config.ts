import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(__dirname, '../..'), '')
  return {
    plugins: [react(), tailwindcss()],
    server: env.API_PROXY_TARGET ? { proxy: { '/api': env.API_PROXY_TARGET } } : undefined,
  }
})
