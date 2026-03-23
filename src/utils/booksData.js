export const ABRAHAMIC_COLLECTIONS = [
  {
    id: 'bible',
    kind: 'bible',
    name: 'Bible',
    tradition: 'Judaism and Christianity',
    description:
      'The existing offline Bible reader with translations, notes, and search.',
    summary:
      'Includes the Torah, Prophets, Writings, Gospels, and apostolic writings already supported in the app.',
    actionLabel: 'Open Bible reader',
  },
  {
    id: 'quran',
    kind: 'reader',
    name: "Qur'an",
    tradition: 'Islam',
    description:
      'A starter set of public-domain English passages to widen the library beyond the Bible.',
    summary:
      'Uses the Pickthall English rendering for local reading inside the app.',
    sourceLabel: 'Pickthall translation (public domain)',
    works: [
      {
        id: 'al-fatihah',
        title: 'Al-Fatihah',
        subtitle: 'The Opening',
        reference: 'Surah 1',
        description: 'The opening prayer of the Qur\'an.',
        sourceLabel: 'Pickthall translation (public domain)',
        passages: [
          { verse: 1, text: 'In the name of Allah, the Beneficent, the Merciful.' },
          { verse: 2, text: 'Praise be to Allah, Lord of the Worlds,' },
          { verse: 3, text: 'The Beneficent, the Merciful.' },
          { verse: 4, text: 'Master of the Day of Judgment,' },
          { verse: 5, text: 'Thee (alone) we worship; Thee (alone) we ask for help.' },
          { verse: 6, text: 'Show us the straight path,' },
          {
            verse: 7,
            text: 'The path of those whom Thou hast favoured; Not the (path) of those who earn Thine anger nor of those who go astray.',
          },
        ],
      },
      {
        id: 'maryam',
        title: 'Maryam',
        subtitle: 'Jesus speaks in infancy',
        reference: 'Surah 19:30-36',
        description:
          'A passage centered on Mary and Jesus, often compared in interfaith study.',
        sourceLabel: 'Pickthall translation (public domain)',
        passages: [
          {
            verse: 30,
            text: 'He spake: Lo! I am the slave of Allah. He hath given me the Scripture and hath appointed me a Prophet,',
          },
          {
            verse: 31,
            text: 'And hath made me blessed wheresoever I may be, and hath enjoined upon me prayer and almsgiving so long as I remain alive,',
          },
          {
            verse: 32,
            text: 'And (hath made me) dutiful toward her who bore me, and hath not made me arrogant, unblest.',
          },
          {
            verse: 33,
            text: 'Peace on me the day I was born, and the day I die, and the day I shall be raised alive!',
          },
          {
            verse: 34,
            text: 'Such was Jesus, son of Mary: (this is) a statement of the truth concerning which they doubt.',
          },
          {
            verse: 35,
            text: 'It befitteth not (the Majesty of) Allah that He should take unto Himself a son. Glory be to Him! When He decreeth a thing, He saith unto it only: Be! and it is.',
          },
          {
            verse: 36,
            text: 'And lo! Allah is my Lord and your Lord. So serve Him. That is the right path.',
          },
        ],
      },
      {
        id: 'al-ikhlas',
        title: 'Al-Ikhlas',
        subtitle: 'Sincerity',
        reference: 'Surah 112',
        description: 'A short confession of divine oneness.',
        sourceLabel: 'Pickthall translation (public domain)',
        passages: [
          { verse: 1, text: 'Say: He is Allah, the One!' },
          { verse: 2, text: 'Allah, the eternally Besought of all!' },
          { verse: 3, text: 'He begetteth not nor was begotten.' },
          { verse: 4, text: 'And there is none comparable unto Him.' },
        ],
      },
    ],
  },
  {
    id: 'apocrypha',
    kind: 'reader',
    name: 'Apocrypha',
    tradition: 'Jewish and Christian literature',
    description:
      'A starter shelf of deuterocanonical passages that do not appear in the default Bible book list today.',
    summary:
      'Useful for broadening the library while leaving the Bible reader data model unchanged.',
    sourceLabel: 'Public-domain English texts',
    works: [
      {
        id: 'wisdom-3',
        title: 'Wisdom of Solomon',
        subtitle: 'Hope of the righteous',
        reference: 'Wisdom 3:1-9',
        description: 'A classic deuterocanonical passage on immortality and judgment.',
        sourceLabel: 'WEBUS public-domain text',
        passages: [
          { verse: 1, text: 'But the souls of the righteous are in the hand of God, and no torment will touch them.' },
          { verse: 2, text: 'In the eyes of the foolish they seemed to have died. Their departure was considered a disaster,' },
          { verse: 3, text: 'and their travel away from us ruin, but they are in peace.' },
          { verse: 4, text: 'For even if in the sight of men they are punished, their hope is full of immortality.' },
          { verse: 5, text: 'Having borne a little chastening, they will receive great good; because God tested them, and found them worthy of himself.' },
          { verse: 6, text: 'He tested them like gold in the furnace, and he accepted them as a whole burnt offering.' },
          { verse: 7, text: 'In the time of their visitation they will shine. They will run back and forth like sparks among stubble.' },
          { verse: 8, text: 'They will judge nations and have dominion over peoples. The Lord will reign over them forever.' },
          { verse: 9, text: 'Those who trust him will understand truth. The faithful will live with him in love, because grace and mercy are with his chosen ones.' },
        ],
      },
      {
        id: 'sirach-2',
        title: 'Sirach',
        subtitle: 'Endurance and trust',
        reference: 'Sirach 2:1-11',
        description: 'A wisdom passage on endurance, humility, and trust in God.',
        sourceLabel: 'Brenton Septuagint translation (public domain)',
        passages: [
          { verse: 1, text: 'My son, if thou come to serve the Lord, prepare thy soul for temptation.' },
          { verse: 2, text: 'Set thy heart aright, and constantly endure, and make not haste in time of trouble.' },
          { verse: 3, text: 'Cleave unto him, and depart not away, that thou mayest be increased at thy last end.' },
          { verse: 4, text: 'Whatsoever is brought upon thee take cheerfully, and be patient when thou art changed to a low estate.' },
          { verse: 5, text: 'For gold is tried in the fire, and acceptable men in the furnace of adversity.' },
          { verse: 6, text: 'Believe in him, and he will help thee; order thy way aright, and trust in him.' },
          { verse: 7, text: 'Ye that fear the Lord, wait for his mercy; and go not aside, lest ye fall.' },
          { verse: 8, text: 'Ye that fear the Lord, believe him; and your reward shall not fail.' },
          { verse: 9, text: 'Ye that fear the Lord, hope for good, and for everlasting joy and mercy.' },
          {
            verse: 10,
            text: 'Look at the generations of old, and see; did ever any trust in the Lord, and was confounded? or did any abide in his fear, and was forsaken? or whom did he ever despise, that called upon him?',
          },
          {
            verse: 11,
            text: 'For the Lord is full of compassion and mercy, longsuffering, and very pitiful, and forgiveth sins, and saveth in time of affliction.',
          },
        ],
      },
    ],
  },
  {
    id: 'bahai',
    kind: 'external',
    name: "Baha'i Texts",
    tradition: "Baha'i Faith",
    description:
      'Direct links into the official Baha\'i Reference Library for authoritative online reading.',
    summary:
      'The app links out here instead of bundling local copies because the official English texts remain copyrighted.',
    sourceLabel: 'Official Baha\'i Reference Library',
    works: [
      {
        id: 'bahai-library',
        title: "Baha'i Reference Library",
        subtitle: 'Official portal',
        reference: 'bahai.org/library',
        description:
          'Browse the main library for authoritative writings, prayers, and guidance.',
        href: 'https://www.bahai.org/library',
      },
      {
        id: 'authoritative-texts',
        title: 'Authoritative Writings and Guidance',
        subtitle: 'Collection overview',
        reference: 'bahai.org/library/authoritative-texts',
        description:
          'An overview of the major collections available in English online.',
        href: 'https://www.bahai.org/library/authoritative-texts/',
      },
      {
        id: 'kitab-i-aqdas',
        title: 'The Kitab-i-Aqdas',
        subtitle: 'The Most Holy Book',
        reference: 'Official reading page',
        description:
          'The official overview and online reader for one of the central Baha\'i texts.',
        href: 'https://www.bahai.org/library/authoritative-texts/bahaullah/kitab-i-aqdas/',
      },
    ],
  },
];

const COLLECTION_MAP = new Map(ABRAHAMIC_COLLECTIONS.map((collection) => [collection.id, collection]));

export const BOOKS_TAB_COLLECTIONS = ABRAHAMIC_COLLECTIONS;
export const READER_COLLECTIONS = ABRAHAMIC_COLLECTIONS.filter(
  (collection) => collection.kind === 'reader'
);

export function getBooksCollectionById(collectionId) {
  return COLLECTION_MAP.get(collectionId) || null;
}

export function getBooksWorkById(collectionId, workId) {
  const collection = getBooksCollectionById(collectionId);
  if (!collection?.works) return null;
  return collection.works.find((work) => work.id === workId) || null;
}

