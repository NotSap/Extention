globalThis.source = {
  name: "Aniwatchtv",
  lang: "en",
  domains: ["aniwatchtv.to"],
  isAdult: false,

  search: async (query, page, filters) => {
    const searchUrl = `https://aniwatchtv.to/search?keyword=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl);
    const text = await res.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/html");

    const animeList = [];
    const items = doc.querySelectorAll(".film_list-wrap .flw-item");

    items.forEach(item => {
      const title = item.querySelector(".film-name a")?.textContent.trim() || "";
      const url = item.querySelector(".film-name a")?.getAttribute("href") || "";
      const poster = item.querySelector("img")?.getAttribute("data-src") || "";

      animeList.push({
        title: title,
        url: "https://aniwatchtv.to" + url,
        thumbnail: poster,
      });
    });

    return animeList;
  },

  fetchAnimeInfo: async (url) => {
    const res = await fetch(url);
    const text = await res.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/html");

    const title = doc.querySelector(".film-name")?.textContent.trim() || "";
    const description = doc.querySelector(".description")?.textContent.trim() || "";
    const genres = Array.from(doc.querySelectorAll(".item.item-list a")).map(el => el.textContent.trim());
    const poster = doc.querySelector(".film-poster img")?.getAttribute("src") || "";

    return {
      title: title,
      description: description,
      genres: genres,
      thumbnail: poster,
    };
  },

  fetchEpisodes: async (url) => {
    const res = await fetch(url);
    const text = await res.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/html");

    const episodes = [];
    const episodeItems = doc.querySelectorAll(".episodes li");

    episodeItems.forEach((item, index) => {
      const episodeUrl = item.querySelector("a")?.getAttribute("href") || "";
      const episodeNumber = item.querySelector("a")?.textContent.trim() || `Episode ${index + 1}`;

      episodes.push({
        name: episodeNumber,
        url: "https://aniwatchtv.to" + episodeUrl,
        number: index + 1,
      });
    });

    return episodes.reverse();
  },

  loadEpisodeSources: async (url) => {
    const res = await fetch(url);
    const text = await res.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/html");

    const iframe = doc.querySelector("iframe");
    if (!iframe) return [];

    const embedUrl = iframe.getAttribute("src");
    return [
      {
        url: embedUrl.startsWith("http") ? embedUrl : "https:" + embedUrl,
        quality: "default",
      },
    ];
  },
};
