import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['./tests/unit/**/*.test.{ts,tsx}', './tests/behavior/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    clearMocks: true,
  },
})
