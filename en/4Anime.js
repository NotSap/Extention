globalThis.extension = new Extension({
  name: "4AnimeGG",
  description: "4anime.gg source for dubbed anime",
  version: "1.0.0",
  author: "You",
  lang: "en",
  baseUrl: "https://4anime.gg",
  isAdult: false,
  isDub: true,

  search: async (query) => {
    const res = await fetch(`https://4anime.gg/search?keyword=${encodeURIComponent(query)}`);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const items = [...doc.querySelectorAll(".items .item")];

    return items.map((el) => {
      const title = el.querySelector(".name")?.textContent.trim();
      const url = el.querySelector("a")?.href;
      const img = el.querySelector("img")?.src;

      return {
        title,
        url,
        img,
      };
    });
  },

  fetchAnimeInfo: async (animeUrl) => {
    const res = await fetch(animeUrl);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    const title = doc.querySelector("h1")?.textContent.trim();
    const episodes = [...doc.querySelectorAll(".episodes a")].map((el) => ({
      title: el.textContent.trim(),
      url: el.href,
    }));

    return {
      title,
      episodes,
    };
  },

  loadEpisodeSources: async (episodeUrl) => {
    const res = await fetch(episodeUrl);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    const iframe = doc.querySelector("iframe");
    const videoUrl = iframe?.src;

    if (!videoUrl) return [];

    return [
      {
        url: videoUrl,
        type: "hls",
        quality: "auto",
      },
    ];
  },
});
