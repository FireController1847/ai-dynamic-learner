import { featureDefinitions } from '../src/features/feature-definitions.ts';

export interface SiteConfig {
  basePath: string;
  baseUrl: URL | null;
  routes: string[];
}

export function siteConfig(env: Record<string, string | undefined> = process.env): SiteConfig {
  const rawBase = env.PAGES_BASE_PATH ?? '';
  if (rawBase && (!rawBase.startsWith('/') || rawBase.startsWith('//') ||
      /[?#\\\s%]/.test(rawBase) || rawBase.split('/').some((part) => part === '.' || part === '..'))) {
    throw new Error('PAGES_BASE_PATH must be an absolute URL path, such as /dynamic-learner.');
  }
  const basePath = `${rawBase.replace(/\/+$/, '')}/`;

  const rawBaseUrl = env.PAGES_BASE_URL ?? '';
  let baseUrl: URL | null = null;
  if (rawBaseUrl) {
    baseUrl = new URL(rawBaseUrl);
    if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.search || baseUrl.hash) {
      throw new Error('PAGES_BASE_URL must be an HTTP(S) URL without a query string or fragment.');
    }
    baseUrl.pathname = `${baseUrl.pathname.replace(/\/+$/, '')}/`;
    if (baseUrl.pathname !== basePath) {
      throw new Error('PAGES_BASE_URL must have the same path as PAGES_BASE_PATH.');
    }
  }

  const routes = ['/', ...featureDefinitions.map((feature) => feature.path)];
  if (new Set(routes).size !== routes.length || routes.some((route) => !/^\/(?:[a-z0-9-]+\/)*$/.test(route))) {
    throw new Error('Feature routes must be unique, canonical slash-terminated paths.');
  }
  return { basePath, baseUrl, routes };
}
