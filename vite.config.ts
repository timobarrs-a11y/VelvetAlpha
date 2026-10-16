import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = env.VITE_SUPABASE_URL || '';
  const supabaseHost = supabaseUrl.replace(/^https?:\/\//, '');

  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    server: {
      proxy: supabaseHost
        ? {
            '/supabase-proxy': {
              target: `https://${supabaseHost}`,
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/supabase-proxy/, ''),
              ws: true,
            },
          }
        : {},
    },
    preview: {
      proxy: supabaseHost
        ? {
            '/supabase-proxy': {
              target: `https://${supabaseHost}`,
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/supabase-proxy/, ''),
              ws: true,
            },
          }
        : {},
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          'velvet-house-next': resolve(__dirname, 'games/velvet-house-next/index.html'),
        },
        output: {
          manualChunks: {
            three: ['three'],
            gsap: ['gsap'],
          },
        },
      },
    },
  };
});
