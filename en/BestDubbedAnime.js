const extension = {
  name: "BestDubbedAnime",
  lang: "en",
  baseUrl: "https://bestdubbedanime.com",
  isManga: false,
  isNsfw: false,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  },

  async search(query, page, { fetch }) => {
    try {
      const searchUrl = `${this.baseUrl}/?s=${encodeURIComponent(query)}`;
      const response = await fetch(searchUrl);
      const html = await response.text();
      
      // Basic parsing example - you'll need to adjust based on the actual site structure
      const results = [];
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Example: Find anime entries in search results
      const items = doc.querySelectorAll('.anime-entry'); // Adjust selector
      items.forEach(item => {
        const title = item.querySelector('h2 a')?.textContent.trim();
        const url = item.querySelector('h2 a')?.href;
        const image = item.querySelector('img')?.src;
        
        if (title && url) {
          results.push({
            title,
            url,
            image: image || '',
          });
        }
      });
      
      return { results };
    } catch (error) {
      console.error('Search error:', error);
      return { results: [] };
    }
  },

  async fetchAnimeInfo(url, { fetch }) => {
    try {
      const response = await fetch(url);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Extract information - adjust selectors as needed
      const title = doc.querySelector('h1.entry-title')?.textContent.trim() || 'Unknown Title';
      const description = doc.querySelector('.entry-content p')?.textContent.trim() || 'No description available.';
      const image = doc.querySelector('.entry-content img')?.src || '';
      
      // Extract genres
      const genres = [];
      const genreElements = doc.querySelectorAll('.genres a');
      genreElements.forEach(el => genres.push(el.textContent.trim()));
      
      // Extract status
      const statusElement = doc.querySelector('.status');
      const status = statusElement?.textContent.trim() || 'Unknown';
      
      return {
        title,
        description,
        image,
        genres,
        status,
        episodes: [] // Will be populated by fetchEpisodes
      };
    } catch (error) {
      console.error('Fetch anime info error:', error);
      return {
        title: 'Error',
        description: 'Failed to load anime information',
        image: '',
        genres: [],
        status: 'Unknown',
        episodes: []
      };
    }
  },

  async fetchEpisodes(url, { fetch }) => {
    try {
      const response = await fetch(url);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const episodes = [];
      const episodeElements = doc.querySelectorAll('.episode-list li a');
      
      episodeElements.forEach((el, index) => {
        episodes.push({
          name: el.textContent.trim() || `Episode ${index + 1}`,
          url: el.href
        });
      });
      
      return episodes;
    } catch (error) {
      console.error('Fetch episodes error:', error);
      return [];
    }
  },

  async loadEpisodeSources(url, { fetch }) {
    try {
      const response = await fetch(url);
      const html = await response.text();
      
      // Extract video sources - this will need to be adapted to the actual site
      const sources = [];
      const videoRegex = /https?:\/\/[^'"\s]+\.(mp4|m3u8)/gi;
      const matches = html.match(videoRegex) || [];
      
      matches.forEach(match => {
        sources.push({
          url: match,
          quality: 'default'
        });
      });
      
      return sources;
    } catch (error) {
      console.error('Load episode sources error:', error);
      return [];
    }
  },

  getSettings() {
    return [
      {
        key: "preferredQuality",
        type: "picker",
        name: "Preferred Quality",
        options: ["1080p", "720p", "480p"],
        defaultValue: "1080p",
      },
    ];
  },
};

// Double-check export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = extension;
} else {
  window.extension = extension;
}

export default extension;
