import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  // Server configuration
  server: {
    port: 5173,
    strictPort: false,
    open: true,
  },

  // Build configuration for production
  build: {
    // Output directory
    outDir: 'dist',

    // Generate source maps for debugging (disable in production for smaller bundle)
    sourcemap: process.env.VITE_SOURCEMAP === 'true',

    // Minify output — esbuild is built into Vite; terser requires a separate install.
    minify: 'esbuild',

    // Chunk size warnings
    chunkSizeWarningLimit: 1000,

    // Rollup options for optimization
    rollupOptions: {
      output: {
        // Manual chunks for better caching
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-redux': ['@reduxjs/toolkit', 'react-redux'],
          'vendor-router': ['react-router-dom'],
          'vendor-persist': ['redux-persist'],
        },
      },
    },
  },

  // Environment variables
  define: {
    // Make sure to use import.meta.env.VITE_* pattern in code
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
})
