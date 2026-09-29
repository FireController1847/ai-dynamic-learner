import { featureDefinitions } from '../src/features/feature-definitions.js';
import { appConfig } from '../src/app/app-config.js';

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));
const escapeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
const meta = (name, content, property = false) =>
  `<meta ${property ? 'property' : 'name'}="${escapeHtml(name)}" content="${escapeHtml(content)}">`;

function absoluteUrl(path, baseUrl) {
  return baseUrl ? new URL(path.replace(/^\//, ''), baseUrl).href : null;
}

function pageMetadata(route, baseUrl) {
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
  const socialImageUrl = absoluteUrl(socialImage.path, baseUrl);

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

export function pageTemplateData(route, { basePath, baseUrl }) {
  const metadata = pageMetadata(route, baseUrl);
  return {
    basePath: escapeHtml(basePath),
    title: escapeHtml(metadata.title),
    richMetadata: renderRichMetadata(metadata),
    structuredData: `<script type="application/ld+json">${escapeJson(metadata.structuredData)}</script>`,
  };
}

export function notFoundPage(basePath) {
  return `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Page not found</title><main><h1>Page not found</h1><a href="${escapeHtml(basePath)}">Return to ${escapeHtml(appConfig.name)}</a></main></html>\n`;
}
