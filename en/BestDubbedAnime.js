;(function(root) {
  const BASE_URL = "https://bestdubbedanime.com";

  /** 1) Hook implementations **/

  async function fetchPopular(page) {
    const url = `${BASE_URL}/series?page=${page}`;
    const res = await fetch(url);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const cards = Array.from(doc.querySelectorAll(".col-lg-2.col-md-3.col-6"));
    return {
      results: cards.map(card => {
        const a = card.querySelector("a");
        const img = card.querySelector("img");
        const title = (a.getAttribute("title") || a.textContent).trim();
        const href = a.getAttribute("href");
        const thumb = img.getAttribute("src");
        return {
          title,
          url: href.startsWith("http") ? href : BASE_URL + href,
          thumbnail: thumb.startsWith("http") ? thumb : BASE_URL + thumb
        };
      }),
      hasNextPage: cards.length > 0
    };
  }

  async function search(query, page) {
    // filter page 1 of popular
    const { results } = await fetchPopular(1);
    const q = query.trim().toLowerCase();
    return {
      results: results.filter(item =>
        item.title.toLowerCase().includes(q)
      ),
      hasNextPage: false
    };
  }

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
      .map(a => a.textContent.trim());
    const epEls = Array.from(doc.querySelectorAll(".episode-list a"));
    const episodes = epEls.map(el => ({
      name: el.textContent.trim(),
      url: el.href.startsWith("http") ? el.href : BASE_URL + el.getAttribute("href")
    }));
    return { title, description, thumbnail, genres, episodes };
  }

  async function fetchEpisodes(url) {
    const info = await fetchAnimeInfo(url);
    return info.episodes;
  }

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

  function getSettings() {
    return [
      { key: "sortAZ", type: "switch", label: "Sort Popular A→Z", defaultValue: false },
      { key: "preferredQuality", type: "picker", label: "Preferred Video Quality",
        options: ["HLS","Default"], defaultValue: "HLS" }
    ];
  }

  /** 2) Package into one object **/
  const extension = {
    fetchPopular,
    search,
    fetchAnimeInfo,
    fetchEpisodes,
    loadEpisodeSources,
    getSettings
  };

  /** 3) Expose for all loaders **/
  // Script-injection style
  root.extension = extension;
  // CommonJS
  if (typeof module !== "undefined" && module.exports) module.exports = extension;
  // ES Module (some loaders)
  if (typeof define === "function" && define.amd) define(() => extension);
  // Also support export default for bundlers/transpilers
  try { export default extension; } catch {}
})(typeof globalThis !== "undefined" ? globalThis : this);
