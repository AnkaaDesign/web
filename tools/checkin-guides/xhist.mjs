/* Sonda de uma pergunta só: sobrou friso na pele depois de `flattenRibs()`?
   Um valor de X por lado = chapa lisa. Vários = achatamento incompleto. */
import { openBench } from './harness.mjs';
const { page, close } = await openBench('guide-rig.ts', { width: 400, height: 300 });
const h = await page.evaluate('window.__xhist()');
for (const [x, n] of h) console.log(String(x).padStart(9), n);
await close();
