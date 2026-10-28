import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({
 build:{rollupOptions:{input:{
  admin:fileURLToPath(new URL('./index.html',import.meta.url)),
  comercio:fileURLToPath(new URL('./comercio.html',import.meta.url))
 }}}
});
