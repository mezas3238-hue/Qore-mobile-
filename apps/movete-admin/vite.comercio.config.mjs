/**
 * G230 independent merchant web distribution. The sole HTML entry point is
 * comercio.html; the privileged Admin main.tsx is never included. No deploy.
 */
import {defineConfig} from 'vite';
import {rename,readFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=dirname(fileURLToPath(import.meta.url));
const output=resolve(root,'dist-comercio');
export default defineConfig({
 base:'./',
 build:{
  outDir:output,
  emptyOutDir:true,
  rollupOptions:{input:resolve(root,'comercio.html')}
 },
 plugins:[{
  name:'qore-merchant-standalone-entry',
  apply:'build',
  async closeBundle(){
   // Standalone host serves /index.html; never publish the Admin index.
   const source=resolve(output,'comercio.html');
   const html=await readFile(source,'utf8');
   if(!html.includes('id="merchant-root"')||
      html.includes('id="root"')||
      html.includes('/src/main.tsx'))
    throw Error('Merchant output is not isolated from Admin');
   await rename(source,resolve(output,'index.html'));
  }
 }]
});
