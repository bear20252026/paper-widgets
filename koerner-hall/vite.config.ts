import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The three hall models live in public/gstatic-koerner, so a build never reaches the network.

const hallConfig = {
  port: 3000,
  host: '0.0.0.0',
  allowedHosts: true,
};

export default defineConfig({
  plugins: [react()],
  server: hallConfig,
  preview: hallConfig,
});
