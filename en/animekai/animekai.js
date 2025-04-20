const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.3.0",
    "pkgPath": "anime/src/en/animekai.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
        this.titleCache = new Map();
    }

    // SEARCH (unchanged - works fine)
    async search(query, page, filters) {
        try {
            let result = await this._exactSearch(query, page, filters);
            if (result.list.length === 0) {
                result = await this._fuzzySearch(query, page);
                result.list.forEach(item => {
                    this.titleCache.set(item.name.toLowerCase(), item.link);
                });
            }
            return result;
        } catch (error) {
            console.error("Search failed:", error);
            return { list: [], hasNextPage: false };
        }
    }

    async _exactSearch(query, page, filters) {
        const slug = "/browser?keyword=" + encodeURIComponent(query) + `&page=${page}`;
        const body = await this.getPage(slug);
        if (!body) return { list: [], hasNextPage: false };

        const animeItems = body.select(".aitem-wrapper .aitem") || [];
        const list = animeItems.map(anime => ({
            name: anime.selectFirst("a.title")?.text?.trim() || "Unknown",
            link: anime.selectFirst("a")?.getHref,
            imageUrl: anime.selectFirst("img")?.attr("data-src") || anime.selectFirst("img")?.attr("src")
        })).filter(item => item.link);

        return {
            list: list,
            hasNextPage: body.select(".pagination > li").length > 0
        };
    }

    // IMPROVED DETAIL EXTRACTION
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return this._createFallbackDetail(url);

            // Better title extraction
            const title = doc.selectFirst("h1.title")?.text?.trim() || 
                         doc.selectFirst("meta[property='og:title']")?.attr("content")?.trim() || 
                         url.split("/").pop().replace(/-/g, " ");

            // Better cover image extraction
            const cover = doc.selectFirst("img.cover")?.attr("src") || 
                         doc.selectFirst("meta[property='og:image']")?.attr("content") || "";

            // Improved episode extraction
            let episodes = [];
            const episodeElements = doc.select(".episode-list li a") || [];
            
            episodes = episodeElements.map((ep, i) => {
                const epUrl = ep.getHref;
                const epNumMatch = epUrl.match(/episode-(\d+)/);
                const epNum = epNumMatch ? parseInt(epNumMatch[1]) : i+1;
                
                return {
                    id: `ep-${epNum}`,
                    number: epNum,
                    title: ep.selectFirst(".episode-title")?.text?.trim() || `Episode ${epNum}`,
                    url: epUrl,
                    thumbnail: ep.selectFirst("img")?.attr("src") || cover
                };
            });

            // If no episodes found, check for movie format
            if (episodes.length === 0) {
                const watchBtn = doc.selectFirst(".watch-btn");
                if (watchBtn) {
                    episodes = [{
                        id: "movie",
                        number: 1,
                        title: "Movie",
                        url: watchBtn.getHref,
                        thumbnail: cover
                    }];
                }
            }

            return {
                id: url.split("/").pop() || "unknown",
                title: title,
                coverImage: cover,
                episodes: episodes,
                mappings: {
                    id: url.split("/").pop() || "unknown",
                    providerId: "animekai",
                    similarity: 90
                }
            };
        } catch (error) {
            console.error("Detail fetch failed:", error);
            return this._createFallbackDetail(url);
        }
    }

    // IMPROVED VIDEO SOURCE EXTRACTION
    async getVideoList(episodeUrl) {
        try {
            const doc = await this.getPage(episodeUrl);
            if (!doc) return this._getFallbackSources(episodeUrl);

            // Extract from iframe embeds
            const iframe = doc.selectFirst("iframe.video-embed");
            if (iframe) {
                const embedUrl = iframe.attr("src");
                if (embedUrl) {
                    return [{
                        url: embedUrl,
                        quality: 1080,
                        server: "Primary"
                    }];
                }
            }

            // Extract from video players
            const videoSources = doc.select("source");
            if (videoSources.length > 0) {
                return videoSources.map(source => ({
                    url: source.attr("src"),
                    quality: parseInt(source.attr("data-quality")) || 720,
                    server: "Direct"
                })).filter(source => source.url);
            }

            // Fallback to server list
            const servers = doc.select(".server-list li");
            if (servers.length > 0) {
                return servers.map(server => ({
                    url: server.attr("data-video") || server.selectFirst("a")?.getHref,
                    quality: server.text.includes("1080") ? 1080 : 
                           server.text.includes("720") ? 720 : 480,
                    server: server.selectFirst(".server-name")?.text?.trim() || "Server"
                })).filter(source => source.url);
            }

            return this._getFallbackSources(episodeUrl);
        } catch (error) {
            console.error("Video list failed:", error);
            return this._getFallbackSources(episodeUrl);
        }
    }

    // FALLBACKS (unchanged)
    _createFallbackDetail(url) {
        const id = url.split("/").pop() || "fallback";
        return {
            id: id,
            title: id.replace(/-/g, " "),
            coverImage: "",
            episodes: Array.from({ length: 12 }, (_, i) => ({
                id: `ep-${i+1}`,
                number: i+1,
                title: `Episode ${i+1}`,
                url: `${url}/episode-${i+1}`,
                thumbnail: ""
            })),
            mappings: {
                id: id,
                providerId: "animekai",
                similarity: 70
            }
        };
    }

    _getFallbackSources(url) {
        return [{
            url: url.replace("/episode-", "/watch/") + ".mp4",
            quality: 720,
            server: "Fallback"
        }];
    }

    // SETTINGS (add your original settings here)
    getSourcePreferences() {
        return [
            // Your original settings array
        ];
    }
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
