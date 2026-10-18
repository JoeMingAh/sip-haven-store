import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: [
      'lib/**/*.test.js',
      'scripts/**/*.test.js',
      'api/**/*.test.js',
      'src/**/*.test.jsx',
    ],
  },
})
