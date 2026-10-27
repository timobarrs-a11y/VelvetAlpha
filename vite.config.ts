import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { execSync } from 'child_process';

/** The commit this build came from, so the title screen can say which game is running. */
function buildStamp(): string {
  let hash = 'local';
  try { hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'local'; } catch { /* no git here */ }
  return `${hash} · ${new Date().toISOString().slice(0, 10)}`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = env.VITE_SUPABASE_URL || '';
  const supabaseHost = supabaseUrl.replace(/^https?:\/\//, '');

  return {
    define: { __VELVET_BUILD__: JSON.stringify(buildStamp()) },
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
