const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.2.0",
    "pkgPath": "anime/src/en/animekai.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client({
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://animekai.to/",
                "Origin": "https://animekai.to"
            }
        });
    }

    // =====================
    // WORKING SEARCH FUNCTION
    // =====================
    async search(query, page = 1, filters = []) {
        try {
            // Clean the query
            const cleanQuery = query
                .replace(/[^a-zA-Z0-9\s]/g, '')
                .trim()
                .replace(/\s+/g, ' ');
            
            // Build search URL
            const searchUrl = `${this.baseUrl}/filter?keyword=${encodeURIComponent(cleanQuery)}&page=${page}`;
            
            // Make request with proper headers
            const response = await this.client.get(searchUrl);
            if (!response.ok) {
                console.error("Search request failed:", response.status);
                return { list: [], hasNextPage: false };
            }

            // Parse the HTML
            const $ = this.cheerio.load(response.body);
            const results = [];

            // Extract anime items
            $('.film_list-wrap .flw-item').each((i, el) => {
                results.push({
                    name: $(el).find('.film-name a').text().trim(),
                    link: $(el).find('.film-poster a').attr('href'),
                    imageUrl: $(el).find('.film-poster img').attr('data-src') || 
                             $(el).find('.film-poster img').attr('src')
                });
            });

            // Check for next page
            const hasNextPage = $('.pagination .page-item:last-child:not(.disabled)').length > 0;

            return {
                list: results.filter(item => item.link && item.imageUrl),
                hasNextPage
            };
        } catch (error) {
            console.error("Search error:", error);
            return { list: [], hasNextPage: false };
        }
    }

    // =====================
    // DETAIL EXTRACTION
    // =====================
    async getDetail(url) {
        try {
            const response = await this.client.get(url.startsWith('http') ? url : `${this.baseUrl}${url}`);
            const $ = this.cheerio.load(response.body);

            return {
                title: $('h1.film-name').text().trim(),
                cover: $('.film-poster img').attr('src'),
                description: $('.film-description').text().trim(),
                episodes: this._extractEpisodes($, url),
                status: $('.film-status span').text().trim()
            };
        } catch (error) {
            console.error("Detail error:", error);
            return null;
        }
    }

    _extractEpisodes($, baseUrl) {
        const episodes = [];
        $('.episode-list li').each((i, el) => {
            episodes.push({
                number: parseInt($(el).attr('data-number') || (i + 1)),
                url: $(el).find('a').attr('href'),
                title: $(el).find('.episode-title').text().trim() || `Episode ${i + 1}`
            });
        });
        return episodes;
    }

    // =====================
    // VIDEO EXTRACTION
    // =====================
    async getVideoList(episodeUrl) {
        try {
            const response = await this.client.get(episodeUrl.startsWith('http') ? episodeUrl : `${this.baseUrl}${episodeUrl}`);
            const $ = this.cheerio.load(response.body);

            const sources = [];
            $('.server-item').each((i, el) => {
                const serverName = $(el).attr('data-server') || `Server ${i + 1}`;
                $(el).find('.video-item').each((j, videoEl) => {
                    sources.push({
                        url: $(videoEl).attr('data-video'),
                        quality: $(videoEl).text().match(/1080|720|480/)?.shift() || 'Auto',
                        server: serverName
                    });
                });
            });

            return sources.filter(s => s.url);
        } catch (error) {
            console.error("Video error:", error);
            return [];
        }
    }

    // =====================
    // SETTINGS
    // =====================
    getSourcePreferences() {
        return [
            {
                key: "primary_server",
                listPreference: {
                    title: "Preferred Server",
                    summary: "Select default video server",
                    valueIndex: 0,
                    entries: ["Server 1", "Server 2"],
                    entryValues: ["1", "2"]
                }
            },
            {
                key: "auto_quality",
                switchPreferenceCompat: {
                    title: "Auto Select Quality",
                    summary: "Automatically select best quality",
                    value: true
                }
            }
        ];
    }
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
