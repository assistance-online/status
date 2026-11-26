// Adds ?v=<version> to the site's own scripts and stylesheets in the published HTML pages. GitHub Pages
// lets browsers cache them for 10 minutes; without the stamp a visitor could combine a new main.js with
// an old i18n.js right after a deployment.
// Usage: node .github/scripts/stamp-assets.mjs <site-directory> <version>
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function stampAssets(html, version) {
    return html.replace(/((?:src|href)="(?:scripts|stylesheets|vendor)\/[^"?]+\.(?:js|css))"/g,
        (match, url) => `${url}?v=${encodeURIComponent(version)}"`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const [directory = '.', version = Date.now().toString(36)] = process.argv.slice(2);
    const pages = (await readdir(directory)).filter(name => name.endsWith('.html'));
    for (const page of pages) {
        const path = join(directory, page);
        await writeFile(path, stampAssets(await readFile(path, 'utf8'), version));
    }
    console.log(`Stamped ${pages.length} pages with version ${version}`);
}
