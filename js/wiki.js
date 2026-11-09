// Reading articles from Wikipedia: what each one does to the sound, and search.
// Browser requests can't set a User-Agent, so we send Api-User-Agent instead
// and keep requests few (one per article, debounced search).

const LANG = 'en';
const API = `https://${LANG}.wikipedia.org/w/api.php`;
const HEADERS = { 'Api-User-Agent': 'Mondrian/0.1 (articles-as-instrument mini site)' };

export const articleUrl = (title) => `https://${LANG}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

async function query(params, signal) {
  const url = new URL(API);
  Object.entries({ action: 'query', format: 'json', formatversion: '2', origin: '*', ...params }).forEach(([k, v]) =>
    url.searchParams.set(k, v),
  );
  const response = await fetch(url, { headers: HEADERS, signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

const cache = new Map();

/**
 * What an article does to the sound, in one request: incoming links, creation
 * date and topic (from the search index), plus edits in the last 30 days
 * (capped at 50), and a thumbnail when it has a lead image. Null when there's no such article.
 */
export async function articleSignals(title) {
  const key = title.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const since = new Date(Date.now() - 30 * 86400e3).toISOString();
  const data = await query({
    redirects: '1',
    titles: title,
    prop: 'cirrusdoc|revisions|pageimages',
    piprop: 'thumbnail',
    pithumbsize: '160',
    cdincludes: 'incoming_links|create_timestamp|weighted_tags',
    rvprop: 'timestamp',
    rvlimit: '50',
    rvend: since,
  });
  const page = data.query?.pages?.[0];
  if (!page || page.missing || page.invalid) return null;
  const doc = page.cirrusdoc?.[0]?.source;
  if (!doc) return null;

  // The strongest topic: "articletopic/STEM.Space|988" → STEM (and, in detail, "Space").
  const strongest = (doc.weighted_tags || [])
    .filter((t) => t.startsWith('classification.prediction.articletopic/'))
    .map((t) => ({ name: t.slice(t.indexOf('/') + 1, t.lastIndexOf('|')), score: +t.slice(t.lastIndexOf('|') + 1) || 0 }))
    .sort((a, b) => b.score - a.score)[0]?.name;
  const created = doc.create_timestamp ? Date.parse(doc.create_timestamp) : NaN;

  const article = {
    title: page.title,
    incomingLinks: doc.incoming_links || 0,
    createdYear: Number.isNaN(created) ? null : new Date(created).getUTCFullYear(),
    ageYears: Number.isNaN(created) ? 0 : Math.max(0, (Date.now() - created) / (365.25 * 86400e3)),
    topic: strongest ? strongest.split('.')[0] : null,
    topicDetail: strongest ? strongest.split('.').pop().replace(/_/g, ' ').replace(/\*$/, '').trim() : null,
    editsLastMonth: (page.revisions || []).length,
    thumbnail: page.thumbnail?.source || null,
  };
  cache.set(key, article);
  cache.set(article.title.toLowerCase(), article);
  return article;
}

/** Articles whose titles start with [text], with their short descriptions. */
export async function search(text, signal) {
  const data = await query(
    {
      generator: 'prefixsearch',
      gpssearch: text,
      gpslimit: '8',
      gpsnamespace: '0',
      prop: 'description|pageimages',
      piprop: 'thumbnail',
      pithumbsize: '120',
      pilimit: '8',
      redirects: '1',
    },
    signal,
  );
  return (data.query?.pages || [])
    .sort((a, b) => a.index - b.index)
    .map((p) => ({ title: p.title, description: p.description || '', thumbnail: p.thumbnail?.source || null }));
}

/** Broad, well-linked subjects for a surprise slot: they make lively sounds. */
export const SURPRISES = [
  'Coffee', 'Ancient Rome', 'Jupiter', 'Basketball', 'Taylor Swift', 'Chess', 'Volcano', 'Jazz', 'Ancient Egypt',
  'The Beatles', 'Dinosaur', 'Olympic Games', 'Moon', 'Tea', 'William Shakespeare', 'Pizza', 'Mount Everest', 'Western honey bee',
  'Leonardo da Vinci', 'Association football', 'Amazon rainforest', 'Paris', 'Tokyo', 'Star Wars', 'Chocolate', 'Vikings',
  'Rainbow', 'Hip hop music', 'Tennis', 'Albert Einstein', 'Great Barrier Reef', 'Japan', 'Opera', 'Cat', 'Dog',
  'Mars', 'Egyptian pyramids', 'Bicycle', 'Video game', 'Photography', 'Origami', 'Shark', 'Elephant', 'Pablo Picasso',
  'New York City', 'Ballet', 'Penguin', 'Saturn', 'Wine', 'Cheese', 'Sushi', 'Formula One', 'Cricket', 'Baseball',
  'Harry Potter', 'Wolfgang Amadeus Mozart', 'Renaissance', 'Silk Road', 'Antarctica', 'Sahara', 'Coral reef', 'Eiffel Tower',
  'Rock music', 'Surfing', 'Skiing', 'Yoga', 'Mathematics', 'Computer', 'Internet', 'Rail transport', 'Aviation',
  'Piet Mondrian', 'De Stijl', 'Synthesizer',
];

/** The default patch: each slot plays the article about itself. */
export const STARTER = ['Waveform', 'Filter (signal processing)', 'Envelope (music)', 'Effects unit'];
