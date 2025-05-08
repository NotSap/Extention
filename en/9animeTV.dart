const mangayomiSources = [{
  "name": "9AnimeTV (Fixed)",
  "id": 957331416,
  "baseUrl": "https://9animetv.to",
  "lang": "en",
  "typeSource": "single",
  "iconUrl": "https://raw.githubusercontent.com/kodjodevf/mangayomi-extensions/main/dart/anime/src/en/nineanimetv/icon.png",
  "dateFormat": "",
  "dateFormatLocale": "",
  "isNsfw": false,
  "hasCloudflare": false,
  "version": "1.0.2",
  "isManga": false,
  "itemType": 1,
  "isFullData": false,
  "appMinVerReq": "0.5.0"
}];

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Referer": "https://9animetv.to/"
    };
  }

  async search(query, page) {
    try {
      var url;
      if (query == "popular") {
        url = this.baseUrl + "/popular?page=" + page;
      } else if (query == "latest") {
        url = this.baseUrl + "/latest?page=" + page;
      } else {
        url = this.baseUrl + "/search?keyword=" + encodeURIComponent(query) + "&page=" + page;
      }

      var client = new Client();
      var response = await client.get(url, { headers: this.headers });
      var doc = new DOMParser().parseFromString(response.body, "text/html");

      var items = [];
      var elements = doc.querySelectorAll('.film_list-wrap .flw-item');
      for (var i = 0; i < elements.length; i++) {
        var item = elements[i];
        var titleEl = item.querySelector('.film-name a');
        var imgEl = item.querySelector('img');
        var isDub = item.querySelector('.tick-dub') != null;
        if (titleEl && titleEl.getAttribute('href')) {
          items.push({
            name: (titleEl.textContent.trim() || 'Untitled') + (isDub ? ' (Dub)' : ''),
            url: this.baseUrl + titleEl.getAttribute('href'),
            imageUrl: imgEl ? (imgEl.getAttribute('data-src') || imgEl.getAttribute('src') || '') : '',
            language: isDub ? 'dub' : 'sub'
          });
        }
      }

      return {
        list: items,
        hasNextPage: doc.querySelector('.pagination .page-item:last-child:not(.active)') != null
      };
    } catch (error) {
      console.log("Search error:", error);
      return { list: [], hasNextPage: false };
    }
  }

  async getDetail(url) {
    try {
      var client = new Client();
      var response = await client.get(url, { headers: this.headers });
      var doc = new DOMParser().parseFromString(response.body, "text/html");

      var episodes = [];
      var epElements = doc.querySelectorAll('.episode-list .ep-item');
      for (var i = 0; i < epElements.length; i++) {
        var ep = epElements[i];
        var isDub = ep.querySelector('.dub') != null;
        if (!isDub) continue;

        var epLink = ep.querySelector('a');
        if (!epLink) continue;

        var epNumMatch = epLink.textContent.match(/\d+/);
        episodes.push({
          num: epNumMatch ? parseInt(epNumMatch[0]) : 0,
          name: "Episode " + (epNumMatch ? epNumMatch[0] : "0") + " (Dub)",
          url: this.baseUrl + epLink.getAttribute('href'),
          scanlator: "9AnimeTV"
        });
      }

      return {
        description: doc.querySelector('.description') ? doc.querySelector('.description').textContent.trim() : 'No description',
        status: doc.querySelector('.anisc-info .item') && doc.querySelector('.anisc-info .item').textContent.includes('Ongoing') ? 0 : 1,
        genre: Array.from(doc.querySelectorAll('.anisc-info a[href*="/genre/"]')).map(function(g) { return g.textContent.trim(); }),
        episodes: episodes.reverse()
      };
    } catch (error) {
      console.log("Detail error:", error);
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
      var client = new Client();
      var response = await client.get(url, { headers: this.headers });
      var html = response.body;

      var m3u8Match = html.match(/"file":"([^"]+\.m3u8)"/);
      if (m3u8Match) {
        return [{
          url: m3u8Match[1].replace(/\\\//g, '/'),
          quality: "1080p",
          isM3U8: true,
          headers: { "Referer": "https://9animetv.to/" }
        }];
      }

      var mp4Match = html.match(/"file":"([^"]+\.mp4)"/);
      if (mp4Match) {
        return [{
          url: mp4Match[1].replace(/\\\//g, '/'),
          quality: "1080p",
          isM3U8: false,
          headers: { "Referer": "https://9animetv.to/" }
        }];
      }

      return [];
    } catch (error) {
      console.log("Video error:", error);
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
