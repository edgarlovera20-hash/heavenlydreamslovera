import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(env.VITE_GOOGLE_MAPS_PLATFORM_KEY || env.GOOGLE_MAPS_PLATFORM_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      allowedHosts: true,
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      target: 'esnext',
      sourcemap: false,
      modulePreload: true,
      cssCodeSplit: true,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        input: {
          app: path.resolve(__dirname, 'index.html'),
          mobile: path.resolve(__dirname, 'mobile.html'),
        },
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('@google/generative-ai') || id.includes('/ai/')) return 'vendor-ai';
            if (id.includes('tesseract.js')) return 'vendor-ocr';
            if (id.includes('qrcode')) return 'vendor-qrcode';
            if (id.includes('@firebase') || id.includes('/firebase/')) return 'vendor-firebase';
            if (id.includes('socket.io-client') || id.includes('engine.io-client') || id.includes('socket.io-parser')) return 'vendor-realtime';
            if (id.includes('maplibre-gl')) return 'vendor-maps';
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('scheduler')) return 'vendor-react';
            if (id.includes('lucide-react') || id.includes('sonner') || id.includes('clsx') || id.includes('tailwind-merge')) return 'vendor-ui';
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) return 'vendor-charts';
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('dompurify')) return 'vendor-pdf';
            if (id.includes('jszip')) return 'vendor-zip';
            if (id.includes('motion') || id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('@simplewebauthn')) return 'vendor-auth';
            // Chunks faltantes — evitan que estas libs pesadas caigan al bundle principal
            if (id.includes('gsap') || id.includes('@gsap')) return 'vendor-gsap';
            if (id.includes('heic2any')) return 'vendor-heic';
            if (id.includes('idb-keyval')) return 'vendor-idb';
            if (id.includes('zustand')) return 'vendor-state';
            return undefined;
          },
        },
      },
    },
  };
});
