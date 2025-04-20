const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.7.1", // Updated version
    "pkgPath": "anime/src/en/animekai.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client({
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://animekai.to/",
                "X-Requested-With": "XMLHttpRequest"
            }
        });
    }

    // =====================
    // 1. ENHANCED SEARCH 
    // =====================
    async search(query, page = 1, filters = []) {
        try {
            const searchUrl = `${this.baseUrl}/filter?keyword=${encodeURIComponent(query)}&page=${page}`;
            const doc = await this.getPage(searchUrl);
            
            if (!doc) return { list: [], hasNextPage: false };

            const results = [];
            const items = doc.select(".film_list-wrap .flw-item, .film_list .film-item") || [];
            
            items.forEach(item => {
                const titleElem = item.selectFirst(".film-name a, .dynamic-name");
                const imgElem = item.selectFirst(".film-poster img, img.film-poster-img");
                
                if (!titleElem || !imgElem) return;
                
                results.push({
                    name: titleElem.text?.trim() || "Unknown",
                    link: this._fixUrl(titleElem.attr("href")),
                    imageUrl: imgElem.attr("data-src") || 
                             imgElem.attr("src") ||
                             imgElem.attr("data-cfsrc"),
                    type: "anime",
                    provider: "animekai",
                    year: item.selectFirst(".fdi-item:contains('Year')")?.text?.match(/\d{4}/)?.[0] || null
                });
            });

            // Pagination detection with multiple possible selectors
            const hasNextPage = doc.selectFirst(".pagination .next:not(.disabled), .page-item.next:not(.disabled)") !== null;

            return {
                list: results,
                hasNextPage
            };
        } catch (error) {
            console.error("Search error:", error);
            return { list: [], hasNextPage: false };
        }
    }

    // =====================
    // 2. DETAIL WITH METADATA 
    // =====================
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return this._createFallbackDetail(url);

            const infoContainer = doc.selectFirst(".anisc-info, .film-detail");
            const title = infoContainer?.selectFirst("h2.film-name, h1.title")?.text?.trim() || "Unknown";
            
            // Enhanced metadata extraction
            const metadata = {};
            const infoItems = infoContainer?.select(".anisc-info .item, .film-information .item") || [];
            infoItems.forEach(item => {
                const key = item.selectFirst(".item-head, .title")?.text?.trim()?.toLowerCase()?.replace(/:/g, "") || "unknown";
                const value = item.selectFirst(".item-body, .name")?.text?.trim();
                if (key && value) metadata[key] = value;
            });

            const cover = doc.selectFirst(".film-poster img, .anisc-poster img")?.attr("src") || "";
            const description = doc.selectFirst(".film-description, .description")?.text?.trim() || "";
            
            // Episode extraction with better pagination support
            const episodes = [];
            let currentPage = 1;
            let hasMoreEpisodes = true;
            
            while (hasMoreEpisodes && currentPage < 10) { // Safety limit
                const episodePage = await this.getPage(`${url}?page=${currentPage}`);
                if (!episodePage) break;
                
                const episodeItems = episodePage.select(".episode-list li, .detail-infor-content .ss-list a") || [];
                if (episodeItems.length === 0) break;
                
                episodeItems.forEach((item, index) => {
                    const epNumText = item.text?.match(/(\d+)/)?.[1] || (index + 1);
                    const epNum = parseInt(epNumText);
                    
                    episodes.push({
                        id: `ep-${epNum}`,
                        number: epNum,
                        title: item.attr("title") || `Episode ${epNum}`,
                        url: this._fixUrl(item.attr("href")),
                        thumbnail: item.selectFirst("img")?.attr("src") || cover,
                        isFiller: false,
                        createdAt: new Date().toISOString()
                    });
                });
                
                // Check for next page
                hasMoreEpisodes = episodePage.selectFirst(".pagination .next:not(.disabled)") !== null;
                currentPage++;
            }

            return {
                id: url.split('/').pop() || "unknown",
                title: title,
                coverImage: cover,
                description: description,
                status: this._detectStatus(doc),
                totalEpisodes: episodes.length || 0,
                episodes: episodes.length ? episodes : this._generateFallbackEpisodes(url, cover),
                genres: metadata.genre?.split(/\s*,\s*/) || [],
                year: parseInt(metadata.year) || null,
                rating: parseFloat(metadata.rating) || null,
                mappings: [{
                    id: url.split('/').pop() || "unknown",
                    providerId: "animekai",
                    similarity: 95
                }],
                _meta: metadata // Include all extracted metadata
            };
        } catch (error) {
            console.error("Detail error:", error);
            return this._createFallbackDetail(url);
        }
    }

    // =====================
    // 3. VIDEO SOURCES WITH SERVER CHECK
    // =====================
    async getVideoList(episodeUrl) {
        try {
            const doc = await this.getPage(episodeUrl);
            if (!doc) return this._getFallbackSources(episodeUrl);

            const preferredServer = this.getPreference("preferred_server") || "default";
            const preferredQuality = this.getPreference("video_quality") || "auto";
            const showUncensored = this.getPreference("show_uncensored") || false;

            const sources = [];
            const serverTabs = doc.select(".server-tab, .nav-server") || [];
            
            for (const tab of serverTabs) {
                const serverName = (tab.text?.trim() || "default").toLowerCase();
                const serverId = tab.attr("data-id") || tab.attr("data-server-id") || serverName;
                
                // Skip uncensored if preference is false
                if (!showUncensored && (serverName.includes("uncensored") || serverName.includes("uncut"))) {
                    continue;
                }

                // Skip if server preference doesn't match
                if (preferredServer !== "default" && !serverName.includes(preferredServer)) {
                    continue;
                }

                // Load server content (some sites use AJAX)
                const serverContent = await this._loadServerContent(episodeUrl, serverId);
                if (!serverContent) continue;
                
                // Parse video options
                const videoOptions = serverContent.select(".server-option, .video-item") || [];
                for (const option of videoOptions) {
                    const qualityText = option.text?.trim() || "";
                    const url = option.attr("data-video") || option.attr("data-src") || option.attr("href");
                    
                    if (url && !url.includes("javascript:")) {
                        sources.push({
                            url: this._fixUrl(url),
                            quality: preferredQuality === "auto" 
                                ? this._detectQuality(qualityText) 
                                : preferredQuality,
                            server: serverName,
                            headers: {
                                "Referer": this.baseUrl,
                                "Origin": this.baseUrl,
                                "Accept": "*/*"
                            },
                            isDubbed: serverName.includes("dub"),
                            isUncensored: serverName.includes("uncensored")
                        });
                    }
                }
            }

            return sources.length ? sources : this._getFallbackSources(episodeUrl);
        } catch (error) {
            console.error("Video error:", error);
            return this._getFallbackSources(episodeUrl);
        }
    }

    // =====================
    // 4. ENHANCED SETTINGS
    // =====================
    getSourcePreferences() {
        return [
            {
                key: "preferred_server",
                listPreference: {
                    title: "Preferred Server",
                    summary: "Select default streaming server",
                    valueIndex: 0,
                    entries: ["Default", "Vidstreaming", "MyCloud", "StreamSB", "DoodStream"],
                    entryValues: ["default", "vidstream", "mycloud", "streamsb", "doodstream"]
                }
            },
            {
                key: "video_quality",
                listPreference: {
                    title: "Video Quality",
                    summary: "Preferred playback quality",
                    valueIndex: 0,
                    entries: ["Auto", "360p", "480p", "720p", "1080p"],
                    entryValues: ["auto", "360", "480", "720", "1080"]
                }
            },
            {
                key: "show_uncensored",
                switchPreferenceCompat: {
                    title: "Show Uncensored",
                    summary: "Include uncensored content in results",
                    value: false
                }
            },
            {
                key: "show_dubbed",
                switchPreferenceCompat: {
                    title: "Show Dubbed",
                    summary: "Include dubbed content in results",
                    value: true
                }
            }
        ];
    }

    // =====================
    // IMPROVED HELPER METHODS
    // =====================
    async _loadServerContent(url, serverId) {
        try {
            // Check if server content is already loaded in the page
            const existingContent = new Document(await this.client.get(url)).selectFirst(`#${serverId}, [data-id="${serverId}"]`);
            if (existingContent) return existingContent;
            
            // Some sites load servers via AJAX
            const apiUrl = `${this.baseUrl}/ajax/server/list/${url.split('/').pop()}`;
            const response = await this.client.get(apiUrl, {
                headers: {
                    "X-Requested-With": "XMLHttpRequest"
                }
            });
            
            return new Document(response.body);
        } catch (error) {
            console.error("Server load error:", error);
            return null;
        }
    }

    _detectStatus(doc) {
        const statusText = doc.selectFirst(".film-status, .anisc-info .item:contains('Status') .name")?.text?.toLowerCase() || "";
        if (statusText.includes("ongoing")) return "RELEASING";
        if (statusText.includes("complete") || statusText.includes("finished")) return "COMPLETED";
        if (statusText.includes("upcoming")) return "NOT_YET_RELEASED";
        return "UNKNOWN";
    }

    _detectQuality(text) {
        text = text.toLowerCase();
        if (text.includes("1080") || text.includes("fhd")) return "1080";
        if (text.includes("720") || text.includes("hd")) return "720";
        if (text.includes("480") || text.includes("sd")) return "480";
        if (text.includes("360")) return "360";
        return "auto";
    }

    _fixUrl(url) {
        if (!url) return "";
        if (url.startsWith("http")) return url;
        if (url.startsWith("//")) return `https:${url}`;
        return `${this.baseUrl}${url.startsWith("/") ? url : `/${url}`}`;
    }

    _generateFallbackEpisodes(url, cover) {
        return Array.from({ length: 12 }, (_, i) => ({
            id: `ep-${i+1}`,
            number: i+1,
            title: `Episode ${i+1}`,
            url: `${url}/episode-${i+1}`,
            thumbnail: cover,
            isFiller: false,
            createdAt: new Date().toISOString()
        }));
    }

    _createFallbackDetail(url) {
        const id = url.split("/").pop() || "fallback";
        return {
            id: id,
            title: id.replace(/-/g, " "),
            coverImage: "",
            description: "",
            status: "UNKNOWN",
            totalEpisodes: 12,
            episodes: this._generateFallbackEpisodes(url, ""),
            mappings: [{
                id: id,
                providerId: "animekai",
                similarity: 70
            }]
        };
    }

    _getFallbackSources(url) {
        return [{
            url: url.replace("/episode-", "/watch/") + ".mp4",
            quality: "720",
            server: "fallback",
            headers: {
                "Referer": this.baseUrl
            }
        }];
    }

    async getPage(url) {
        try {
            const fullUrl = this._fixUrl(url);
            const res = await this.client.get(fullUrl, {
                timeout: 10000 // 10 second timeout
            });
            return new Document(res.body);
        } catch (error) {
            console.error("Page load error:", error);
            return null;
        }
    }
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
