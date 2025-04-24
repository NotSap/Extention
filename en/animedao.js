class AnimeDao {
  constructor() {
    this.id = 987654321;
    this.name = "AnimeDao";
    this.baseUrl = "https://animedao.com.ru";
    this.lang = "en";
    this.iconUrl = "https://www.google.com/s2/favicons?sz=256&domain=https://animedao.com.ru/";
    this.isNsfw = false;
    this.hasCloudflare = false;
    this.version = "1.0.0";
    this.itemType = 1;
  }

  async getAnimeList(page) {
    const url = `${this.baseUrl}/popular-anime${page > 1 ? `?page=${page}` : ''}`;
    const response = await this.request(url);
    const $ = this.cheerio.load(response);
    
    return $('div.anime-list div.anime-item').map((i, el) => {
      const element = $(el);
      return {
        id: element.find('a').attr('href'),
        title: element.find('h5').text().trim(),
        thumbnail: element.find('img').attr('data-src') || element.find('img').attr('src'),
        url: `${this.baseUrl}${element.find('a').attr('href')}`
      };
    }).get();
  }

  async getAnimeDetails(id) {
    const response = await this.request(id);
    const $ = this.cheerio.load(response);
    
    return {
      title: $('h1.title').text().trim(),
      description: $('div.anime-details p').text().trim(),
      thumbnail: $('div.anime-info-poster img').attr('src'),
      genres: $('div.anime-info-genres a').map((i, el) => $(el).text().trim()).get(),
      status: this.parseStatus($('div.anime-info-status:contains(Status) + div').text().trim()),
      episodes: await this.getEpisodes(id)
    };
  }

  async getEpisodes(id) {
    const response = await this.request(id);
    const $ = this.cheerio.load(response);
    
    return $('ul.episodes-range li').map((i, el) => {
      const element = $(el);
      return {
        id: element.find('a').attr('href'),
        number: parseFloat(element.attr('data-jname')) || 0,
        title: `Episode ${element.attr('data-jname')}${element.find('span.episode-title').text() ? ' - ' + element.find('span.episode-title').text() : ''}`,
        url: `${this.baseUrl}${element.find('a').attr('href')}`
      };
    }).get().reverse();
  }

  async getVideoSources(episodeId) {
    const response = await this.request(episodeId);
    const $ = this.cheerio.load(response);
    const iframeUrl = $('#video-player').attr('src');
    
    return [{
      url: iframeUrl,
      quality: 'default',
      isM3U8: iframeUrl.includes('.m3u8'),
      isDASH: false
    }];
  }

  async search(query, page) {
    const url = `${this.baseUrl}/search.html?keyword=${encodeURIComponent(query)}${page > 1 ? `&page=${page}` : ''}`;
    const response = await this.request(url);
    const $ = this.cheerio.load(response);
    
    return $('div.anime-list div.anime-item').map((i, el) => {
      const element = $(el);
      return {
        id: element.find('a').attr('href'),
        title: element.find('h5').text().trim(),
        thumbnail: element.find('img').attr('data-src') || element.find('img').attr('src'),
        url: `${this.baseUrl}${element.find('a').attr('href')}`
      };
    }).get();
  }

  parseStatus(status) {
    status = status.toLowerCase();
    if (status.includes('ongoing')) return 0;
    if (status.includes('completed')) return 1;
    return 2; // unknown
  }

  async request(url, options = {}) {
    return await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
        'Referer': this.baseUrl
      },
      ...options
    }).then(res => res.text());
  }
}

const animedao = new AnimeDao();
return animedao;
