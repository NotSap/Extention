class AnimeDaoDubbed {
    constructor() {
        this.metadata = {
            id: 987654323,
            name: "AnimeDao (Dubbed)",
            url: "https://animedao.com.ru/dubbed",
            type: "anime",
            language: "en",
            version: "1.0.0",
            icon: "https://www.google.com/s2/favicons?sz=64&domain_url=https://animedao.com.ru"
        };
        this.baseUrl = this.metadata.url;
    }

    // Search method
    async search(query, page = 1) {
        try {
            const searchUrl = `${this.baseUrl}/search.html?keyword=${encodeURIComponent(query)}&page=${page}`;
            const data = await this._fetch(searchUrl);
            const $ = this.cheerio.load(data);
            
            return $('div.anime-list div.anime-item').map((i, el) => ({
                id: $(el).find('a').attr('href'),
                title: $(el).find('h5').text().trim() + " (Dubbed)",
                thumbnail: $(el).find('img').attr('data-src') || $(el).find('img').attr('src'),
                url: this._absoluteUrl($(el).find('a').attr('href'))
            })).get();
        } catch (error) {
            console.error('Search error:', error);
            return [];
        }
    }

    // Other required methods (getAnimeDetails, getEpisodeSources, etc.)
    async getAnimeDetails(id) {
        try {
            const data = await this._fetch(id);
            const $ = this.cheerio.load(data);
            
            return {
                id: id,
                title: $('h1.title').text().trim() + " (Dubbed)",
                description: $('div.anime-details p').text().trim(),
                thumbnail: $('div.anime-info-poster img').attr('src'),
                genres: $('div.anime-info-genres a').map((i, el) => $(el).text().trim()).get(),
                status: this._parseStatus($('div.anime-info-status:contains(Status) + div').text().trim()),
                episodes: await this._getEpisodes(id)
            };
        } catch (error) {
            console.error('Anime details error:', error);
            return null;
        }
    }

    async getEpisodeSources(episodeId) {
        try {
            const data = await this._fetch(episodeId);
            const $ = this.cheerio.load(data);
            const iframeUrl = $('#video-player').attr('src');
            
            return {
                sources: [{
                    url: iframeUrl,
                    quality: 'default',
                    isM3U8: iframeUrl.includes('.m3u8')
                }],
                subtitles: []
            };
        } catch (error) {
            console.error('Episode sources error:', error);
            return { sources: [], subtitles: [] };
        }
    }

    // Helper methods
    async _getEpisodes(id) {
        const data = await this._fetch(id);
        const $ = this.cheerio.load(data);
        
        return $('ul.episodes-range li').map((i, el) => ({
            id: $(el).find('a').attr('href'),
            number: parseFloat($(el).attr('data-jname')) || 0,
            title: `Episode ${$(el).attr('data-jname')} (Dubbed)`,
            url: this._absoluteUrl($(el).find('a').attr('href'))
        })).get().reverse();
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

    _parseStatus(status) {
        status = status.toLowerCase();
        if (status.includes('ongoing')) return 'ongoing';
        if (status.includes('completed')) return 'completed';
        return 'unknown';
    }
}

// Proper initialization and export
if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
    exports.create = () => new AnimeDaoDubbed();
} else {
    // For browser environment
    window.animeDaoDubbed = new AnimeDaoDubbed();
}
