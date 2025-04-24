const BASE_URL = "https://aniwatchtv.to";

async function search(query) {
  try {
    const doc = await getHtml(`${BASE_URL}/search?keyword=${encodeURIComponent(query)}`);
    const results = [];

    const cards = doc.querySelectorAll(".film_list-wrap .flw-item");

    if (!cards || cards.length === 0) {
      throw new Error("No search results found or page structure may have changed.");
    }

    cards.forEach((card) => {
      const title = card.querySelector(".film-name a")?.textContent.trim();
      const url = card.querySelector(".film-name a")?.href;
      const thumbnailUrl = card.querySelector(".film-poster img")?.src;

      if (title && url && thumbnailUrl) {
        results.push({ title, url, thumbnailUrl });
      }
    });

    return results;
  } catch (err) {
    console.error("Search error:", err);
    return [];
  }
}

async function fetchAnimeInfo(url) {
  try {
    const doc = await getHtml(url);
    const title = doc.querySelector("h2.film-name")?.textContent.trim() || "";
    const description = doc.querySelector(".description")?.textContent.trim() || "";
    const thumbnailUrl = doc.querySelector(".film-poster img")?.src || "";

    return {
      title,
      description,
      thumbnailUrl,
      episodes: await fetchEpisodes(url)
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

    return episodes;
  } catch (err) {
    console.error("fetchEpisodes error:", err);
    return [];
  }
}

async function loadEpisodeSources(episodeUrl) {
  try {
    const doc = await getHtml(episodeUrl);
    const scriptTags = doc.querySelectorAll("script");
    let sourceUrl = "";

    scriptTags.forEach((script) => {
      if (script.textContent.includes("playerInstance") && script.textContent.includes("file")) {
        const match = script.textContent.match(/file:\s*["'](https?:\/\/[^"']+)["']/);
        if (match) sourceUrl = match[1];
      }
    });

    if (!sourceUrl) throw new Error("No playable source found.");

    return [{ url: sourceUrl, quality: "default" }];
  } catch (err) {
    console.error("loadEpisodeSources error:", err);
    return [];
  }
}
