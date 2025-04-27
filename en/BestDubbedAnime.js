const BASE_URL = "https://bestdubbedanime.com";

/**  
 * @param {number} page  
 * @returns {{ results: { title: string, url: string, thumbnail: string }[], hasNextPage: boolean }}  
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
    const title = (a.getAttribute("title") || a.textContent).trim();  
    const href  = a.getAttribute("href");  
    const thumb = img.getAttribute("src");  

    return {  
      title,  
      url: href.startsWith("http") ? href : BASE_URL + href,  
      thumbnail: thumb.startsWith("http") ? thumb : BASE_URL + thumb  
    };  
  });  

  return { results, hasNextPage: cards.length > 0 };  
}  

/**  
 * @param {string} query  
 * @param {number} page  
 * @returns {{ results: { title: string, url: string, thumbnail: string }[], hasNextPage: boolean }}  
 */  
async function search(query, page) {  
  // site has no real search API, so filter page-1 popular by title  
  const { results } = await fetchPopular(1);  
  const q = query.trim().toLowerCase();  
  const filtered = results.filter(item => item.title.toLowerCase().includes(q));  
  return { results: filtered, hasNextPage: false };  
}  

/**  
 * @param {string} url  
 * @returns {{ title: string, description: string, thumbnail: string, genres: string[], episodes: { name: string, url: string }[] }}  
 */  
async function fetchAnimeInfo(url) {  
  const res = await fetch(url);  
  const html = await res.text();  
  const doc = new DOMParser().parseFromString(html, "text/html");  

  const title       = doc.querySelector("h1")?.textContent?.trim() || "";  
  const description = doc.querySelector(".anime__details__text p")?.textContent?.trim() || "";  
  const imgEl       = doc.querySelector(".anime__details__pic img");  
  const thumbnail   = imgEl  
    ? (imgEl.src.startsWith("http") ? imgEl.src : BASE_URL + imgEl.getAttribute("src"))  
    : "";  

  const genres = Array.from(doc.querySelectorAll(".anime__details__pager a"))  
    .map(a => a.textContent.trim())  
    .filter(Boolean);  

  const epEls = Array.from(doc.querySelectorAll(".episode-list a"));  
  const episodes = epEls.map(el => ({  
    name: el.textContent.trim(),  
    url: el.href.startsWith("http") ? el.href : BASE_URL + el.getAttribute("href")  
  }));  

  return { title, description, thumbnail, genres, episodes };  
}  

/**  
 * @param {string} url  
 * @returns {{ name: string, url: string }[]}  
 */  
async function fetchEpisodes(url) {  
  const info = await fetchAnimeInfo(url);  
  return info.episodes;  
}  

/**  
 * @param {string} url  
 * @returns {{ url: string, quality: string, isM3U8: boolean }[]}  
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
 * @returns {import("@mangayomi/mangayomi-sources").ExtensionSetting[]}  
 */  
function getSettings() {  
  return [  
    { key: "sortAZ", type: "switch", label: "Sort Popular A→Z", defaultValue: false },  
    { key: "preferredQuality", type: "picker", label: "Preferred Video Quality", options: ["HLS", "Default"], defaultValue: "HLS" }  
  ];  
}  

// Export exactly what the JSON loader expects  
module.exports = {  
  fetchPopular,  
  search,  
  fetchAnimeInfo,  
  fetchEpisodes,  
  loadEpisodeSources,  
  getSettings  
};  
