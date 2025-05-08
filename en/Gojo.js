const mangayomiSources = [{
  "name": "Gojo",
  "id": 1018827104,
  "baseUrl": "https://gojo.wtf",
  "lang": "en",
  "typeSource": "multi",
  "iconUrl": "https://www.google.com/s2/favicons?sz=128&domain=https://gojo.wtf/",
  "dateFormat": "",
  "dateFormatLocale": "",
  "isNsfw": false,
  "hasCloudflare": false,
  "sourceCodeUrl": "https://raw.githubusercontent.com/NotSap/Extention/main/en/Gojo.js",
  "apiUrl": "",
  "version": "0.0.6",
  "isManga": false,
  "itemType": 1,
  "isFullData": false,
  "appMinVerReq": "0.5.0",
  "additionalParams": "",
  "sourceCodeLanguage": 1
}];

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Referer": "https://gojo.wtf/"
    };
  }

  async search(query, page, filters) {
    try {
      const searchUrl = `https://gojo.wtf/filter?keyword=${encodeURIComponent(query)}`;
      const client = new Client();
      const response = await client.get(searchUrl, { headers: this.headers });
      const doc = new DOMParser().parseFromString(response.body, "text/html");

      const items = Array.from(doc.querySelectorAll('.film_list-wrap .flw-item')).map(item => {
        const isDub = item.querySelector('.tick-dub') !== null;
        const titleEl = item.querySelector('.film-name a');
        const imgEl = item.querySelector('img[data-src]') || item.querySelector('img');

        return {
          name: titleEl?.textContent.trim() + (isDub ? ' (Dub)' : ''),
          url: titleEl?.href,
          imageUrl: imgEl?.dataset.src || imgEl?.src || '',
          language: isDub ? 'dub' : 'sub'
        };
      }).filter(item => item.name && item.url);

      return {
        list: items,
        hasNextPage: items.length >= 20
      };

    } catch (error) {
      console.error("Search error:", error);
      return { list: [], hasNextPage: false };
    }
  }

  async getDetail(url) {
    try {
      const client = new Client();
      const response = await client.get(url, { headers: this.headers });
      const doc = new DOMParser().parseFromString(response.body, "text/html");

      const episodes = Array.from(doc.querySelectorAll('.eps li')).map(ep => {
        const isDub = ep.querySelector('.dub') !== null;
        const num = parseInt(ep.querySelector('a')?.textContent.trim().replace(/\D+/g, '')) || 0;
        return {
          num,
          name: `Episode ${num}${isDub ? ' (Dub)' : ''}`,
          url: ep.querySelector('a').href,
          scanlator: isDub ? 'Gojo-Dub' : 'Gojo-Sub'
        };
      }).reverse();

      return {
        description: doc.querySelector('.description')?.textContent.trim() || '',
        status: doc.querySelector('.status')?.textContent.includes('Ongoing') ? 0 : 1,
        genre: Array.from(doc.querySelectorAll('.genre a')).map(g => g.textContent.trim()),
        episodes
      };
    } catch (error) {
      console.error("Detail error:", error);
      return {
        description: "Failed to load details",
        status: 5,
        genre: [],
        episodes: []
      };
    }
  }

  async getVideoList(url) {
    try {
      const client = new Client();
      const response = await client.get(url, { headers: this.headers });
      const html = response.body;

      const videoMatch = html.match(/"file":"([^"]+)"/);
      const videoUrl = videoMatch ? videoMatch[1].replace(/\\u0026/g, '&') : null;

      if (!videoUrl) return [];

      return [{
        url: videoUrl,
        quality: "1080p",
        isM3U8: videoUrl.includes('.m3u8'),
        headers: { "Referer": "https://gojo.wtf/" }
      }];
    } catch (error) {
      console.error("Video error:", error);
      return [];
    }
  }

  async getPopular(page) {
    return this.search("popular", page);
  }

  async getLatestUpdates(page) {
    return this.search("latest", page);
  }
}
