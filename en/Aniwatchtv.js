/**
 * @name AniWatchTV
 * @version 1.0.0
 * @description Extension for AniWatchTV to be used in Anymex (Mangayomi)
 */

const BASE_URL = "https://aniwatchtv.to";

async function getHtml(url) {
  const response = await fetch(url);
  const text = await response.text();
  const parser = new DOMParser();
  return parser.parseFromString(text, "text/html");
}

async function fetchAnimeInfo(animeUrl) {
  const doc = await getHtml(animeUrl);
  const title = doc.querySelector("h1")?.textContent.trim();
  const description = doc.querySelector("p.synopsis")?.textContent.trim();
  const thumbnailUrl = doc.querySelector(".anime-thumbnail img")?.src;

  return {
    title,
    description,
    thumbnailUrl,
    episodes: await fetchEpisodes(animeUrl),
  };
}

async function fetchEpisodes(animeUrl) {
  const doc = await getHtml(animeUrl);
  const episodes = [];
  const episodeElements = doc.querySelectorAll(".episodes li a");

  episodeElements.forEach((el, i) => {
    episodes.push({
      number: i + 1,
      title: el.textContent.trim(),
      url: el.href,
    });
  });

  return episodes;
}

async function loadEpisodeSources(episodeUrl) {
  const doc = await getHtml(episodeUrl);
  const scripts = doc.querySelectorAll("script");
  let sources = [];

  scripts.forEach((script) => {
    const content = script.textContent;
    const match = content.match(/sources:\s*(\[[^\]]+\])/);
    if (match) {
      try {
        sources = JSON.parse(match[1]);
      } catch (e) {
        console.error("Error parsing sources JSON:", e);
      }
    }
  });

  return sources.map((source) => ({
    url: source.file,
    quality: source.label,
    isM3U8: source.file.includes(".m3u8"),
  }));
}

async function fetchPopular() {
  const doc = await getHtml(`${BASE_URL}/most-popular`);
  const results = [];

  doc.querySelectorAll(".anime-card").forEach((card) => {
    results.push({
      title: card.querySelector(".anime-title")?.textContent.trim(),
      url: card.querySelector("a")?.href,
      thumbnailUrl: card.querySelector("img")?.src,
    });
  });

  return results;
}

async function search(query) {
  const doc = await getHtml(`${BASE_URL}/search?keyword=${encodeURIComponent(query)}`);
  const results = [];

  doc.querySelectorAll(".anime-card").forEach((card) => {
    results.push({
      title: card.querySelector(".anime-title")?.textContent.trim(),
      url: card.querySelector("a")?.href,
      thumbnailUrl: card.querySelector("img")?.src,
    });
  });

  return results;
}
