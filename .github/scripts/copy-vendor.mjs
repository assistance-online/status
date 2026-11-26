// Copies the stylesheets and fonts the pages use from node_modules into <site-directory>/vendor, so the
// status page does not depend on a CDN and Dependabot keeps these versions up to date.
// Usage: node .github/scripts/copy-vendor.mjs <site-directory>
import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const modules = join(dirname(fileURLToPath(import.meta.url)), 'node_modules');
const vendor = join(process.argv[2] ?? '.', 'vendor');

const files = [
    ['bootstrap/dist/css/bootstrap.min.css', 'bootstrap/bootstrap.min.css'],
    ['bootstrap/dist/css/bootstrap.min.css.map', 'bootstrap/bootstrap.min.css.map'],
    // all.min.css refers to its fonts as ../webfonts/, so keep that structure.
    ['@fortawesome/fontawesome-free/css/all.min.css', 'fontawesome/css/all.min.css'],
    ['@fortawesome/fontawesome-free/webfonts', 'fontawesome/webfonts']
];

for (const [source, target] of files) {
    await mkdir(dirname(join(vendor, target)), { recursive: true });
    await cp(join(modules, source), join(vendor, target), { recursive: true });
}
console.log(`Copied Bootstrap and Font Awesome to ${vendor}`);
