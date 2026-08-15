import { docs } from 'collections/server';
import { loader, type StaticSource } from 'fumadocs-core/source';
import { docsContentRoute, docsRoute } from './shared';
import { i18n } from './i18n';

// See https://fumadocs.dev/docs/headless/source-api for more info
const docsSource = docs.toFumadocsSource() as StaticSource<{
  pageData: (typeof docs.docs)[number];
  metaData: (typeof docs.meta)[number];
}>;

export const source = loader<typeof docsSource, typeof i18n>(docsSource, {
  baseUrl: docsRoute,
  i18n,
  plugins: [],
});

export function getPageMarkdownUrl(page: (typeof source)['$inferPage']) {
  const segments = [...page.slugs, 'content.md'];
  const locale = page.locale === i18n.defaultLanguage ? '' : `?locale=${page.locale}`;

  return {
    segments,
    url: `${docsContentRoute}/${segments.join('/')}${locale}`,
  };
}

export async function getLLMText(page: (typeof source)['$inferPage']) {
  const processed = await page.data.getText('processed');

  return `# ${page.data.title} (${page.url})

${processed}`;
}
