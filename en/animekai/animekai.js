// animekai.js - AnymeX Provider for AnimeKai
const AnimeKai = {
    // Metadata
    info: {
        name: "AnimeKai",
        version: "1.0.1",
        type: "anime",
        author: "YourName",
        url: "https://animekai.to",
        logo: "https://www.google.com/s2/favicons?sz=64&domain=https://animekai.to"
    },

    // Main search function (now properly integrated with AnymeX)
    async search(query, page = 1) {
        try {
            const searchUrl = `https://animekai.to/browser?keyword=${encodeURIComponent(query)}&page=${page}`;
            const html = await this.request.get(searchUrl);
            
            if (!html) return { results: [] };

            const $ = this.cheerio.load(html);
            const results = [];

            $('.aitem-wrapper .aitem').each((i, el) => {
                results.push({
                    title: $(el).find('.title').text().trim(),
                    url: $(el).find('a').attr('href'),
                    image: $(el).find('img').attr('data-src') || $(el).find('img').attr('src'),
                    type: "anime",
                    provider: this.info.name
                });
            });

            return {
                results: results,
                hasMore: $('.pagination li').length > 0
            };
        } catch (error) {
            console.error("[AnimeKai] Search error:", error);
            return { results: [] };
        }
    },

    // Get anime details
    async getAnimeInfo(url) {
        try {
            const html = await this.request.get(url);
            if (!html) return null;

            const $ = this.cheerio.load(html);
            const title = $('h1.title').text().trim();
            const cover = $('img.cover').attr('src') || $('meta[property="og:image"]').attr('content');

            // Extract episodes
            const episodes = [];
            $('.episode-list li a').each((i, el) => {
                const epUrl = $(el).attr('href');
                const epNum = parseInt(epUrl.match(/episode-(\d+)/)?.[1]) || i+1;
                
                episodes.push({
                    number: epNum,
                    title: $(el).find('.episode-title').text().trim() || `Episode ${epNum}`,
                    url: epUrl
                });
            });

            // If no episodes found, check for movie
            if (episodes.length === 0 && $('.watch-btn').length) {
                episodes.push({
                    number: 1,
                    title: "Movie",
                    url: $('.watch-btn').attr('href')
                });
            }

            return {
                title: title,
                cover: cover,
                episodes: episodes,
                synopsis: $('.description').text().trim(),
                status: $('.info-item:contains("Status")').text().replace("Status:", "").trim()
            };
        } catch (error) {
            console.error("[AnimeKai] Info error:", error);
            return null;
        }
    },

    // Get video sources
    async getVideoSources(episodeUrl) {
        try {
            const html = await this.request.get(episodeUrl);
            if (!html) return [];

            const $ = this.cheerio.load(html);
            const sources = [];

            // Check for iframe embeds
            const iframe = $('iframe.video-embed');
            if (iframe.length) {
                sources.push({
                    url: iframe.attr('src'),
                    quality: "1080p",
                    isM3U8: false
                });
            }

            // Check for direct video sources
            $('source').each((i, el) => {
                sources.push({
                    url: $(el).attr('src'),
                    quality: $(el).attr('data-quality') || "720p",
                    isM3U8: $(el).attr('src').includes('.m3u8')
                });
            });

            // Check for server list
            $('.server-list li').each((i, el) => {
                sources.push({
                    url: $(el).attr('data-video') || $(el).find('a').attr('href'),
                    quality: $(el).text().includes('1080') ? "1080p" : 
                           $(el).text().includes('720') ? "720p" : "480p",
                    isM3U8: false
                });
            });

            return sources.filter(source => source.url);
        } catch (error) {
            console.error("[AnimeKai] Video error:", error);
            return [];
        }
    }
};

// Register the provider
if (typeof registerProvider === 'function') {
    registerProvider(AnimeKai);
} else {
    module.exports = AnimeKai;
}
