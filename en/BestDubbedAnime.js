;(function() {
  const BASE_URL = "https://bestdubbedanime.com";

  // Helper: fetch & parse an HTML page
  async function getDoc(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return new DOMParser().parseFromString(text, "text/html");
  }

  // Fetch one page of the series index
  async function fetchSeriesPage(page) {
    const doc = await getDoc(`${BASE_URL}/series?page=${page}`);
    return Array.from(
      doc.querySelectorAll(".col-lg-2.col-md-3.col-6")
    ).map(card => {
      const a = card.querySelector("a");
      const img = card.querySelector("img");
      const title = (a.getAttribute("title") || a.textContent).trim();
      const href = a.getAttribute("href");
      const thumb = img?.getAttribute("src") || "";
      return {
        title,
        url: href.startsWith("http") ? href : BASE_URL + href,
        thumbnail: thumb.startsWith("http") ? thumb : BASE_URL + thumb
      };
    });
  }

  // Hook: fetchPopular(page)
  async function fetchPopular(page) {
    const results = await fetchSeriesPage(page);
    return { results, hasNextPage: results.length > 0 };
  }

  // Hook: search(query, page)
  async function search(query, page) {
    const maxPages = 3;            // scan first 3 pages; bump if you need more
    const q = query.trim().toLowerCase();
    let all = [];
    for (let p = 1; p <= maxPages; p++) {
      let pageList = [];
      try {
        pageList = await fetchSeriesPage(p);
      } catch {
        break;
      }
      if (!pageList.length) break;
      all = all.concat(pageList);
    }
    const filtered = all.filter(item =>
      item.title.toLowerCase().includes(q)
    );
    return { results: filtered, hasNextPage: false };
  }

  // Hook: fetchAnimeInfo(url)
  async function fetchAnimeInfo(url) {
    const doc = await getDoc(url);
    const title = doc.querySelector("h1")?.textContent.trim() || "";
    const description =
      doc.querySelector(".anime__details__text p")?.textContent.trim() || "";
    const imgEl = doc.querySelector(".anime__details__pic img");
    const thumbnail = imgEl
      ? (imgEl.src.startsWith("http")
          ? imgEl.src
          : BASE_URL + imgEl.getAttribute("src"))
      : "";
    const genres = Array.from(
      doc.querySelectorAll(".anime__details__pager a")
    ).map(a => a.textContent.trim()).filter(Boolean);
    const episodes = Array.from(
      doc.querySelectorAll(".episode-list a")
    ).map(el => ({
      name: el.textContent.trim(),
      url: el.href.startsWith("http")
        ? el.href
        : BASE_URL + el.getAttribute("href")
    }));
    return { title, description, thumbnail, genres, episodes };
  }

  // Hook: fetchEpisodes(url)
  async function fetchEpisodes(url) {
    const info = await fetchAnimeInfo(url);
    return info.episodes;
  }

  // Hook: loadEpisodeSources(url)
  async function loadEpisodeSources(url) {
    const doc = await getDoc(url);
    const iframe = doc.querySelector("iframe");
    if (!iframe) return [];
    const src = iframe.src;
    return [{
      url: src,
      quality: src.includes(".m3u8") ? "HLS" : "Default",
      isM3U8: src.includes(".m3u8")
    }];
  }

  // Hook: getSettings()
  function getSettings() {
    return [
      { key: "scanPages",    type: "number", label: "Pages to Scan in Search", defaultValue: 3 },
      { key: "sortAZ",       type: "switch", label: "Sort Popular A→Z",        defaultValue: false },
      { key: "preferredQuality", type: "picker", label: "Preferred Video Quality",
        options: ["HLS","Default"], defaultValue: "HLS" }
    ];
  }

  // Expose for both script-injection and JSON loaders
  const extension = {
    fetchPopular,
    search,
    fetchAnimeInfo,
    fetchEpisodes,
    loadEpisodeSources,
    getSettings
  };

  // Script-injection loader
  globalThis.extension = extension;
  // CommonJS loader (AnymeX/Anify via JSON index)
  if (typeof module !== "undefined" && module.exports) {
    module.exports = extension;
  }
})();
