const BASE_URL = "https://aniwatchtv.to";

const settings = {
  preferredQuality: "1080p", // Options: "1080p", "720p", "480p"
};

async function getHtml(url) {
  const response = await fetch(url);
  const text = await response.text();
  const parser = new DOMParser();
  return parser.parseFromString(text, "text/html");
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
  try {
    const doc = await getHtml(url);
    const title = doc.querySelector("h2.film-name")?.textContent?.trim() || "";
    const description = doc.querySelector(".description")?.textContent?.trim() || "";
    const thumbnailUrl = doc.querySelector(".film-poster img")?.src || "";
    const episodes = await fetchEpisodes(url);

    return {
      title,
      description,
      thumbnailUrl,
      episodes
    };
  } catch (err) {
    console.error("fetchAnimeInfo error:", err);
    return null;
  }
}

async function fetchEpisodes(url) {
  try {
    const doc = await getHtml(url);
    const episodeElements = doc.querySelectorAll(".episodes li a");
    const episodes = [];

    episodeElements.forEach((ep) => {
      const epTitle = ep.textContent.trim();
      const epUrl = ep.href;

      if (epTitle && epUrl) {
        episodes.push({ title: epTitle, url: epUrl });
      }
    });

    return episodes.reverse();
  } catch (err) {
    console.error("fetchEpisodes error:", err);
    return [];
  }
}

async function loadEpisodeSources(episodeUrl) {
  try {
    const doc = await getHtml(episodeUrl);
    const iframe = doc.querySelector("iframe");
    if (!iframe) return [];

    const embedUrl = iframe.src.startsWith("http") ? iframe.src : `${BASE_URL}${iframe.src}`;
    const embedDoc = await getHtml(embedUrl);
    const sources = [];

    embedDoc.querySelectorAll("source").forEach((source) => {
      const quality = source.getAttribute("label") || "default";
      if (quality === settings.preferredQuality) {
        sources.push({
          url: source.src,
          quality,
          isM3U8: source.src.includes(".m3u8")
        });
      }
    });

    return sources;
  } catch (err) {
    console.error("loadEpisodeSources error:", err);
    return [];
  }
}
