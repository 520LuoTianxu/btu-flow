import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

function parseCsv(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devHost = env.VITE_DEV_HOST || '0.0.0.0'
  const devPort = Number(env.VITE_DEV_PORT || 5173)
  const publicBase = env.VITE_PUBLIC_BASE || '/'
  const smartIdTarget =
    env.VITE_SMART_ID_TARGET || 'http://precis-agric.tsg.cfpamf.com'

  const allowedHosts = env.VITE_ALLOWED_HOSTS
    ? parseCsv(env.VITE_ALLOWED_HOSTS)
    : true

  const hmr =
    env.VITE_HMR_HOST || env.VITE_HMR_PORT || env.VITE_HMR_PROTOCOL
      ? {
          host: env.VITE_HMR_HOST || undefined,
          protocol: env.VITE_HMR_PROTOCOL || undefined,
          port: env.VITE_HMR_PORT ? Number(env.VITE_HMR_PORT) : undefined,
          clientPort: env.VITE_HMR_PORT ? Number(env.VITE_HMR_PORT) : undefined,
        }
      : undefined

  return {
    base: publicBase,
    plugins: [vue()],
    server: {
      host: devHost,
      port: devPort,
      strictPort: true,
      allowedHosts,
      hmr,
      proxy: {
        '/smartId': {
          target: smartIdTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      host: devHost,
      port: devPort,
      strictPort: true,
      allowedHosts,
    },
  }
})
