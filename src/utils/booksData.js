const BIBLE_API_ROOT = 'https://raw.githubusercontent.com/wldeh/bible-api/main/bibles';

const APOCRYPHA_WORKS = [
  {
    id: 'tobit',
    title: 'Tobit',
    subtitle: 'Deuterocanonical history',
    reference: 'Tobit',
    description: 'Wisdom, exile, family faithfulness, and providence.',
    chapters: 14,
    source: {
      provider: 'bible-api',
      apiSource: `${BIBLE_API_ROOT}/en-US-kjvcpb/books`,
      bookPath: 'tobit',
      sourceLabel: 'Cambridge Paragraph Bible',
    },
  },
  {
    id: 'judith',
    title: 'Judith',
    subtitle: 'Deliverance and courage',
    reference: 'Judith',
    description: 'A dramatic account of courage, prayer, and deliverance.',
    chapters: 16,
    source: {
      provider: 'bible-api',
      apiSource: `${BIBLE_API_ROOT}/en-US-kjvcpb/books`,
      bookPath: 'judith',
      sourceLabel: 'Cambridge Paragraph Bible',
    },
  },
  {
    id: 'wisdom-of-solomon',
    title: 'Wisdom of Solomon',
    subtitle: 'Righteousness and immortality',
    reference: 'Wisdom',
    description: 'A wisdom book centered on righteousness, justice, and divine wisdom.',
    chapters: 19,
    source: {
      provider: 'bible-api',
      apiSource: `${BIBLE_API_ROOT}/en-US-kjvcpb/books`,
      bookPath: 'wisdomofsolomon',
      sourceLabel: 'Cambridge Paragraph Bible',
    },
  },
  {
    id: 'sirach',
    title: 'Sirach',
    subtitle: 'Ecclesiasticus',
    reference: 'Sirach',
    description: 'A long wisdom collection on virtue, humility, worship, and daily conduct.',
    chapters: 51,
    source: {
      provider: 'bible-api',
      apiSource: `${BIBLE_API_ROOT}/en-US-kjvcpb/books`,
      bookPath: 'ecclesiasticus',
      sourceLabel: 'Cambridge Paragraph Bible',
    },
  },
  {
    id: 'baruch',
    title: 'Baruch',
    subtitle: 'Confession and hope',
    reference: 'Baruch',
    description: 'Prayers of repentance and hope, including the wisdom hymn.',
    chapters: 6,
    source: {
      provider: 'bible-api',
      apiSource: `${BIBLE_API_ROOT}/en-engbrent/books`,
      bookPath: 'baruch',
      chapterOverrides: {
        6: {
          bookPath: 'epistleofjeremy',
          chapter: 1,
        },
      },
      sourceLabel: 'Brenton English Septuagint',
    },
  },
  {
    id: 'prayer-of-manasses',
    title: 'Prayer of Manasses',
    subtitle: 'Prayer of repentance',
    reference: 'Prayer of Manasses',
    description: 'A brief penitential prayer traditionally associated with King Manasseh.',
    chapters: 1,
    source: {
      provider: 'bible-api',
      apiSource: `${BIBLE_API_ROOT}/en-US-kjvcpb/books`,
      bookPath: 'prayerofmanasses',
      sourceLabel: 'Cambridge Paragraph Bible',
    },
  },
  {
    id: '1-esdras',
    title: '1 Esdras',
    subtitle: 'Historical retelling',
    reference: '1 Esdras',
    description: 'An alternate Greek retelling of Ezra-Nehemiah material.',
    chapters: 9,
    source: {
      provider: 'bible-api',
      apiSource: `${BIBLE_API_ROOT}/en-US-kjvcpb/books`,
      bookPath: '1esdras',
      sourceLabel: 'Cambridge Paragraph Bible',
    },
  },
  {
    id: '2-esdras',
    title: '2 Esdras',
    subtitle: 'Apocalyptic visions',
    reference: '2 Esdras',
    description: 'A visionary and apocalyptic work often grouped with the wider apocrypha.',
    chapters: 16,
    source: {
      provider: 'bible-api',
      apiSource: `${BIBLE_API_ROOT}/en-US-kjvcpb/books`,
      bookPath: '2esdras',
      sourceLabel: 'Cambridge Paragraph Bible',
    },
  },
  {
    id: 'song-of-the-three-holy-children',
    title: 'Song of the Three Holy Children',
    subtitle: 'Prayer and praise',
    reference: 'Song of the Three Holy Children',
    description: 'The prayer and song associated with the fiery furnace narrative.',
    chapters: 1,
    source: {
      provider: 'bible-api',
      apiSource: `${BIBLE_API_ROOT}/en-US-kjvcpb/books`,
      bookPath: 'songofthethreeholychildren',
      sourceLabel: 'Cambridge Paragraph Bible',
    },
  },
  {
    id: 'susanna',
    title: 'Susanna',
    subtitle: 'Judgment and innocence',
    reference: 'Susanna',
    description: 'A Daniel-related narrative about false accusation and righteous judgment.',
    chapters: 1,
    source: {
      provider: 'bible-api',
      apiSource: `${BIBLE_API_ROOT}/en-US-kjvcpb/books`,
      bookPath: 'susanna',
      sourceLabel: 'Cambridge Paragraph Bible',
    },
  },
  {
    id: 'bel-and-the-dragon',
    title: 'Bel and the Dragon',
    subtitle: 'Daniel addition',
    reference: 'Bel and the Dragon',
    description: 'A Daniel-related narrative challenging idolatry and false worship.',
    chapters: 1,
    source: {
      provider: 'bible-api',
      apiSource: `${BIBLE_API_ROOT}/en-US-kjvcpb/books`,
      bookPath: 'belandthedragon',
      sourceLabel: 'Cambridge Paragraph Bible',
    },
  },
  {
    id: '1-maccabees',
    title: '1 Maccabees',
    subtitle: 'Hasmonean history',
    reference: '1 Maccabees',
    description: 'A historical account of the Maccabean revolt and its aftermath.',
    chapters: 16,
    source: {
      provider: 'bible-api',
      apiSource: `${BIBLE_API_ROOT}/en-US-kjvcpb/books`,
      bookPath: '1maccabees',
      sourceLabel: 'Cambridge Paragraph Bible',
    },
  },
  {
    id: '2-maccabees',
    title: '2 Maccabees',
    subtitle: 'Martyrdom and restoration',
    reference: '2 Maccabees',
    description: 'A retelling of the Maccabean era with focus on temple restoration and martyrdom.',
    chapters: 15,
    source: {
      provider: 'bible-api',
      apiSource: `${BIBLE_API_ROOT}/en-US-kjvcpb/books`,
      bookPath: '2maccabees',
      sourceLabel: 'Cambridge Paragraph Bible',
    },
  },
];

