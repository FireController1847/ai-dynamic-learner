import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { featureDefinitions } from '../../src/features/feature-definitions.js';
import { appConfig } from '../../src/app/app-config.js';

const root = new URL('../../', import.meta.url);
const output = new URL('dist/', root);
const rawBase = process.env.PAGES_BASE_PATH ?? '';
if (rawBase && (!rawBase.startsWith('/') || rawBase.startsWith('//') ||
    /[?#\\\s]/.test(rawBase) || rawBase.split('/').some((part) => part === '.' || part === '..'))) {
  throw new Error('PAGES_BASE_PATH must be an absolute URL path, such as /dynamic-learner.');
}
const basePath = `${rawBase.replace(/\/+$/, '')}/`;
const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));
const template = await readFile(new URL('src/html/index.html', root), 'utf8');
if (!template.includes('<base href="/">')) throw new Error('The HTML template needs its base-path marker.');
const html = template.replace('<base href="/">', `<base href="${escapeHtml(basePath)}">`)
  .replace('<title></title>', `<title>${escapeHtml(appConfig.name)}</title>`);
const routes = ['/', ...featureDefinitions.map((feature) => feature.path)];
for (const route of routes) {
  if (!/^\/(?:[a-z0-9-]+\/)*$/.test(route)) throw new Error(`Unsupported page route: ${route}`);
}

// Package only browser assets, not the repository, docs, server, or workspace backups.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const directory of ['app', 'core', 'components', 'features', 'styles']) {
  await cp(new URL(`src/${directory}/`, root), new URL(`src/${directory}/`, output), { recursive: true });
}
for (const route of routes) {
  const destination = new URL(route.slice(1), output);
  await mkdir(destination, { recursive: true });
  await writeFile(new URL('index.html', destination), html);
}
await writeFile(new URL('.nojekyll', output), '');
await writeFile(new URL('404.html', output), `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found</title><main><h1>Page not found</h1><a href="${escapeHtml(basePath)}">Return to ${escapeHtml(appConfig.name)}</a></main></html>\n`);
console.log(`Pages files prepared in ${fileURLToPath(output)} for ${basePath}`);
