import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/smartId': {
        target: 'http://precis-agric.tsg.cfpamf.com',
        changeOrigin: true
      }
    }
  }
})
