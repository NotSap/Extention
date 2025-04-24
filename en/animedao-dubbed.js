// animeDaoDubbed.js
(function() {
    const AnimeDaoDubbed = {
        id: 987654323,
        name: "AnimeDao (Dubbed)",
        baseUrl: "https://animedao.com.ru/dubbed",
        lang: "en",
        isNsfw: false,
        version: "1.0.0",

        async search(query, page = 1) {
            try {
                const searchUrl = `${this.baseUrl}/search/${encodeURIComponent(query.replace(/ /g, '+'))}`;
                const response = await this._request(searchUrl);
                const parser = new DOMParser();
                const doc = parser.parseFromString(response, 'text/html');
                
                const results = [];
                doc.querySelectorAll('div.anime-list div.anime-item').forEach(item => {
                    const anchor = item.querySelector('a');
                    const img = item.querySelector('img');
                    const title = item.querySelector('h5');
                    
                    if (anchor && img && title) {
                        const url = anchor.getAttribute('href');
                        if (url.includes('/dubbed')) {
                            results.push({
                                id: url,
                                title: `${title.textContent.trim()} (Dubbed)`,
                                thumbnail: img.getAttribute('data-src') || img.getAttribute('src'),
                                url: this._absoluteUrl(url)
                            });
                        }
                    }
                });

                return results;
            } catch (error) {
                console.error('AnimeDaoDubbed search error:', error);
                return [];
            }
        },

        async _request(url) {
            const response = await fetch(this._absoluteUrl(url), {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Referer": this.baseUrl
                }
            });
            return await response.text();
        },

        _absoluteUrl(path) {
            return path.startsWith('http') ? path : `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
        }
    };

    // Export for extension loading
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = AnimeDaoDubbed;
    } else {
        window.animeDaoDubbed = AnimeDaoDubbed;
    }
})();
