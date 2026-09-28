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

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));
const escapeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
const meta = (name, content, property = false) =>
  `<meta ${property ? 'property' : 'name'}="${escapeHtml(name)}" content="${escapeHtml(content)}">`;

const template = await readFile(new URL('src/html/index.html', root), 'utf8');
for (const marker of [
  '<base href="/">',
  '<title></title>',
  '<!-- page-rich-metadata -->',
  '<!-- page-structured-data -->',
]) {
  if (!template.includes(marker)) throw new Error(`The HTML template is missing required metadata marker: ${marker}`);
}

const routes = ['/', ...featureDefinitions.map((feature) => feature.path)];
for (const route of routes) {
  if (!/^\/(?:[a-z0-9-]+\/)*$/.test(route)) throw new Error(`Unsupported page route: ${route}`);
}

function absoluteUrl(path) {
  return baseUrl ? new URL(path.replace(/^\//, ''), baseUrl).href : null;
}

function pageMetadata(route) {
  const feature = featureDefinitions.find((candidate) => candidate.path === route);
  const overrides = feature?.metadata ?? {};
  const title = overrides.title ?? (feature ? `${feature.label} · ${appConfig.name}` : appConfig.name);
  const description = overrides.description ?? feature?.description ?? appConfig.description;
  const canonicalUrl = baseUrl ? new URL(route.slice(1), baseUrl).href : null;
  const siteUrl = baseUrl?.href ?? null;
  const keywords = [...new Set([
    ...appConfig.metadata.keywords,
    ...(feature ? [feature.label] : []),
    ...(overrides.keywords ?? []),
  ])];

  const socialImage = {
    ...appConfig.metadata.socialImage,
    ...(overrides.socialImage ?? {}),
  };
  const socialImageUrl = absoluteUrl(socialImage.path);

  const structuredData = feature ? {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    inLanguage: appConfig.metadata.language,
    keywords: keywords.join(', '),
    ...(canonicalUrl ? { url: canonicalUrl } : {}),
    ...(socialImageUrl ? { primaryImageOfPage: {
      '@type': 'ImageObject',
      url: socialImageUrl,
      width: socialImage.width,
      height: socialImage.height,
    } } : {}),
    ...(siteUrl ? {
      isPartOf: { '@type': 'WebSite', name: appConfig.name, url: siteUrl },
    } : {}),
  } : {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: appConfig.name,
    description,
    inLanguage: appConfig.metadata.language,
    applicationCategory: appConfig.metadata.applicationCategory,
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript and a modern web browser.',
    isAccessibleForFree: true,
    keywords: keywords.join(', '),
    ...(canonicalUrl ? { url: canonicalUrl } : {}),
    ...(socialImageUrl ? { image: socialImageUrl } : {}),
  };

  return { title, description, canonicalUrl, keywords, socialImage, socialImageUrl, structuredData };
}

function renderRichMetadata(metadata) {
  const { title, description, canonicalUrl, keywords, socialImage, socialImageUrl } = metadata;
  const tags = [
    meta('description', description),
    meta('keywords', keywords.join(', ')),
    meta('application-name', appConfig.name),
    meta('theme-color', appConfig.metadata.themeColor),
    meta('msapplication-TileColor', appConfig.metadata.themeColor),
    meta('color-scheme', 'light'),
    meta('referrer', 'strict-origin-when-cross-origin'),
    meta('format-detection', 'telephone=no'),
    meta('apple-mobile-web-app-title', appConfig.name),
    meta('og:type', 'website', true),
    meta('og:site_name', appConfig.name, true),
    meta('og:title', title, true),
    meta('og:description', description, true),
    meta('og:locale', appConfig.metadata.locale, true),
    meta('twitter:card', appConfig.metadata.twitterCard),
    meta('twitter:title', title),
    meta('twitter:description', description),
  ];

  if (canonicalUrl) {
    tags.push(`<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`);
    tags.push(meta('og:url', canonicalUrl, true));
  }

  if (socialImageUrl) {
    tags.push(
      meta('og:image', socialImageUrl, true),
      meta('og:image:secure_url', socialImageUrl, true),
      meta('og:image:type', socialImage.type, true),
      meta('og:image:width', socialImage.width, true),
      meta('og:image:height', socialImage.height, true),
      meta('og:image:alt', socialImage.alt, true),
      meta('twitter:image', socialImageUrl),
      meta('twitter:image:alt', socialImage.alt),
    );
  }

  return tags.join('\n    ');
}

function renderPage(route) {
  const metadata = pageMetadata(route);
  const jsonLd = `<script type="application/ld+json">${escapeJson(metadata.structuredData)}</script>`;

  return template
    .replace('<base href="/">', `<base href="${escapeHtml(basePath)}">`)
    .replace('<title></title>', `<title>${escapeHtml(metadata.title)}</title>`)
    .replace('<!-- page-rich-metadata -->', renderRichMetadata(metadata))
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
