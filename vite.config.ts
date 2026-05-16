import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'global': 'window',
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          buffer: 'buffer/',
          util: 'util/',
          events: 'events/',
          os: 'os-browserify/browser',
          path: 'path-browserify',
        }
      },
      optimizeDeps: {
        include: ['buffer', 'telegram'],
        esbuildOptions: {
          define: {
            global: 'globalThis',
          },
        },
      },
    };
});
