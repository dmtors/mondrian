// Reading articles from Wikipedia: what each one does to the sound, and search.
// The sound comes from each article's trust signals in the Wikimedia
// Attribution API (beta): contributors, references, page views, last update
// and trending. Browser requests can't set a User-Agent, so we send
// Api-User-Agent instead and keep requests few (two per article, debounced search).

const LANG = 'en';
const API = `https://${LANG}.wikipedia.org/w/api.php`;
const ATTRIBUTION = `https://${LANG}.wikipedia.org/w/rest.php/attribution/v0-beta/pages`;
const HEADERS = { 'Api-User-Agent': 'Mondrian/0.1 (https://dmtors.github.io/mondrian/)' };

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

/** An article's trust signals from the Attribution API, or null if it has none. */
async function trustSignals(title) {
  const url = `${ATTRIBUTION}/${encodeURIComponent(title.replace(/ /g, '_'))}/signals?expand=trust_and_relevance`;
  const response = await fetch(url, { headers: HEADERS });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * What an article does to the sound: its trust signals (contributors,
 * references, page views in the last 30 days, last update, trending), plus a
 * thumbnail when it has a lead image and the link to credit it by. Two
 * requests: one to settle the title (following redirects) and find the
 * thumbnail, one for the signals. Null when there's no such article.
 */
export async function articleSignals(title) {
  const key = title.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const data = await query({ redirects: '1', titles: title, prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '120' });
  const page = data.query?.pages?.[0];
  if (!page || page.missing || page.invalid) return null;
  const signals = await trustSignals(page.title);
  if (!signals) return null;
  const trust = signals.trust_and_relevance || {};
  const trending = trust.trending?.top || {};
  const updated = trust.last_updated ? Date.parse(trust.last_updated) : NaN;

  const article = {
    title: page.title,
    contributors: trust.contributor_counts?.total_unique ?? 0,
    references: trust.reference_count ?? 0,
    pageViews: trust.page_views ?? 0, // the last 30 days
    daysSinceUpdate: Number.isNaN(updated) ? null : Math.max(0, (Date.now() - updated) / 86400e3),
    trending: Boolean(trending.read || trending.edited || trending.read_and_edited),
    link: signals.essential?.link || articleUrl(page.title), // keeps the API's wprov, so the visit is credited
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

/**
 * Random articles, straight from Wikipedia's random-article list: mostly
 * obscure ones, with few writers, references and readers, so they make very
 * different sounds from the well-known [SURPRISES]. Fetched twenty at a time
 * and handed out one by one.
 */
let randomPool = [];
let randomFetch = null;
export async function randomArticle() {
  if (!randomPool.length) {
    randomFetch ||= query({ list: 'random', rnnamespace: '0', rnfilterredir: 'nonredirects', rnlimit: '20' })
      .then((data) => (randomPool = (data.query?.random || []).map((r) => r.title)))
      .finally(() => (randomFetch = null));
    await randomFetch;
  }
  return randomPool.shift() || null;
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
