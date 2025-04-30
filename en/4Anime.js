globalThis.extension = new Extension({
  name: "4AnimeGG",
  description: "4anime.gg source for dubbed anime",
  version: "1.0.0",
  lang: "en",
  baseUrl: "https://4anime.gg",
  isAdult: false,
  isDub: true,

  search: async function (query) {
    const res = await fetch(`https://4anime.gg/search?keyword=${encodeURIComponent(query)}`);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const items = Array.from(doc.querySelectorAll(".items .item"));

    return items.map((el) => ({
      title: el.querySelector("h3")?.textContent.trim(),
      url: el.querySelector("a")?.href,
      thumbnail: el.querySelector("img")?.src,
    }));
  },

  fetchAnimeInfo: async function (animeUrl) {
    const res = await fetch(animeUrl);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    const title = doc.querySelector("h1")?.textContent.trim();
    const episodes = Array.from(doc.querySelectorAll(".episodes a")).map((a) => ({
      title: a.textContent.trim(),
      url: a.href,
    }));

    return {
      title,
      episodes,
    };
  },

  loadEpisodeSources: async function (episodeUrl) {
    const res = await fetch(episodeUrl);
    const html = await res.text();
    const match = html.match(/"file":"(https:[^"]+\.mp4)"/);
    const videoUrl = match ? match[1].replace(/\\\//g, "/") : null;

    if (!videoUrl) throw new Error("Video source not found");

    return [
      {
        url: videoUrl,
        quality: "default",
        isM3U8: videoUrl.includes(".m3u8"),
      },
    ];
  },
});
