export const BIBLE_BOOKS = [
  // Old Testament
  { id: 'GEN', name: 'Genesis', chapters: 50, testament: 'OT' },
  { id: 'EXO', name: 'Exodus', chapters: 40, testament: 'OT' },
  { id: 'LEV', name: 'Leviticus', chapters: 27, testament: 'OT' },
  { id: 'NUM', name: 'Numbers', chapters: 36, testament: 'OT' },
  { id: 'DEU', name: 'Deuteronomy', chapters: 34, testament: 'OT' },
  { id: 'JOS', name: 'Joshua', chapters: 24, testament: 'OT' },
  { id: 'JDG', name: 'Judges', chapters: 21, testament: 'OT' },
  { id: 'RUT', name: 'Ruth', chapters: 4, testament: 'OT' },
  { id: '1SA', name: '1 Samuel', chapters: 31, testament: 'OT' },
  { id: '2SA', name: '2 Samuel', chapters: 24, testament: 'OT' },
  { id: '1KI', name: '1 Kings', chapters: 22, testament: 'OT' },
  { id: '2KI', name: '2 Kings', chapters: 25, testament: 'OT' },
  { id: '1CH', name: '1 Chronicles', chapters: 29, testament: 'OT' },
  { id: '2CH', name: '2 Chronicles', chapters: 36, testament: 'OT' },
  { id: 'EZR', name: 'Ezra', chapters: 10, testament: 'OT' },
  { id: 'NEH', name: 'Nehemiah', chapters: 13, testament: 'OT' },
  { id: 'EST', name: 'Esther', chapters: 10, testament: 'OT' },
  { id: 'JOB', name: 'Job', chapters: 42, testament: 'OT' },
  { id: 'PSA', name: 'Psalms', chapters: 150, testament: 'OT' },
  { id: 'PRO', name: 'Proverbs', chapters: 31, testament: 'OT' },
  { id: 'ECC', name: 'Ecclesiastes', chapters: 12, testament: 'OT' },
  { id: 'SNG', name: 'Song of Solomon', chapters: 8, testament: 'OT' },
  { id: 'ISA', name: 'Isaiah', chapters: 66, testament: 'OT' },
  { id: 'JER', name: 'Jeremiah', chapters: 52, testament: 'OT' },
  { id: 'LAM', name: 'Lamentations', chapters: 5, testament: 'OT' },
  { id: 'EZK', name: 'Ezekiel', chapters: 48, testament: 'OT' },
  { id: 'DAN', name: 'Daniel', chapters: 12, testament: 'OT' },
  { id: 'HOS', name: 'Hosea', chapters: 14, testament: 'OT' },
  { id: 'JOL', name: 'Joel', chapters: 3, testament: 'OT' },
  { id: 'AMO', name: 'Amos', chapters: 9, testament: 'OT' },
  { id: 'OBA', name: 'Obadiah', chapters: 1, testament: 'OT' },
  { id: 'JON', name: 'Jonah', chapters: 4, testament: 'OT' },
  { id: 'MIC', name: 'Micah', chapters: 7, testament: 'OT' },
  { id: 'NAM', name: 'Nahum', chapters: 3, testament: 'OT' },
  { id: 'HAB', name: 'Habakkuk', chapters: 3, testament: 'OT' },
  { id: 'ZEP', name: 'Zephaniah', chapters: 3, testament: 'OT' },
  { id: 'HAG', name: 'Haggai', chapters: 2, testament: 'OT' },
  { id: 'ZEC', name: 'Zechariah', chapters: 14, testament: 'OT' },
  { id: 'MAL', name: 'Malachi', chapters: 4, testament: 'OT' },
  // New Testament
  { id: 'MAT', name: 'Matthew', chapters: 28, testament: 'NT' },
  { id: 'MRK', name: 'Mark', chapters: 16, testament: 'NT' },
  { id: 'LUK', name: 'Luke', chapters: 24, testament: 'NT' },
  { id: 'JHN', name: 'John', chapters: 21, testament: 'NT' },
  { id: 'ACT', name: 'Acts', chapters: 28, testament: 'NT' },
  { id: 'ROM', name: 'Romans', chapters: 16, testament: 'NT' },
  { id: '1CO', name: '1 Corinthians', chapters: 16, testament: 'NT' },
  { id: '2CO', name: '2 Corinthians', chapters: 13, testament: 'NT' },
  { id: 'GAL', name: 'Galatians', chapters: 6, testament: 'NT' },
  { id: 'EPH', name: 'Ephesians', chapters: 6, testament: 'NT' },
  { id: 'PHP', name: 'Philippians', chapters: 4, testament: 'NT' },
  { id: 'COL', name: 'Colossians', chapters: 4, testament: 'NT' },
  { id: '1TH', name: '1 Thessalonians', chapters: 5, testament: 'NT' },
  { id: '2TH', name: '2 Thessalonians', chapters: 3, testament: 'NT' },
  { id: '1TI', name: '1 Timothy', chapters: 6, testament: 'NT' },
  { id: '2TI', name: '2 Timothy', chapters: 4, testament: 'NT' },
  { id: 'TIT', name: 'Titus', chapters: 3, testament: 'NT' },
  { id: 'PHM', name: 'Philemon', chapters: 1, testament: 'NT' },
  { id: 'HEB', name: 'Hebrews', chapters: 13, testament: 'NT' },
  { id: 'JAS', name: 'James', chapters: 5, testament: 'NT' },
  { id: '1PE', name: '1 Peter', chapters: 5, testament: 'NT' },
  { id: '2PE', name: '2 Peter', chapters: 3, testament: 'NT' },
  { id: '1JN', name: '1 John', chapters: 5, testament: 'NT' },
  { id: '2JN', name: '2 John', chapters: 1, testament: 'NT' },
  { id: '3JN', name: '3 John', chapters: 1, testament: 'NT' },
  { id: 'JUD', name: 'Jude', chapters: 1, testament: 'NT' },
  { id: 'REV', name: 'Revelation', chapters: 22, testament: 'NT' },
];

