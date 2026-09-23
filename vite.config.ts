import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Replit / sandboxed previews serve the dev server under a proxied host.
// host 0.0.0.0 + explicit allowedHosts keeps the preview working.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 5000,
    strictPort: false,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.localhost',
      '.e2b.app',
      '.replit.dev',
      '.repl.co',
      '.picard.replit.dev',
      '.worf.replit.dev',
      '.kirk.replit.dev',
      '.janeway.replit.dev',
    ],
  },
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 5000,
    strictPort: false,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.localhost',
      '.e2b.app',
      '.replit.dev',
      '.repl.co',
    ],
  },
});
