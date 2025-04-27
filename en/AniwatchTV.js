import {
  Extension,
  Source,
  SourceInfo,
  SourceInt,
  Chapter,
  ChapterDetails,
  HomeSection,
  HomeSectionType,
  MangaTile,
  PagedResults,
  Request,
  SearchRequest,
  SourceManga,
  Tag,
} from "paperback-extensions-common";

const AniwatchTV_DOMAIN = "https://aniwatchtv.to";

class AniwatchTV extends Source {
  constructor() {
    super();
    this.baseUrl = AniwatchTV_DOMAIN;
  }

  get version() {
    return "1.0.0";
  }

  get name() {
    return "AniwatchTV";
  }

  get iconUrl() {
    return "https://www.google.com/s2/favicons?sz=256&domain=aniwatchtv.to";
  }

  async getAnimeInfo(animeId) {
    const response = await fetch(`${this.baseUrl}/watch/${animeId}`);
    const html = await response.text();

    const episodes = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const episodesElements = doc.querySelectorAll(".episodes li a");
    episodesElements.forEach((ep) => {
      const id = ep.getAttribute("href").split("/").pop();
      const title = ep.textContent.trim();
      episodes.push({
        id: id,
        number: parseFloat(title) || 0,
        title: title,
      });
    });

    return {
      id: animeId,
      title: doc.querySelector(".film-name")?.textContent.trim() || animeId,
      episodes: episodes.reverse(),
    };
  }

  async getEpisodes(animeId) {
    return this.getAnimeInfo(animeId);
  }

  async getEpisodeSources(episodeId) {
    return [
      {
        url: `${this.baseUrl}/streaming.php?id=${episodeId}`,
        quality: "default",
        isM3U8: false,
      },
    ];
  }

  async search(request) {
    const query = request.query;
    if (!query) return { results: [] };

    const response = await fetch(`${this.baseUrl}/search?keyword=${encodeURIComponent(query)}`);
    const html = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const results = [];
    const elements = doc.querySelectorAll(".film_list-wrap .flw-item");
    elements.forEach((el) => {
      const link = el.querySelector("a");
      const id = link.getAttribute("href").split("/").pop();
      const title = el.querySelector(".dynamic-name")?.textContent.trim() || "Unknown Title";

      results.push({
        id: id,
        title: title,
      });
    });

    return { results };
  }
}

globalThis.extension = new AniwatchTV();
