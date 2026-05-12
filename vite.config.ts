import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        legacy({
          targets: ['iOS >= 15', 'Safari >= 15', 'Chrome >= 90', 'Firefox >= 88'],
          additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
          modernPolyfills: true,
        }),
      ],
      define: {
        'process.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
        cssTarget: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
      }
    };
});