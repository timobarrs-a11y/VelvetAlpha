// vite.config.ts
import { defineConfig, loadEnv } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = env.VITE_SUPABASE_URL || "";
  const supabaseHost = supabaseUrl.replace(/^https?:\/\//, "");
  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ["lucide-react"]
    },
    server: {
      proxy: supabaseHost ? {
        "/supabase-proxy": {
          target: `https://${supabaseHost}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/supabase-proxy/, ""),
          ws: true
        }
      } : {}
    },
    preview: {
      proxy: supabaseHost ? {
        "/supabase-proxy": {
          target: `https://${supabaseHost}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/supabase-proxy/, ""),
          ws: true
        }
      } : {}
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            three: ["three"],
            gsap: ["gsap"]
          }
        }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcbiAgY29uc3QgZW52ID0gbG9hZEVudihtb2RlLCBwcm9jZXNzLmN3ZCgpLCAnJyk7XG4gIGNvbnN0IHN1cGFiYXNlVXJsID0gZW52LlZJVEVfU1VQQUJBU0VfVVJMIHx8ICcnO1xuICBjb25zdCBzdXBhYmFzZUhvc3QgPSBzdXBhYmFzZVVybC5yZXBsYWNlKC9eaHR0cHM/OlxcL1xcLy8sICcnKTtcblxuICByZXR1cm4ge1xuICAgIHBsdWdpbnM6IFtyZWFjdCgpXSxcbiAgICBvcHRpbWl6ZURlcHM6IHtcbiAgICAgIGV4Y2x1ZGU6IFsnbHVjaWRlLXJlYWN0J10sXG4gICAgfSxcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIHByb3h5OiBzdXBhYmFzZUhvc3RcbiAgICAgICAgPyB7XG4gICAgICAgICAgICAnL3N1cGFiYXNlLXByb3h5Jzoge1xuICAgICAgICAgICAgICB0YXJnZXQ6IGBodHRwczovLyR7c3VwYWJhc2VIb3N0fWAsXG4gICAgICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgICAgICAgcmV3cml0ZTogKHBhdGgpID0+IHBhdGgucmVwbGFjZSgvXlxcL3N1cGFiYXNlLXByb3h5LywgJycpLFxuICAgICAgICAgICAgICB3czogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfVxuICAgICAgICA6IHt9LFxuICAgIH0sXG4gICAgcHJldmlldzoge1xuICAgICAgcHJveHk6IHN1cGFiYXNlSG9zdFxuICAgICAgICA/IHtcbiAgICAgICAgICAgICcvc3VwYWJhc2UtcHJveHknOiB7XG4gICAgICAgICAgICAgIHRhcmdldDogYGh0dHBzOi8vJHtzdXBhYmFzZUhvc3R9YCxcbiAgICAgICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aC5yZXBsYWNlKC9eXFwvc3VwYWJhc2UtcHJveHkvLCAnJyksXG4gICAgICAgICAgICAgIHdzOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9XG4gICAgICAgIDoge30sXG4gICAgfSxcbiAgICBidWlsZDoge1xuICAgICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgICBvdXRwdXQ6IHtcbiAgICAgICAgICBtYW51YWxDaHVua3M6IHtcbiAgICAgICAgICAgIHRocmVlOiBbJ3RocmVlJ10sXG4gICAgICAgICAgICBnc2FwOiBbJ2dzYXAnXSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9O1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlOLFNBQVMsY0FBYyxlQUFlO0FBQy9QLE9BQU8sV0FBVztBQUVsQixJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssTUFBTTtBQUN4QyxRQUFNLE1BQU0sUUFBUSxNQUFNLFFBQVEsSUFBSSxHQUFHLEVBQUU7QUFDM0MsUUFBTSxjQUFjLElBQUkscUJBQXFCO0FBQzdDLFFBQU0sZUFBZSxZQUFZLFFBQVEsZ0JBQWdCLEVBQUU7QUFFM0QsU0FBTztBQUFBLElBQ0wsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLElBQ2pCLGNBQWM7QUFBQSxNQUNaLFNBQVMsQ0FBQyxjQUFjO0FBQUEsSUFDMUI7QUFBQSxJQUNBLFFBQVE7QUFBQSxNQUNOLE9BQU8sZUFDSDtBQUFBLFFBQ0UsbUJBQW1CO0FBQUEsVUFDakIsUUFBUSxXQUFXLFlBQVk7QUFBQSxVQUMvQixjQUFjO0FBQUEsVUFDZCxTQUFTLENBQUMsU0FBUyxLQUFLLFFBQVEscUJBQXFCLEVBQUU7QUFBQSxVQUN2RCxJQUFJO0FBQUEsUUFDTjtBQUFBLE1BQ0YsSUFDQSxDQUFDO0FBQUEsSUFDUDtBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1AsT0FBTyxlQUNIO0FBQUEsUUFDRSxtQkFBbUI7QUFBQSxVQUNqQixRQUFRLFdBQVcsWUFBWTtBQUFBLFVBQy9CLGNBQWM7QUFBQSxVQUNkLFNBQVMsQ0FBQyxTQUFTLEtBQUssUUFBUSxxQkFBcUIsRUFBRTtBQUFBLFVBQ3ZELElBQUk7QUFBQSxRQUNOO0FBQUEsTUFDRixJQUNBLENBQUM7QUFBQSxJQUNQO0FBQUEsSUFDQSxPQUFPO0FBQUEsTUFDTCxlQUFlO0FBQUEsUUFDYixRQUFRO0FBQUEsVUFDTixjQUFjO0FBQUEsWUFDWixPQUFPLENBQUMsT0FBTztBQUFBLFlBQ2YsTUFBTSxDQUFDLE1BQU07QUFBQSxVQUNmO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
