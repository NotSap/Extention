/** @type {import("@mangayomi/mangayomi-sources").AnimeScraper} */
class BestDubbedAnime extends AnimeScraper {
  constructor() {
    super();
    this.baseUrl = "https://bestdubbedanime.com";
  }

  async fetchPopularAnime(page) {
    const url = `${this.baseUrl}/series?page=${page}`;
    const res = await this.request(url);
    const doc = this.parser.parseFromString(res, "text/html");
    const elements = doc.querySelectorAll(".col-lg-2.col-md-3.col-6");

    const results = [];
    elements.forEach(el => {
      const title = el.querySelector("h6")?.textContent?.trim() ?? "";
      const href = el.querySelector("a")?.getAttribute("href") ?? "";
      const img = el.querySelector("img")?.getAttribute("src") ?? "";

      results.push({
        title,
        url: this.baseUrl + href,
        thumbnailUrl: img.startsWith("http") ? img : this.baseUrl + img
      });
    });

    return this.createPaginatedResults(results, false);
  }

  async fetchSearchAnime(search, page) {
    const url = `${this.baseUrl}/search?keyword=${encodeURIComponent(search)}`;
    const res = await this.request(url);
    const doc = this.parser.parseFromString(res, "text/html");
    const elements = doc.querySelectorAll(".col-lg-2.col-md-3.col-6");

    const results = [];
    elements.forEach(el => {
      const title = el.querySelector("h6")?.textContent?.trim() ?? "";
      const href = el.querySelector("a")?.getAttribute("href") ?? "";
      const img = el.querySelector("img")?.getAttribute("src") ?? "";

      results.push({
        title,
        url: this.baseUrl + href,
        thumbnailUrl: img.startsWith("http") ? img : this.baseUrl + img
      });
    });

    return this.createPaginatedResults(results, false);
  }

  async fetchAnimeInfo(url) {
    const res = await this.request(url);
    const doc = this.parser.parseFromString(res, "text/html");

    const title = doc.querySelector(".anime__details__title h3")?.textContent?.trim() ?? "No Title";
    const description = doc.querySelector(".anime__details__text p")?.textContent?.trim() ?? "";
    const thumbnailUrl = doc.querySelector(".anime__details__pic img")?.getAttribute("src") ?? "";

    return {
      title,
      description,
      thumbnailUrl: thumbnailUrl.startsWith("http") ? thumbnailUrl : this.baseUrl + thumbnailUrl,
      episodes: await this.fetchEpisodes(url)
    };
  }

  async fetchEpisodes(url) {
    const res = await this.request(url);
    const doc = this.parser.parseFromString(res, "text/html");
    const epElements = doc.querySelectorAll(".episode");

    const episodes = [];
    epElements.forEach((el, index) => {
      const href = el.querySelector("a")?.getAttribute("href") ?? "";
      const episodeNumber = index + 1;

      episodes.push({
        name: `Episode ${episodeNumber}`,
        url: this.baseUrl + href,
        number: episodeNumber
      });
    });

    return episodes;
  }

  async loadVideoSources(episodeUrl) {
    const res = await this.request(episodeUrl);
    const doc = this.parser.parseFromString(res, "text/html");

    const videoEl = doc.querySelector("iframe");
    const videoUrl = videoEl?.getAttribute("src") ?? "";

    if (!videoUrl) {
      return [];
    }

    return [
      {
        url: videoUrl,
        quality: "Default",
        isM3U8: videoUrl.includes(".m3u8")
      }
    ];
  }
}

export default BestDubbedAnime;
