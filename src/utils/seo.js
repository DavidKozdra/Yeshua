import { getBookById, getTranslationById } from './bibleData.js';
import { BOOKS_TAB_COLLECTIONS, getBooksCollectionById, getBooksWorkById } from './booksData.js';
import {
  getSharedVerseMetadataFromSearchParams,
  getVerseTargetFromSearchParams,
} from './verseSharing.js';

export const SITE_NAME = 'Yeshua';
export const SITE_URL = 'https://readyeshua.com';
export const DEFAULT_IMAGE = `${SITE_URL}/icon-512.png`;
export const DEFAULT_TITLE = 'Yeshua | Offline Bible, Scripture Reader, and Study Library';
export const DEFAULT_DESCRIPTION =
  'Yeshua is an offline-first Bible and Scripture reading app with multiple translations, study notes, search, holy day awareness, and a growing spiritual library.';

export const STATIC_SEO_ROUTES = [
  {
    path: '/',
    title: DEFAULT_TITLE,
    description:
      'Read Scripture offline with Bible translations, notes, search, holy day awareness, and a broader study library in one installable app.',
    breadcrumbs: [{ name: 'Home', path: '/' }],
    changefreq: 'weekly',
    priority: '1.0',
  },
  {
    path: '/read',
    title: formatTitle('Read Scripture'),
    description:
      'Open the offline Bible reader to continue reading Scripture with your default translation, notes, and study tools.',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Read', path: '/read' },
    ],
    changefreq: 'weekly',
    priority: '0.9',
  },
  {
    path: '/translations',
    title: formatTitle('Library'),
    description:
      'Manage Bible translations, reader-library downloads, and linked external sources from the Yeshua library.',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Library', path: '/translations' },
    ],
    changefreq: 'weekly',
    priority: '0.9',
  },
  {
    path: '/books',
    title: formatTitle('Library'),
    description:
      "Browse the Yeshua library for Bible-adjacent collections like the Qur'an, Apocrypha, and linked source libraries.",
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Library', path: '/books' },
    ],
    changefreq: 'weekly',
    priority: '0.7',
  },
  {
    path: '/search',
    title: formatTitle('Search Scripture'),
    description:
      'Search Scripture across offline Bible translations and jump directly to matching verses.',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Search', path: '/search' },
    ],
    changefreq: 'weekly',
    priority: '0.8',
  },
  {
    path: '/notes',
    title: formatTitle('Notes'),
    description:
      'Review general study notes and Scripture-linked notes saved while reading in Yeshua.',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Notes', path: '/notes' },
    ],
    changefreq: 'monthly',
    priority: '0.7',
  },
  {
    path: '/settings',
    title: formatTitle('Settings'),
    description:
      'Adjust theme, accessibility, reading preferences, holy day options, and other Yeshua app settings.',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Settings', path: '/settings' },
    ],
    changefreq: 'monthly',
    priority: '0.5',
  },
];

export function formatTitle(title) {
  return title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
}

export function buildBreadcrumbList(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export function buildWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: DEFAULT_IMAGE,
  };
}

function escapeHtmlAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function replaceTag(html, pattern, replacement) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html;
}

function renderJsonLdScript(id, payload) {
  return `<script id="${id}" type="application/ld+json">${JSON.stringify(payload).replaceAll('<', '\\u003c')}</script>`;
}

export function renderSeoHtml(template, seo) {
  const title = escapeHtmlAttribute(seo.title);
  const description = escapeHtmlAttribute(seo.description);
  const canonicalUrl = escapeHtmlAttribute(seo.canonicalUrl);
  const imageUrl = escapeHtmlAttribute(seo.imageUrl || DEFAULT_IMAGE);
  const imageAlt = escapeHtmlAttribute(seo.imageAlt || 'Yeshua app icon');

  let html = template;

  html = replaceTag(html, /<title>.*?<\/title>/s, `<title>${title}</title>`);
  html = replaceTag(
    html,
    /<meta\s+name="description"[\s\S]*?\/>/,
    `<meta name="description" content="${description}" />`
  );
  html = replaceTag(
    html,
    /<link rel="canonical" href="[^"]*"\s*\/>/,
    `<link rel="canonical" href="${canonicalUrl}" />`
  );
  html = replaceTag(
    html,
    /<meta\s+property="og:title"[\s\S]*?\/>/,
    `<meta property="og:title" content="${title}" />`
  );
  html = replaceTag(
    html,
    /<meta\s+property="og:description"[\s\S]*?\/>/,
    `<meta property="og:description" content="${description}" />`
  );
  html = replaceTag(
    html,
    /<meta\s+property="og:url"[\s\S]*?\/>/,
    `<meta property="og:url" content="${canonicalUrl}" />`
  );
  html = replaceTag(
    html,
    /<meta\s+property="og:image"[\s\S]*?\/>/,
    `<meta property="og:image" content="${imageUrl}" />`
  );
  html = replaceTag(
    html,
    /<meta\s+property="og:image:alt"[\s\S]*?\/>/,
    `<meta property="og:image:alt" content="${imageAlt}" />`
  );
  html = replaceTag(
    html,
    /<meta\s+name="twitter:title"[\s\S]*?\/>/,
    `<meta name="twitter:title" content="${title}" />`
  );
  html = replaceTag(
    html,
    /<meta\s+name="twitter:description"[\s\S]*?\/>/,
    `<meta name="twitter:description" content="${description}" />`
  );
  html = replaceTag(
    html,
    /<meta\s+name="twitter:image"[\s\S]*?\/>/,
    `<meta name="twitter:image" content="${imageUrl}" />`
  );

  html = replaceTag(
    html,
    /<script id="seo-website-jsonld" type="application\/ld\+json">.*?<\/script>/s,
    renderJsonLdScript('seo-website-jsonld', buildWebsiteSchema())
  );
  html = replaceTag(
    html,
    /<script id="seo-organization-jsonld" type="application\/ld\+json">.*?<\/script>/s,
    renderJsonLdScript('seo-organization-jsonld', buildOrganizationSchema())
  );
  html = replaceTag(
    html,
    /<script id="seo-breadcrumb-jsonld" type="application\/ld\+json">.*?<\/script>/s,
    renderJsonLdScript('seo-breadcrumb-jsonld', buildBreadcrumbList(seo.breadcrumbs))
  );

  return html;
}

