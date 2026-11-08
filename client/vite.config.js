import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const ngrokHost = String(env.NGROK_HOST || '').trim().toLowerCase();

  return {
    plugins: [react()],
    server: {
      // Bind to all local interfaces for access from devices on the same Wi-Fi.
      host: env.VITE_HOST || '0.0.0.0',
      port: Number(env.VITE_PORT || 5173),
      // Retain Vite host protection; only add an explicit ngrok host when configured.
      ...(ngrokHost ? { allowedHosts: [ngrokHost] } : {}),
    },
  };
});
