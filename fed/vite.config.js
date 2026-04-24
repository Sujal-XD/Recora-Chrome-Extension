import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  
  server: {
    // This proxy configuration is the key to solving the cross-origin issue.
    proxy: {
      // Any request from our React app that starts with '/api'
      // will be automatically forwarded to our Node.js server.
      '/api': {
        target: 'http://localhost:5000', // The address of your backend server
        changeOrigin: true, // This is crucial for the proxy to work correctly
        rewrite: (path) => path.replace(/^\/api/, ''), // This removes '/api' before sending to the server
      },
    },
  },

  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      }
    }
  },
});