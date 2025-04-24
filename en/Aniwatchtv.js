const BASE_URL = "https://aniwatchtv.to";

async function fetchPopular() {
  const doc = await getHtml(`${BASE_URL}/top-airing`);
  const results = [];

  doc.querySelectorAll(".film_list-wrap .flw-item").forEach((item) => {
    const anchor = item.querySelector(".film-name a");
    const img = item.querySelector(".film-poster img");

    if (!anchor || !img) return;

    results.push({
      title: anchor.textContent?.trim() || "No Title",
      url: anchor.href,
      thumbnailUrl: img.getAttribute("data-src") || img.src
    });
  });

  return results;
}

async function search(query) {
  try {
    const doc = await getHtml(`${BASE_URL}/search?keyword=${encodeURIComponent(query)}`);
    const results = [];

    const cards = doc.querySelectorAll(".film_list-wrap .flw-item");
    if (!cards || cards.length === 0) throw new Error("No anime found for search.");

    cards.forEach((card) => {
      const anchor = card.querySelector(".film-name a");
      const img = card.querySelector(".film-poster img");

      if (!anchor || !img) return;

      results.push({
        title: anchor.textContent?.trim() || "No Title",
        url: anchor.href,
        thumbnailUrl: img.getAttribute("data-src") || img.src
      });
    });

    return results;
  } catch (err) {
    console.error("Search function failed:", err);
    return [];
  }
}

async function fetchAnimeInfo(url) {
  const doc = await getHtml(url);
  const episodes = [];

  doc.querySelectorAll("ul#episodes li").forEach((li) => {
    const a = li.querySelector("a");
    if (a) {
      episodes.push({
        number: parseFloat(a.textContent.trim()),
        url: a.href,
        name: a.textContent.trim()
      });
    }
  });

  return {
    title: doc.querySelector("h2.film-name")?.textContent?.trim() || "",
    description: doc.querySelector(".description")?.textContent?.trim() || "",
    episodes: episodes.reverse()
  };
}

async function fetchEpisodes(animeUrl) {
  return await fetchAnimeInfo(animeUrl);
}

async function loadEpisodeSources(episodeUrl) {
  const doc = await getHtml(episodeUrl);
  const iframe = doc.querySelector("iframe");
  if (!iframe) return [];

  const embedUrl = iframe.src.startsWith("http") ? iframe.src : `${BASE_URL}${iframe.src}`;
  const embedHtml = await getHtml(embedUrl);
  const sources = [];

  embedHtml.querySelectorAll("source").forEach((source) => {
    sources.push({
      url: source.src,
      quality: source.getAttribute("label") || "default",
      isM3U8: source.src.includes(".m3u8")
    });
  });

  return sources;
}