export const AVAILABLE_TRANSLATIONS = [
  {
    id: 'kjv',
    name: 'King James Version',
    abbreviation: 'KJV',
    language: 'English',
    description: 'The classic 1611 English translation, widely used and beloved.',
    apiSource: 'https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/en-kjv/books',
  },
  {
    id: 'asv',
    name: 'American Standard Version',
    abbreviation: 'ASV',
    language: 'English',
    description: 'A literal translation from 1901, known for accuracy.',
    apiSource: 'https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/en-asv/books',
  },
  {
    id: 'bbe',
    name: 'Bible in Basic English',
    abbreviation: 'BBE',
    language: 'English',
    description: 'Uses simplified English vocabulary for easy understanding.',
    apiSource: 'https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/en-bbe/books',
  },
  {
    id: 'web',
    name: 'World English Bible',
    abbreviation: 'WEB',
    language: 'English',
    description: 'A modern public domain translation in contemporary English.',
    apiSource: 'https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/en-web/books',
  },
  {
    id: 'ylt',
    name: "Young's Literal Translation",
    abbreviation: 'YLT',
    language: 'English',
    description: 'An extremely literal translation by Robert Young (1862).',
    apiSource: 'https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/en-ylt/books',
  },
  {
    id: 'rvr',
    name: 'Reina Valera',
    abbreviation: 'RVR',
    language: 'Spanish',
    description: 'Classic Spanish Bible translation, widely used in Latin America.',
    apiSource: 'https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/es-rvr/books',
  },
];

