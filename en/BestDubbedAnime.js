const BASE_URL = "https://bestdubbedanime.com";

/**
 * Scrape the “Series” paginated list.
 * @param {number} page
 * @returns {{ results: { title:string, url:string, thumbnail:string }[], hasNextPage: boolean }}
 */
async function fetchPopular(page) {
  const url = `${BASE_URL}/series?page=${page}`;
  const res = await fetch(url);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");

  const cards = Array.from(doc.querySelectorAll(".col-lg-2.col-md-3.col-6"));
  const results = cards.map(card => {
    const a = card.querySelector("a");
    const img = card.querySelector("img");
    const title = a?.getAttribute("title")?.trim() || a?.textContent?.trim() || "";
    const href = a?.getAttribute("href") || "";
    const thumbnail = img?.getAttribute("src") || "";
    return {
      title,
      url: href.startsWith("http") ? href : BASE_URL + href,
      thumbnail: thumbnail.startsWith("http") ? thumbnail : BASE_URL + thumbnail
    };
  });

  return {
    results,
    hasNextPage: cards.length > 0
  };
}

/**
 * “Search” by filtering page 1 of popular titles.
 * @param {string} query
 * @param {number} page
 * @returns {{ results: { title:string, url:string, thumbnail:string }[], hasNextPage: boolean }}
 */
async function search(query, page) {
  const { results } = await fetchPopular(1);
  const q = query.trim().toLowerCase();
  const filtered = results.filter(item =>
    item.title.toLowerCase().includes(q)
  );
  return {
    results: filtered,
    hasNextPage: false
  };
}

/**
 * Scrape an anime’s detail page: title, description, thumbnail, genres, and episodes.
 * @param {string} url
 * @returns {{
 *   title: string,
 *   description: string,
 *   thumbnail: string,
 *   genres: string[],
 *   episodes: { name:string, url:string }[]
 * }}
 */
async function fetchAnimeInfo(url) {
  const res = await fetch(url);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");

  const title = doc.querySelector("h1")?.textContent?.trim() || "";
  const description = doc.querySelector(".anime__details__text p")?.textContent?.trim() || "";
  const imgEl = doc.querySelector(".anime__details__pic img");
  const thumbnail = imgEl
    ? (imgEl.src.startsWith("http") ? imgEl.src : BASE_URL + imgEl.getAttribute("src"))
    : "";

  const genres = Array.from(doc.querySelectorAll(".anime__details__pager a"))
    .map(a => a.textContent.trim())
    .filter(g => g);

  const epEls = Array.from(doc.querySelectorAll(".episode-list a"));
  const episodes = epEls.map(el => ({
    name: el.textContent.trim(),
    url: el.href.startsWith("http") ? el.href : BASE_URL + el.getAttribute("href")
  }));

  return { title, description, thumbnail, genres, episodes };
}

/**
 * Returns the same episodes array from fetchAnimeInfo.
 * @param {string} url
 */
async function fetchEpisodes(url) {
  const info = await fetchAnimeInfo(url);
  return info.episodes;
}

/**
 * Load video sources by reading the first <iframe> on the episode page.
 * @param {string} url
 * @returns {{ url:string, quality:string, isM3U8:boolean }[]}
 */
async function loadEpisodeSources(url) {
  const res = await fetch(url);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
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
 * Expose user settings in the app.
 */
function getSettings() {
  return [
    {
      key: "sortAZ",
      type: "switch",
      label: "Sort Popular A→Z",
      defaultValue: false
    },
    {
      key: "preferredQuality",
      type: "picker",
      label: "Preferred Video Quality",
      options: ["HLS", "Default"],
      defaultValue: "HLS"
    }
  ];
}

module.exports = {
  fetchPopular,
  search,
  fetchAnimeInfo,
  fetchEpisodes,
  loadEpisodeSources,
  getSettings
};
