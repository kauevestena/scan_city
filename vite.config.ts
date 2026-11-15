import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Pré-empacota as dependências na partida do dev server, para a primeira carga não
  // disparar uma reotimização (e um recarregamento) no meio do boot.
  optimizeDeps: {
    include: [
      'react',
      'react/jsx-runtime',
      'react-dom',
      'react-dom/client',
      'zustand',
      'zustand/middleware',
      'lucide-react',
    ],
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});