function getTotalChapters(works = []) {
  return works.reduce((total, work) => total + (work.chapters || 0), 0);
}

export const BOOK_COLLECTIONS = [
  {
    id: 'bible',
    kind: 'bible',
    name: 'Bible',
    tradition: 'Judaism and Christianity',
    description:
      'The existing offline Bible reader with translations, notes, search, red-letter support, and holy-day awareness.',
    summary:
      'Use the Bible reader for canonical Old and New Testament reading with the existing translation install flow.',
    actionLabel: 'Open Bible reader',
  },
  {
    id: 'quran',
    kind: 'reader',
    name: "Qur'an",
    tradition: 'Islam',
    description:
      'Full Qur\'an access through the Pickthall English translation with per-collection download and offline caching.',
    summary:
      'The catalog contains all 114 surahs. You can stream online or save the whole canon to device storage.',
    sourceLabel: 'Quran API: alquran.cloud, edition en.pickthall',
    catalogSource: 'quran-api',
    defaultWorkId: '1',
    workCount: 114,
    totalChapters: 114,
    chapterLabel: 'Surah',
  },
  {
    id: 'apocrypha',
    kind: 'reader',
    name: 'Apocrypha',
    tradition: 'Jewish and Christian literature',
    description:
      'A fuller deuterocanonical and wider apocryphal shelf, with its own install/remove flow separate from Bible translations.',
    summary:
      'Combines public-domain Cambridge Paragraph Bible and Brenton sources where those books are exposed cleanly upstream.',
    sourceLabel: 'Bible API public-domain sources',
    defaultWorkId: 'tobit',
    works: APOCRYPHA_WORKS,
    workCount: APOCRYPHA_WORKS.length,
    totalChapters: getTotalChapters(APOCRYPHA_WORKS),
    chapterLabel: 'Chapter',
  },
  {
    id: 'bahai',
    kind: 'external',
    name: "Baha'i Library",
    tradition: "Baha'i Faith",
    description:
      'A broader official Bahá\'í library entry point for authoritative writings and guidance.',
    summary:
      'These remain linked to the official Bahá\'í Reference Library rather than mirrored locally because the English texts are still governed by official terms.',
    sourceLabel: 'Official Bahá\'í Reference Library',
    works: [
      {
        id: 'authoritative-texts',
        title: 'Authoritative Writings and Guidance',
        subtitle: 'Official collection overview',
        reference: 'Bahai.org library root',
        description: 'Browse the full official collections page across Bahá’u’lláh, the Báb, ‘Abdu’l‑Bahá, prayers, Shoghi Effendi, and more.',
        href: 'https://www.bahai.org/library/authoritative-texts/',
      },
      {
        id: 'bahaullah',
        title: 'Writings of Bahá’u’lláh',
        subtitle: 'Official author collection',
        reference: 'Bahá’u’lláh',
        description: 'Principal works of Bahá’u’lláh translated into English in the official library.',
        href: 'https://www.bahai.org/library/authoritative-texts/bahaullah/',
      },
      {
        id: 'the-bab',
        title: 'Writings of the Báb',
        subtitle: 'Official author collection',
        reference: 'The Báb',
        description: 'Official access to selections and translated writings of the Báb.',
        href: 'https://www.bahai.org/library/authoritative-texts/the-bab/',
      },
      {
        id: 'abdul-baha',
        title: 'Writings and Talks of ‘Abdu’l‑Bahá',
        subtitle: 'Official author collection',
        reference: '‘Abdu’l‑Bahá',
        description: 'Official access to talks, tablets, and major compilations by ‘Abdu’l‑Bahá.',
        href: 'https://www.bahai.org/library/authoritative-texts/abdul-baha/',
      },
      {
        id: 'downloads',
        title: 'Downloads Index',
        subtitle: 'Official downloadable texts',
        reference: 'PDF, DOCX, HTML',
        description: 'Browse the official downloads index for the current English publications and formats.',
        href: 'https://www.bahai.org/library/authoritative-texts/downloads',
      },
    ],
  },
  {
    id: 'zoroastrian',
    kind: 'external',
    name: 'Zoroastrian Texts',
    tradition: 'Zoroastrianism',
    description:
      'A Zoroastrian shelf anchored around public-domain Avesta and related translations.',
    summary:
      'These are linked out to archival sources because the current app build does not yet have a normalized Zoroastrian text API comparable to the Bible or Qur\'an sources.',
    sourceLabel: 'Public-domain archival sources',
    works: [
      {
        id: 'avesta-index',
        title: 'Avesta Archive',
        subtitle: 'Collection overview',
        reference: 'Sacred Texts Archive',
        description: 'Top-level Zoroastrian index for the Avesta and related translations.',
        href: 'https://www.sacred-texts.com/zor/index.htm',
      },
      {
        id: 'yasna',
        title: 'Yasna',
        subtitle: 'Sacred liturgy and Gathas',
        reference: 'Primary liturgical text',
        description: 'A direct reading entry into the Yasna material in the Sacred Texts archive.',
        href: 'https://www.sacred-texts.com/zor/sbe31/yasnae.htm',
      },
      {
        id: 'vendidad',
        title: 'Vendidad',
        subtitle: 'Ritual and purity laws',
        reference: 'Sacred Books of the East',
        description: 'Archival entry point to the Vendidad translation volumes.',
        href: 'https://www.sacred-texts.com/zor/sbe04/index.htm',
      },
      {
        id: 'khordeh-avesta',
        title: 'Khordeh Avesta',
        subtitle: 'Daily prayer collection',
        reference: 'Prayer book and liturgy',
        description: 'Archival entry point to the Khordeh Avesta and related liturgical material.',
        href: 'https://www.sacred-texts.com/zor/sbe23/index.htm',
      },
    ],
  },
];