// Map from our book IDs to the API path names
const BOOK_API_MAP = {
  GEN: 'genesis', EXO: 'exodus', LEV: 'leviticus', NUM: 'numbers', DEU: 'deuteronomy',
  JOS: 'joshua', JDG: 'judges', RUT: 'ruth', '1SA': '1 samuel', '2SA': '2 samuel',
  '1KI': '1 kings', '2KI': '2 kings', '1CH': '1 chronicles', '2CH': '2 chronicles',
  EZR: 'ezra', NEH: 'nehemiah', EST: 'esther', JOB: 'job', PSA: 'psalms',
  PRO: 'proverbs', ECC: 'ecclesiastes', SNG: 'song of solomon', ISA: 'isaiah',
  JER: 'jeremiah', LAM: 'lamentations', EZK: 'ezekiel', DAN: 'daniel', HOS: 'hosea',
  JOL: 'joel', AMO: 'amos', OBA: 'obadiah', JON: 'jonah', MIC: 'micah',
  NAM: 'nahum', HAB: 'habakkuk', ZEP: 'zephaniah', HAG: 'haggai', ZEC: 'zechariah',
  MAL: 'malachi', MAT: 'matthew', MRK: 'mark', LUK: 'luke', JHN: 'john',
  ACT: 'acts', ROM: 'romans', '1CO': '1 corinthians', '2CO': '2 corinthians',
  GAL: 'galatians', EPH: 'ephesians', PHP: 'philippians', COL: 'colossians',
  '1TH': '1 thessalonians', '2TH': '2 thessalonians', '1TI': '1 timothy',
  '2TI': '2 timothy', TIT: 'titus', PHM: 'philemon', HEB: 'hebrews',
  JAS: 'james', '1PE': '1 peter', '2PE': '2 peter', '1JN': '1 john',
  '2JN': '2 john', '3JN': '3 john', JUD: 'jude', REV: 'revelation',
};

export function getBookApiPath(bookId) {
  return BOOK_API_MAP[bookId] || bookId.toLowerCase();
}

export function getBookById(bookId) {
  return BIBLE_BOOKS.find((b) => b.id === bookId);
}

export function getTranslationById(translationId) {
  return AVAILABLE_TRANSLATIONS.find((t) => t.id === translationId);
}

export const DAILY_READINGS = [
  { book: 'PSA', chapter: 23, title: 'The Lord is My Shepherd', description: 'A psalm of comfort and trust in God\'s provision.' },
  { book: 'JHN', chapter: 3, title: 'You Must Be Born Again', description: 'Jesus teaches Nicodemus about spiritual rebirth.' },
  { book: 'ROM', chapter: 8, title: 'Life in the Spirit', description: 'Nothing can separate us from the love of God.' },
  { book: 'ISA', chapter: 40, title: 'Comfort for God\'s People', description: 'Those who hope in the Lord will renew their strength.' },
  { book: 'MAT', chapter: 5, title: 'The Sermon on the Mount', description: 'The Beatitudes and teachings on righteous living.' },
  { book: 'PHP', chapter: 4, title: 'Rejoice in the Lord', description: 'I can do all things through Christ who strengthens me.' },
  { book: 'PRO', chapter: 3, title: 'Trust in the Lord', description: 'Trust in the Lord with all your heart.' },
  { book: 'GEN', chapter: 1, title: 'In the Beginning', description: 'God creates the heavens and the earth.' },
  { book: '1CO', chapter: 13, title: 'The Way of Love', description: 'Love is patient, love is kind.' },
  { book: 'HEB', chapter: 11, title: 'By Faith', description: 'The great hall of faith and its heroes.' },
  { book: 'EPH', chapter: 6, title: 'The Armor of God', description: 'Put on the full armor of God.' },
  { book: 'REV', chapter: 21, title: 'A New Heaven and Earth', description: 'God will wipe every tear from their eyes.' },
  { book: 'PSA', chapter: 91, title: 'Under His Wings', description: 'He who dwells in the shelter of the Most High.' },
  { book: 'JHN', chapter: 14, title: 'The Way, Truth, and Life', description: 'Jesus comforts His disciples and promises the Spirit.' },
];

export function getTodaysReadings() {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
  );
  const startIdx = dayOfYear % DAILY_READINGS.length;
  return [
    DAILY_READINGS[startIdx],
    DAILY_READINGS[(startIdx + 1) % DAILY_READINGS.length],
    DAILY_READINGS[(startIdx + 2) % DAILY_READINGS.length],
  ];
}
