// animedao-dubbed.js
class AnimeDaoDubbed {
    constructor() {
        this.id = 987654323;
        this.name = "AnimeDao (Dubbed)";
        this.baseUrl = "https://animedao.com.ru/dubbed";
        this.lang = "en";
        this.iconUrl = "https://www.google.com/s2/favicons?sz=64&domain_url=https://animedao.com.ru";
        this.isNsfw = false;
        this.hasCloudflare = false;
        this.version = "1.0.0";
        this.itemType = 1;
    }

    async search(query, page = 1) {
        try {
            // Format search query for AnimeDao's URL structure
            const searchQuery = encodeURIComponent(query.trim().replace(/\s+/g, '+'));
            const searchUrl = `${this.baseUrl}/search/${searchQuery}`;
            
            const response = await this._fetch(searchUrl);
            const $ = this.cheerio.load(response);
            
            const results = $('div.anime-list div.anime-item').map((i, el) => {
                const element = $(el);
                const url = element.find('a').attr('href');
                const title = element.find('h5').text().trim();
                
                // Only include dubbed results
                if (!url.includes('/dubbed/')) return null;
                
                return {
                    id: url,
                    title: `${title} (Dubbed)`,
                    thumbnail: element.find('img').attr('data-src') || element.find('img').attr('src'),
                    url: this._absoluteUrl(url)
                };
            }).get().filter(Boolean);

            return results;
        } catch (error) {
            console.error('AnimeDao Dubbed search error:', error);
            return [];
        }
    }

    async getAnimeDetails(id) {
        /* ... existing implementation ... */
    }

    async getEpisodeSources(episodeId) {
        /* ... existing implementation ... */
    }

    async _fetch(url) {
        const res = await fetch(this._absoluteUrl(url), {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": this.baseUrl
            }
        });
        return await res.text();
    }

    _absoluteUrl(path) {
        return path.startsWith('http') ? path : `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    }
}

// Proper export for extension loading
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnimeDaoDubbed;
} else if (typeof window !== 'undefined') {
    window.animedaoDubbed = new AnimeDaoDubbed();
}
