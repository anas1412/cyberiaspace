import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,
        devOptions: { enabled: false },
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          navigateFallbackDenylist: [/^\/api/],
          globPatterns: ['**/*.{js,css,html,png,ico}'],
          globIgnores: ['**/landing-page.*']
        },
        includeAssets: [
          'favicon.ico',
          'logo.png',
          'icon-48x48.png',
          'icon-72x72.png',
          'icon-96x96.png',
          'icon-128x128.png',
          'icon-144x144.png',
          'icon-152x152.png',
          'icon-192x192.png',
          'icon-256x256.png',
          'icon-384x384.png',
          'icon-512x512.png'
        ],
        manifest: {
          scope: '/',
          start_url: '/home',
          name: 'Cyberia Workspace',
          short_name: 'Cyberia',
          description: 'Kinetic Information Architecture & Spatial Thinking',
          theme_color: '#020408',
          background_color: '#020408',
          display: 'standalone',
          icons: [
            {
              src: 'icon-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'icon-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/tailwindcss')) {
              return 'vendor-tailwind';
            }
            if (id.includes('node_modules/framer-motion')) return 'vendor-ui';
            if (id.includes('node_modules/lucide-react')) return 'vendor-ui';
            if (id.includes('node_modules/dexie')) return 'vendor-db';
            if (id.includes('node_modules/@vercel') || id.includes('node_modules/canvas-confetti')) return 'vendor-utils';
            if (id.includes('node_modules/@react-oauth')) return 'vendor-auth';
            if (id.includes('./src/components/Homepage')) return 'landing-page';
          }
        }
      },
      chunkSizeWarningLimit: 600
    }
  }
})