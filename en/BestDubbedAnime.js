const BASE_URL = "https://bestdubbedanime.com";

/**
 * Helper: request & parse HTML.
 * @param {string} url
 * @returns {Document}
 */
async function getDocument(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  return new DOMParser().parseFromString(html, "text/html");
}

/**
 * Fetches a page of the “All Series” index.
 * @param {number} page
 * @returns {{ title:string, url:string, thumbnail:string }[]}
 */
async function fetchSeriesPage(page) {
  const doc = await getDocument(`${BASE_URL}/series?page=${page}`);
  return Array.from(doc.querySelectorAll(".col-lg-2.col-md-3.col-6")).map(card => {
    const a = card.querySelector("a");
    const img = card.querySelector("img");
    const title = (a.getAttribute("title") || a.textContent).trim();
    const href = a.getAttribute("href");
    const thumb = img.getAttribute("src") || "";
    return {
      title,
      url: href.startsWith("http") ? href : BASE_URL + href,
      thumbnail: thumb.startsWith("http") ? thumb : BASE_URL + thumb
    };
  });
}

/**
 * Fetches popular anime (paginated).
 */
async function fetchPopular(page) {
  const results = await fetchSeriesPage(page);
  return { results, hasNextPage: results.length > 0 };
}

/**
 * “Search” by filtering the first N pages of series.
 * @param {string} query
 */
async function search(query) {
  const maxPagesToScan = 3;        // adjust if you want more exhaustive search
  const q = query.trim().toLowerCase();
  let all = [];
  for (let p = 1; p <= maxPagesToScan; p++) {
    try {
      const pageResults = await fetchSeriesPage(p);
      all = all.concat(pageResults);
    } catch {
      break; // stop if a page fails
    }
  }
  const filtered = all.filter(item => item.title.toLowerCase().includes(q));
  return { results: filtered, hasNextPage: false };
}

/**
 * Fetches an anime’s details and episodes.
 */
async function fetchAnimeInfo(url) {
  const doc = await getDocument(url);
  const title = doc.querySelector("h1")?.textContent.trim() || "";
  const description = doc.querySelector(".anime__details__text p")?.textContent.trim() || "";
  const imgEl = doc.querySelector(".anime__details__pic img");
  const thumbnail = imgEl
    ? (imgEl.src.startsWith("http") ? imgEl.src : BASE_URL + imgEl.getAttribute("src"))
    : "";
  // episodes
  const episodes = Array.from(doc.querySelectorAll(".episode-list a")).map(el => ({
    name: el.textContent.trim(),
    url: el.href.startsWith("http") ? el.href : BASE_URL + el.getAttribute("href")
  }));
  // genres
  const genres = Array.from(doc.querySelectorAll(".anime__details__pager a"))
    .map(a => a.textContent.trim())
    .filter(Boolean);
  return { title, description, thumbnail, genres, episodes };
}

/** Alias to satisfy the loader API */
async function fetchEpisodes(url) {
  const info = await fetchAnimeInfo(url);
  return info.episodes;
}

/**
 * Extracts video sources from an episode page.
 */
async function loadEpisodeSources(url) {
  const doc = await getDocument(url);
  const iframe = doc.querySelector("iframe");
  if (!iframe) return [];
  const src = iframe.src;
  return [{
    url: src,
    quality: src.includes(".m3u8") ? "HLS" : "Default",
    isM3U8: src.includes(".m3u8")
  }];
}

/** Exposed settings */
function getSettings() {
  return [
    { key: "scanPages",    type: "number", label: "Pages to Scan in Search", defaultValue: 3 },
    { key: "sortAZ",       type: "switch", label: "Sort Popular A→Z", defaultValue: false },
    { key: "preferredQuality", type: "picker", label: "Preferred Quality", options: ["HLS","Default"], defaultValue: "HLS" }
  ];
}

/** CommonJS export for Anymex/Anify JSON loader */
module.exports = {
  fetchPopular,
  search,
  fetchAnimeInfo,
  fetchEpisodes,
  loadEpisodeSources,
  getSettings
};
