const extension = {
  name: "BestDubbedAnime",
  lang: "en",
  baseUrl: "https://bestdubbedanime.com",
  isManga: false,
  isNsfw: false,
  headers: {},
  
  search: async (query, page, { fetch }) => {
    const url = `https://bestdubbedanime.com/?s=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    
    const elements = [...doc.querySelectorAll(".post")];

    const results = elements.map((el) => {
      const title = el.querySelector(".post-title a")?.textContent?.trim() || "No title";
      const cover = el.querySelector("img")?.getAttribute("src") || "";
      const link = el.querySelector(".post-title a")?.getAttribute("href") || "";

      return {
        title: title,
        url: link,
        cover: cover,
      };
    });

    return { results };
  },

  fetchAnimeInfo: async (url, { fetch }) => {
    const res = await fetch(url);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    const title = doc.querySelector("h1")?.textContent?.trim() || "No Title";

    const episodes = [...doc.querySelectorAll(".episodes-list a")].map((ep) => ({
      title: ep.textContent.trim(),
      url: ep.href,
    }));

    return { title, episodes };
  },

  loadEpisodeSources: async (url, { fetch }) => {
    const res = await fetch(url);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    const iframe = doc.querySelector("iframe");
    if (!iframe) throw new Error("No video iframe found.");

    return [
      {
        url: iframe.src,
        quality: "Unknown",
        isM3U8: iframe.src.includes(".m3u8"),
      },
    ];
  },
};
