import * as esbuild from 'esbuild';
import { copyFileSync, cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

mkdirSync(resolve(root, 'www/js'), { recursive: true });
mkdirSync(resolve(root, 'www/data'), { recursive: true });

await esbuild.build({
    entryPoints: [resolve(root, 'src/domain/index.js')],
    bundle: true,
    format: 'iife',
    outfile: resolve(root, 'www/js/domain.bundle.js'),
    target: ['es2020'],
    logLevel: 'info'
});

await esbuild.build({
    entryPoints: [resolve(root, 'src/app/index.js')],
    bundle: true,
    format: 'iife',
    outfile: resolve(root, 'www/js/app.bundle.js'),
    target: ['es2020'],
    logLevel: 'info'
});

copyFileSync(resolve(root, 'index.html'), resolve(root, 'www/index.html'));
cpSync(resolve(root, 'data/clp-tariff.json'), resolve(root, 'www/data/clp-tariff.json'));
cpSync(resolve(root, 'data/hke-tariff.json'), resolve(root, 'www/data/hke-tariff.json'));
if (existsSync(resolve(root, 'data/meels-index.json'))) {
    cpSync(resolve(root, 'data/meels-index.json'), resolve(root, 'www/data/meels-index.json'));
}
copyFileSync(
    resolve(root, 'node_modules/@capacitor/core/dist/capacitor.js'),
    resolve(root, 'www/capacitor.js')
);

console.log('www build complete');