export function getStaticSitemapEntries(lastmod = null) {
  const entries = STATIC_SEO_ROUTES.map((route) => ({
    path: route.path,
    changefreq: route.changefreq,
    priority: route.priority,
    lastmod,
  }));

  const collectionEntries = BOOKS_TAB_COLLECTIONS.flatMap((collection) => {
    const items = [
      {
        path: `/books/${collection.id}`,
        changefreq: 'monthly',
        priority: '0.6',
        lastmod,
      },
    ];

    if (collection.kind === 'reader') {
      const defaultWorkId = collection.defaultWorkId || collection.works?.[0]?.id;
      if (defaultWorkId) {
        items.push({
          path: `/books/${collection.id}/${defaultWorkId}/1`,
          changefreq: 'monthly',
          priority: '0.5',
          lastmod,
        });
      }
    }

    return items;
  });

  return [...entries, ...collectionEntries];
}

export function getSeoState({ pathname, search = '' }) {
  const searchParams = new URLSearchParams(search);
  const segments = pathname.split('/').filter(Boolean);

  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  let canonicalPath = pathname || '/';
  let canonicalSearch = '';
  let breadcrumbs = [{ name: 'Home', path: '/' }];

  const staticRoute = STATIC_SEO_ROUTES.find((route) => route.path === canonicalPath);
  if (staticRoute) {
    return {
      title: staticRoute.title,
      description: staticRoute.description,
      canonicalUrl: `${SITE_URL}${canonicalPath}`,
      breadcrumbs: staticRoute.breadcrumbs,
    };
  }

  if (segments[0] === 'read' && segments.length >= 4) {
    const translation = getTranslationById(segments[1]);
    const book = getBookById(segments[2]);
    const chapter = segments[3];
    const verse = getVerseTargetFromSearchParams(searchParams);
    const sharedVerse = getSharedVerseMetadataFromSearchParams(searchParams);
    const computedReference = `${book?.name || segments[2]} ${chapter}${verse ? `:${verse}` : ''}`;
    const reference = sharedVerse.reference || computedReference;
    canonicalSearch = verse ? `?verse=${verse}` : '';
    title = formatTitle(sharedVerse.reference ? reference : `${reference}${translation ? ` in ${translation.abbreviation}` : ''}`);
    description = sharedVerse.text || (verse
      ? `Read ${reference}${translation ? ` in the ${translation.name}` : ''} with offline access, notes, and study tools in Yeshua.`
      : `Read ${book?.name || segments[2]} chapter ${chapter}${
          translation ? ` in the ${translation.name}` : ''
        } with offline access, notes, and study tools in Yeshua.`);
    breadcrumbs = [
      { name: 'Home', path: '/' },
      { name: 'Read', path: '/read' },
      { name: reference, path: `${canonicalPath}${canonicalSearch}` },
    ];
  } else if (segments[0] === 'books' && segments.length >= 2) {
    const collection = getBooksCollectionById(segments[1]);
    const work = segments[2] ? getBooksWorkById(segments[1], segments[2]) : null;
    const chapter = segments[3];
    title = formatTitle(
      work && chapter ? `${work.title} ${chapter}` : collection?.name || 'Library Reader'
    );
    description =
      work && chapter
        ? `Read ${work.title} chapter ${chapter} from the ${collection?.name || 'library'} in Yeshua.`
        : `Browse ${collection?.name || 'the library'} inside Yeshua's broader study collection.`;
    breadcrumbs = [
      { name: 'Home', path: '/' },
      { name: 'Library', path: '/translations' },
    ];

    if (collection) {
      breadcrumbs.push({ name: collection.name, path: `/books/${collection.id}` });
    }

    if (work && chapter) {
      breadcrumbs.push({ name: `${work.title} ${chapter}`, path: canonicalPath });
    }
  } else if (pathname === '/search') {
    const query = searchParams.get('q')?.trim();
    title = formatTitle(query ? `Search: ${query}` : 'Search Scripture');
    description = query
      ? `Search Bible text for "${query}" across offline translations in Yeshua.`
      : 'Search Scripture across offline Bible translations and jump directly to matching verses.';
    breadcrumbs = [
      { name: 'Home', path: '/' },
      { name: 'Search', path: '/search' },
    ];
  }

  return {
    title,
    description,
    canonicalUrl: `${SITE_URL}${canonicalPath}${canonicalSearch}`,
    breadcrumbs,
    imageAlt: title.replace(/ \| Yeshua$/, ''),
  };
}
