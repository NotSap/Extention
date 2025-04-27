const BASE_URL = "https://bestdubbedanime.com";

/**
 * Helper: fetch & parse HTML document
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
 * Fetch one page of the series index.
 * @param {number} page
 * @returns {{ title:string, url:string, thumbnail:string }[]}
 */
async function fetchSeriesPage(page) {
  const doc = await getDocument(`${BASE_URL}/series?page=${page}`);
  return Array.from(doc.querySelectorAll(".col-lg-2.col-md-3.col-6")).map(card => {
    const a = card.querySelector("a");
    const img = card.querySelector("img");
    const title = (a.getAttribute("title") || a.textContent).trim();
    const href  = a.getAttribute("href");
    const thumb = img?.getAttribute("src") || "";
    return {
      title,
      url:  href.startsWith("http") ? href : BASE_URL + href,
      thumbnail: thumb.startsWith("http") ? thumb : BASE_URL + thumb
    };
  });
}

/**
 * Hook: fetchPopular(page)
 */
async function fetchPopular(page) {
  const results = await fetchSeriesPage(page);
  return { results, hasNextPage: results.length > 0 };
}

/**
 * Hook: search(query, page)
 * We load pages 1…N of series, then filter by title.
 */
async function search(query, page) {
  const maxPages = 3;  // adjust as needed
  const q = query.trim().toLowerCase();
  let all = [];
  for (let p = 1; p <= maxPages; p++) {
    try {
      const pageResults = await fetchSeriesPage(p);
      all = all.concat(pageResults);
      if (pageResults.length === 0) break;
    } catch {
      break;
    }
  }
  const filtered = all.filter(item => item.title.toLowerCase().includes(q));
  return { results: filtered, hasNextPage: false };
}

/**
 * Hook: fetchAnimeInfo(url)
 */
async function fetchAnimeInfo(url) {
  const doc = await getDocument(url);
  const title       = doc.querySelector("h1")?.textContent.trim() || "";
  const description = doc.querySelector(".anime__details__text p")?.textContent.trim() || "";
  const imgEl       = doc.querySelector(".anime__details__pic img");
  const thumbnail   = imgEl
    ? (imgEl.src.startsWith("http") ? imgEl.src : BASE_URL + imgEl.getAttribute("src"))
    : "";
  const genres = Array.from(doc.querySelectorAll(".anime__details__pager a"))
    .map(a => a.textContent.trim())
    .filter(Boolean);

  const episodes = Array.from(doc.querySelectorAll(".episode-list a")).map(el => ({
    name: el.textContent.trim(),
    url:  el.href.startsWith("http") ? el.href : BASE_URL + el.getAttribute("href")
  }));

  return { title, description, thumbnail, genres, episodes };
}

/**
 * Hook: fetchEpisodes(url)
 */
async function fetchEpisodes(url) {
  const info = await fetchAnimeInfo(url);
  return info.episodes;
}

/**
 * Hook: loadEpisodeSources(url)
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

/**
 * Hook: getSettings()
 */
function getSettings() {
  return [
    { key: "scanPages",        type: "number", label: "Pages to Scan in Search", defaultValue: 3 },
    { key: "sortAZ",           type: "switch", label: "Sort Popular A→Z",        defaultValue: false },
    { key: "preferredQuality", type: "picker", label: "Preferred Video Quality",
      options: ["HLS", "Default"], defaultValue: "HLS" }
  ];
}

/** Export exactly what the JSON loader expects */
module.exports = {
  fetchPopular,
  search,
  fetchAnimeInfo,
  fetchEpisodes,
  loadEpisodeSources,
  getSettings
};
