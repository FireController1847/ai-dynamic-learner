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

const rawBaseUrl = process.env.PAGES_BASE_URL ?? '';
let baseUrl = null;
if (rawBaseUrl) {
  baseUrl = new URL(rawBaseUrl);
  if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.search || baseUrl.hash) {
    throw new Error('PAGES_BASE_URL must be an HTTP(S) URL without a query string or fragment.');
  }
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/+$/, '')}/`;
}

const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));
const escapeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

const template = await readFile(new URL('src/html/index.html', root), 'utf8');
for (const marker of [
  '<base href="/">',
  '<title></title>',
  '<meta name="description" content="">',
  '<meta name="application-name" content="">',
  '<meta property="og:site_name" content="">',
  '<meta property="og:title" content="">',
  '<meta property="og:description" content="">',
  '<meta name="twitter:title" content="">',
  '<meta name="twitter:description" content="">',
  '<!-- page-url-meta -->',
  '<!-- page-structured-data -->',
]) {
  if (!template.includes(marker)) throw new Error(`The HTML template is missing required metadata marker: ${marker}`);
}

const routes = ['/', ...featureDefinitions.map((feature) => feature.path)];
for (const route of routes) {
  if (!/^\/(?:[a-z0-9-]+\/)*$/.test(route)) throw new Error(`Unsupported page route: ${route}`);
}

function pageMetadata(route) {
  const feature = featureDefinitions.find((candidate) => candidate.path === route);
  const title = feature ? `${feature.label} · ${appConfig.name}` : appConfig.name;
  const description = feature?.description ?? appConfig.description;
  const canonicalUrl = baseUrl ? new URL(route.slice(1), baseUrl).href : null;
  const siteUrl = baseUrl?.href ?? null;

  const structuredData = feature ? {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    ...(canonicalUrl ? { url: canonicalUrl } : {}),
    ...(siteUrl ? {
      isPartOf: { '@type': 'WebSite', name: appConfig.name, url: siteUrl },
    } : {}),
  } : {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: appConfig.name,
    description,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Any',
    ...(canonicalUrl ? { url: canonicalUrl } : {}),
  };

  return { title, description, canonicalUrl, structuredData };
}

function renderPage(route) {
  const { title, description, canonicalUrl, structuredData } = pageMetadata(route);
  const urlMeta = canonicalUrl
    ? `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">\n    <meta property="og:url" content="${escapeHtml(canonicalUrl)}">`
    : '';
  const jsonLd = `<script type="application/ld+json">${escapeJson(structuredData)}</script>`;

  return template
    .replace('<base href="/">', `<base href="${escapeHtml(basePath)}">`)
    .replace('<title></title>', `<title>${escapeHtml(title)}</title>`)
    .replace('<meta name="description" content="">',
      `<meta name="description" content="${escapeHtml(description)}">`)
    .replace('<meta name="application-name" content="">',
      `<meta name="application-name" content="${escapeHtml(appConfig.name)}">`)
    .replace('<meta property="og:site_name" content="">',
      `<meta property="og:site_name" content="${escapeHtml(appConfig.name)}">`)
    .replace('<meta property="og:title" content="">',
      `<meta property="og:title" content="${escapeHtml(title)}">`)
    .replace('<meta property="og:description" content="">',
      `<meta property="og:description" content="${escapeHtml(description)}">`)
    .replace('<meta name="twitter:title" content="">',
      `<meta name="twitter:title" content="${escapeHtml(title)}">`)
    .replace('<meta name="twitter:description" content="">',
      `<meta name="twitter:description" content="${escapeHtml(description)}">`)
    .replace('<!-- page-url-meta -->', urlMeta)
    .replace('<!-- page-structured-data -->', jsonLd);
}

// Package only browser assets, not the repository, docs, server, or workspace backups.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL('LICENSE', root), new URL('LICENSE', output));
for (const directory of ['app', 'assets', 'core', 'components', 'features', 'styles']) {
  await cp(new URL(`src/${directory}/`, root), new URL(`src/${directory}/`, output), { recursive: true });
}
for (const route of routes) {
  const destination = new URL(route.slice(1), output);
  await mkdir(destination, { recursive: true });
  await writeFile(new URL('index.html', destination), renderPage(route));
}
await writeFile(new URL('.nojekyll', output), '');
await writeFile(new URL('404.html', output), `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Page not found</title><main><h1>Page not found</h1><a href="${escapeHtml(basePath)}">Return to ${escapeHtml(appConfig.name)}</a></main></html>\n`);
console.log(`Pages files prepared in ${fileURLToPath(output)} for ${basePath}`);