const COLLECTION_MAP = new Map(BOOK_COLLECTIONS.map((collection) => [collection.id, collection]));

export const BOOKS_TAB_COLLECTIONS = BOOK_COLLECTIONS;
export const READER_COLLECTIONS = BOOK_COLLECTIONS.filter((collection) => collection.kind === 'reader');
export const DOWNLOADABLE_BOOK_COLLECTIONS = BOOK_COLLECTIONS.filter(
  (collection) => collection.kind === 'reader'
);

export function getBooksCollectionById(collectionId) {
  return COLLECTION_MAP.get(collectionId) || null;
}

export function getBooksCollectionWorks(collectionId, resolvedWorks = null) {
  const collection = getBooksCollectionById(collectionId);
  if (!collection) return [];
  if (Array.isArray(resolvedWorks)) return resolvedWorks;
  return Array.isArray(collection.works) ? collection.works : [];
}

export function getBooksWorkById(collectionId, workId, resolvedWorks = null) {
  const works = getBooksCollectionWorks(collectionId, resolvedWorks);
  return works.find((work) => work.id === workId) || null;
}

export function getBooksCollectionDefaultRoute(collectionId, resolvedWorks = null) {
  const collection = getBooksCollectionById(collectionId);
  if (!collection) return '/books';

  const works = getBooksCollectionWorks(collectionId, resolvedWorks);
  const defaultWorkId = collection.defaultWorkId || works[0]?.id;
  if (!defaultWorkId) return '/books';

  return `/books/${collection.id}/${defaultWorkId}/1`;
}

export function getBooksCollectionStats(collectionId, resolvedWorks = null) {
  const collection = getBooksCollectionById(collectionId);
  if (!collection) return { workCount: 0, totalChapters: 0 };

  const works = getBooksCollectionWorks(collectionId, resolvedWorks);

  return {
    workCount: collection.workCount || works.length,
    totalChapters: collection.totalChapters || getTotalChapters(works),
  };
}
