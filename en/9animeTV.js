class NineAnimeTVExtension extends MProvider {
  constructor() {
    super();
    this.headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Referer": "https://9animetv.to/",
      "X-Requested-With": "XMLHttpRequest"
    };
  }

  async search(query, page = 1, filters) {
    try {
      let url;
      if (query === "popular") {
        url = `${this.baseUrl}/popular?page=${page}`;
      } else if (query === "latest") {
        url = `${this.baseUrl}/latest?page=${page}`;
      } else {
        url = `${this.baseUrl}/search?keyword=${encodeURIComponent(query)}&page=${page}`;
      }

      const client = new Client();
      const response = await client.get(url, { headers: this.headers });
      const doc = new DOMParser().parseFromString(response.body, "text/html");

      const items = Array.from(doc.querySelectorAll('.film_list-wrap .flw-item')).map(item => {
        const titleEl = item.querySelector('.film-name a');
        const imgEl = item.querySelector('img');
        const isDub = item.querySelector('.tick-dub') !== null || /dub/i.test(titleEl?.textContent || '');

        return {
          name: `${titleEl?.textContent.trim()}${isDub ? ' (Dub)' : ''}`,
          url: `${this.baseUrl}${titleEl?.getAttribute('href')}`,
          imageUrl: imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src') || '',
          language: isDub ? 'dub' : 'sub'
        };
      }).filter(item => item.name && item.url);

      const hasNextPage = doc.querySelector('.pagination .page-item:last-child:not(.active)') !== null;

      return {
        list: items,
        hasNextPage
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

      // Extract only dubbed episodes
      const episodes = Array.from(doc.querySelectorAll('.episode-list .ep-item')).map(ep => {
        const isDub = ep.querySelector('.dub') !== null || /dub/i.test(ep.textContent || '');
        if (!isDub) return null;

        const epLink = ep.querySelector('a');
        const epNum = epLink.getAttribute('data-number') || epLink.textContent.match(/\d+/)?.[0] || 0;
        
        return {
          num: parseInt(epNum),
          name: `Episode ${epNum} (Dub)`,
          url: `${this.baseUrl}${epLink.getAttribute('href')}`,
          scanlator: '9AnimeTV'
        };
      }).filter(Boolean).reverse();

      return {
        description: doc.querySelector('.description')?.textContent.trim() || 'No description available',
        status: doc.querySelector('.anisc-info .item')?.textContent.includes('Ongoing') ? 0 : 1,
        genre: Array.from(doc.querySelectorAll('.anisc-info a[href*="/genre/"]')).map(g => g.textContent.trim()),
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
      
      // 1. Get episode page
      const epResponse = await client.get(url, { headers: this.headers });
      const epDoc = new DOMParser().parseFromString(epResponse.body, "text/html");
      
      // 2. Extract server list
      const serverList = Array.from(epDoc.querySelectorAll('.server-list .server-item')).map(server => {
        return {
          name: server.getAttribute('data-server-id') || 'default',
          url: `${this.baseUrl}${server.querySelector('a').getAttribute('href')}`
        };
      });

      // 3. Try each server until we find a working one
      for (const server of serverList) {
        try {
          const serverResponse = await client.get(server.url, { headers: this.headers });
          const serverData = JSON.parse(serverResponse.body);
          const serverDoc = new DOMParser().parseFromString(serverData.html, "text/html");
          
          // 4. Extract iframe URL
          const iframe = serverDoc.querySelector('iframe');
          if (!iframe) continue;
          
          const iframeUrl = iframe.getAttribute('src');
          if (!iframeUrl.includes('http')) continue;
          
          // 5. Get final player page
          const iframeResponse = await client.get(iframeUrl, { 
            headers: { ...this.headers, Referer: url } 
          });
          
          // 6. Extract m3u8 URL
          const m3u8Match = iframeResponse.body.match(/file:"([^"]+\.m3u8)"/);
          if (m3u8Match) {
            return [{
              url: m3u8Match[1].replace(/\\\//g, '/'),
              quality: "Auto",
              isM3U8: true,
              headers: { 
                "Referer": iframeUrl,
                "Origin": this.baseUrl
              }
            }];
          }
        } catch (e) {
          console.log(`Server ${server.name} failed, trying next`);
        }
      }
      
      return [];
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
