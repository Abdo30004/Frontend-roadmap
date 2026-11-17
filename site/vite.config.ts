import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react()
  ],
  resolve: { alias: { '@content': path.resolve(__dirname, '../content') } },
  server: { 
    fs: { allow: [path.resolve(__dirname, '..')] },
    allowedHosts : ["73f9-105-235-131-176.ngrok-free.app"]
  },
});
