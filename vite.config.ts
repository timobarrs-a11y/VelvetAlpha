import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

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
