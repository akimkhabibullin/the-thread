import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

const bridge = 'http://127.0.0.1:5299';
export default defineConfig({
  plugins: [react()],
  server: {port: 5280, strictPort: true, proxy: {'/api': bridge, '/ws': {target: bridge, ws: true}}},
});
