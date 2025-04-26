const baseUrl = 'https://bestdubbedanime.com';
const headers = { 'User-Agent': 'Mozilla/5.0', 'Referer': baseUrl };

/** Fetch popular anime (home page or paged). */
async function fetchPopular(page) {
  // Build URL: first page = base, other pages = /page/n
  const url = page > 1 ? `${baseUrl}/page/${page}` : baseUrl;
  const response = await fetch(url, { headers });
  const document = await response.text().then(t => new DOMParser().parseFromString(t, 'text/html'));
  // Select anime cards
  const items = Array.from(document.querySelectorAll('div.grid > div.grid__item'));
  const animes = [];
  for (const item of items) {
    // Title (from H4 link)
    const titleEl = item.querySelector('div.tinywells > div > h4');
    const title = titleEl ? titleEl.textContent.trim() : null;
    // URL of anime detail
    const linkEl = item.querySelector('div.tinywells > div > h4 a');
    const urlPath = linkEl ? linkEl.getAttribute('href') : null;
    // Thumbnail image
    let thumb = null;
    const imgEl = item.querySelector('img');
    if (imgEl) {
      thumb = imgEl.getAttribute('data-src') || imgEl.getAttribute('src');
    }
    if (title && urlPath) {
      animes.push({ title, url: urlPath, thumbnail: thumb });
    }
  }
  return {
    animes: animes,
    hasNextPage: animes.length > 0
  };
}

/** Fetch detailed anime info (title, description, genres, thumbnail). */
async function fetchAnimeInfo(animeUrl) {
  const fullUrl = animeUrl.startsWith('http') ? animeUrl : (baseUrl + animeUrl);
  const response = await fetch(fullUrl, { headers });
  const document = await response.text().then(t => new DOMParser().parseFromString(t, 'text/html'));
  // Title
  const titleEl = document.querySelector('div.titlekf');
  const title = titleEl ? titleEl.textContent.trim() : null;
  // Description (if exists)
  const descEl = document.querySelector('div[itemprop="description"]') || document.querySelector('div.mw-content-ltr');
  const desc = descEl ? descEl.textContent.trim() : '';
  // Thumbnail (if a cover image present)
  let thumbnail = null;
  const thumbEl = document.querySelector('div.mv_img > img');
  if (thumbEl) {
    thumbnail = thumbEl.getAttribute('data-src') || thumbEl.getAttribute('src');
  }
  // Genres/tags from itemprop=keywords
  const genreEls = document.querySelectorAll('div[itemprop="keywords"] > a');
  const genres = Array.from(genreEls).map(el => el.textContent.trim()).filter(g => g);
  return {
    anime: {
      title: title || '',
      desc: desc,
      thumbnail: thumbnail,
      genres: genres
    }
  };
}

/** Fetch episode list for an anime (from its detail page). */
async function fetchEpisodeList(animeUrl) {
  const fullUrl = animeUrl.startsWith('http') ? animeUrl : (baseUrl + animeUrl);
  const response = await fetch(fullUrl, { headers });
  const document = await response.text().then(t => new DOMParser().parseFromString(t, 'text/html'));
  const episodes = [];
  // Episodes are also listed in div.grid__item, similar to popular
  const items = Array.from(document.querySelectorAll('div.grid > div.grid__item'));
  for (const item of items) {
    const epEl = item.querySelector('div.tinywells > div > h4');
    const name = epEl ? epEl.textContent.trim() : null;
    const linkEl = item.querySelector('div.tinywells > div > h4 a');
    const urlPath = linkEl ? linkEl.getAttribute('href') : null;
    if (name && urlPath) {
      episodes.push({ name, url: urlPath });
    }
  }
  return { episodes };
}

/** Load episode video sources from the episode page. */
async function loadEpisodeSources(episodeUrl) {
  const fullUrl = episodeUrl.startsWith('http') ? episodeUrl : (baseUrl + episodeUrl);
  const response = await fetch(fullUrl, { headers });
  const document = await response.text().then(t => new DOMParser().parseFromString(t, 'text/html'));
  const sources = [];
  // Look for iframe(s) containing the video
  const frames = Array.from(document.querySelectorAll('iframe'));
  for (const frame of frames) {
    const src = frame.getAttribute('src');
    if (src) {
      // Quality label could be inferred or left generic
      sources.push({ url: src, name: 'Stream', isM3U8: src.endsWith('.m3u8') });
    }
  }
  return sources;
}

/** Search for anime by name. */
async function search(query) {
  const url = `${baseUrl}/?s=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers });
  const document = await response.text().then(t => new DOMParser().parseFromString(t, 'text/html'));
  const items = Array.from(document.querySelectorAll('div.grid > div.grid__item'));
  const results = [];
  for (const item of items) {
    const titleEl = item.querySelector('div.tinywells > div > h4');
    const title = titleEl ? titleEl.textContent.trim() : null;
    const linkEl = item.querySelector('div.tinywells > div > h4 a');
    const urlPath = linkEl ? linkEl.getAttribute('href') : null;
    let thumb = null;
    const imgEl = item.querySelector('img');
    if (imgEl) {
      thumb = imgEl.getAttribute('data-src') || imgEl.getAttribute('src');
    }
    if (title && urlPath) {
      results.push({ title, url: urlPath, thumbnail: thumb });
    }
  }
  return {
    animes: results,
    hasNextPage: false
  };
}

// Export all functions in Mangayomi-compatible way
module.exports = {
  fetchPopular,
  fetchAnimeInfo,
  fetchEpisodeList,
  loadEpisodeSources,
  search
};
