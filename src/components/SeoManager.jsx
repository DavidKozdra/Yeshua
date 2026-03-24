import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getBookById, getTranslationById } from '../utils/bibleData';
import { getBooksCollectionById, getBooksWorkById } from '../utils/booksData';

const SITE_NAME = 'Yeshua';
const SITE_URL = 'https://readyeshua.com';
const DEFAULT_TITLE = 'Yeshua | Offline Bible, Scripture Reader, and Study Library';
const DEFAULT_DESCRIPTION =
  'Yeshua is an offline-first Bible and Scripture reading app with multiple translations, study notes, search, holy day awareness, and a growing spiritual library.';
const DEFAULT_IMAGE = `${SITE_URL}/icon-512.png`;

function upsertMeta(selector, attributes) {
  if (typeof document === 'undefined') return;

  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }

  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
}

function upsertLink(selector, attributes) {
  if (typeof document === 'undefined') return;

  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('link');
    document.head.appendChild(element);
  }

  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
}

function upsertJsonLd(id, payload) {
  if (typeof document === 'undefined') return;

  let element = document.head.querySelector(`#${id}`);
  if (!element) {
    element = document.createElement('script');
    element.type = 'application/ld+json';
    element.id = id;
    document.head.appendChild(element);
  }

  element.textContent = JSON.stringify(payload);
}

function formatTitle(title) {
  return title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
}

function buildBreadcrumbList(items) {
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

function buildWebsiteSchema() {
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

function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: DEFAULT_IMAGE,
  };
}

function getSeoState(location) {
  const pathname = location.pathname;
  const searchParams = new URLSearchParams(location.search);
  const segments = pathname.split('/').filter(Boolean);

  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  let canonicalPath = pathname || '/';
  let breadcrumbs = [{ name: 'Home', path: '/' }];

  if (pathname === '/') {
    title = DEFAULT_TITLE;
    description =
      'Read Scripture offline with Bible translations, notes, search, holy day awareness, and a broader study library in one installable app.';
  } else if (pathname === '/read') {
    title = formatTitle('Read Scripture');
    description =
      'Open the offline Bible reader to continue reading Scripture with your default translation, notes, and study tools.';
    breadcrumbs.push({ name: 'Read', path: '/read' });
  } else if (segments[0] === 'read' && segments.length >= 4) {
    const translation = getTranslationById(segments[1]);
    const book = getBookById(segments[2]);
    const chapter = segments[3];
    title = formatTitle(
      `${book?.name || segments[2]} ${chapter}${translation ? ` in ${translation.abbreviation}` : ''}`
    );
    description = `Read ${book?.name || segments[2]} chapter ${chapter}${
      translation ? ` in the ${translation.name}` : ''
    } with offline access, notes, and study tools in Yeshua.`;
    breadcrumbs.push({ name: 'Read', path: '/read' });
    breadcrumbs.push({
      name: `${book?.name || segments[2]} ${chapter}`,
      path: canonicalPath,
    });
  } else if (pathname === '/translations') {
    title = formatTitle('Library');
    description =
      'Manage Bible translations, reader-library downloads, and linked external sources from the Yeshua library.';
    breadcrumbs.push({ name: 'Library', path: '/translations' });
  } else if (pathname === '/books') {
    title = formatTitle('Library');
    description =
      "Browse the Yeshua library for Bible-adjacent collections like the Qur'an, Apocrypha, and linked source libraries.";
    breadcrumbs.push({ name: 'Library', path: '/books' });
  } else if (segments[0] === 'books' && segments.length >= 2) {
    const collection = getBooksCollectionById(segments[1]);
    const work = segments[2] ? getBooksWorkById(segments[1], segments[2]) : null;
    const chapter = segments[3];
    title = formatTitle(
      work && chapter
        ? `${work.title} ${chapter}`
        : collection?.name || 'Library Reader'
    );
    description = work && chapter
      ? `Read ${work.title} chapter ${chapter} from the ${collection?.name || 'library'} in Yeshua.`
      : `Browse ${collection?.name || 'the library'} inside Yeshua's broader study collection.`;
    breadcrumbs.push({ name: 'Library', path: '/translations' });
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
    breadcrumbs.push({ name: 'Search', path: '/search' });
  } else if (pathname === '/notes') {
    title = formatTitle('Notes');
    description =
      'Review general study notes and Scripture-linked notes saved while reading in Yeshua.';
    breadcrumbs.push({ name: 'Notes', path: '/notes' });
  } else if (pathname === '/settings') {
    title = formatTitle('Settings');
    description =
      'Adjust theme, accessibility, reading preferences, holy day options, and other Yeshua app settings.';
    breadcrumbs.push({ name: 'Settings', path: '/settings' });
  }

  return {
    title,
    description,
    canonicalUrl: `${SITE_URL}${canonicalPath}`,
    breadcrumbs,
  };
}

export default function SeoManager() {
  const location = useLocation();

  useEffect(() => {
    const seo = getSeoState(location);

    document.title = seo.title;
    upsertLink("link[rel='canonical']", { rel: 'canonical', href: seo.canonicalUrl });
    upsertMeta("meta[name='description']", { name: 'description', content: seo.description });
    upsertMeta("meta[property='og:title']", { property: 'og:title', content: seo.title });
    upsertMeta("meta[property='og:description']", {
      property: 'og:description',
      content: seo.description,
    });
    upsertMeta("meta[property='og:url']", { property: 'og:url', content: seo.canonicalUrl });
    upsertMeta("meta[property='og:image']", { property: 'og:image', content: DEFAULT_IMAGE });
    upsertMeta("meta[name='twitter:title']", { name: 'twitter:title', content: seo.title });
    upsertMeta("meta[name='twitter:description']", {
      name: 'twitter:description',
      content: seo.description,
    });
    upsertMeta("meta[name='twitter:image']", {
      name: 'twitter:image',
      content: DEFAULT_IMAGE,
    });

    upsertJsonLd('seo-website-jsonld', buildWebsiteSchema());
    upsertJsonLd('seo-organization-jsonld', buildOrganizationSchema());
    upsertJsonLd('seo-breadcrumb-jsonld', buildBreadcrumbList(seo.breadcrumbs));
  }, [location]);

  return null;
}
