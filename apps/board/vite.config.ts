import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { buildIdPlugin } from '@casillego/ui/vite-build-id';

export default defineConfig({
  plugins: [buildIdPlugin(), react()],
  server: {
    port: 5175,
  },
});
