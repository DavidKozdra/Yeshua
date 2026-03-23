# Yeshua

Yeshua is an offline-first Scripture reading app built as a Progressive Web App. It combines Bible reading, translation downloads, study notes, search, holy day awareness, and a growing library of related religious texts in a single installable interface.

Live site: [readyeshua.com](https://readyeshua.com/)  

<img width="2460" height="1516" alt="Yeshua application screenshot" src="https://github.com/user-attachments/assets/f3db9388-fd50-4103-8a01-d1c1238813e0" />

## What It Does

- Reads Scripture with an offline-friendly Bible reader
- Saves downloaded chapters locally for offline use
- Supports multiple Bible translations
- Includes verse-linked and general study notes
- Provides search across Scripture
- Adds holy day reminders and banners
- Includes a separate Library area for Bible-adjacent collections
- Installs as a PWA with offline caching and app shortcuts

## Main Areas

- `Read`: Bible reading, chapter navigation, text-to-speech, verse notes, and red-letter options
- `Library`: Apocrypha, Qur'an, and linked external collections
- `Notes`: General notes plus notes attached to specific verses
- `Translations`: Download and manage offline Bible translations
- `Settings`: Reader preferences, accessibility, holy day options, and theme controls

## Tech Stack

- React 19
- Vite 8
- React Router 7
- IndexedDB via `idb`
- `vite-plugin-pwa`
- Lucide icons

## Development

Requirements:

- Node.js `22.x`
- npm `10.9.4`

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Preview the built app locally:

```bash
npm run preview
```

Serve the production build with the included Node server:

```bash
npm run start
```

The production server serves the `dist/` output and falls back to `index.html` for client-side routes.

## Offline Behavior

Yeshua is designed to work well offline:

- the app shell is cached as a PWA
- the bundled KJV content is shipped with the app
- downloaded chapters are stored locally in IndexedDB
- supported remote text sources are cached for reuse

Some non-Bible library content depends on public upstream sources. If a source is incomplete upstream, the app may need a source-specific fallback or may report that a chapter is unavailable.

## Project Goal

The project aims to provide a focused, installable reading experience for Scripture and related study material without requiring users to stay constantly online.
