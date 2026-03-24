import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  DEFAULT_IMAGE,
  buildBreadcrumbList,
  buildOrganizationSchema,
  buildWebsiteSchema,
  getSeoState,
} from '../utils/seo';

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
