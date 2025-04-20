const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.0.6",
    "pkgPath": "anime/src/en/animekai.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    // =====================
    // 1. FIXED SEARCH FUNCTION
    // =====================
    async search(query, page = 1, filters = []) {
        try {
            // Build search URL with proper encoding
            const searchUrl = `${this.baseUrl}/browser?keyword=${encodeURIComponent(query)}&page=${page}`;
            
            // Add headers to mimic browser request
            const headers = {
                "Referer": this.baseUrl,
                "Origin": this.baseUrl,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            };

            // Make the request
            const response = await this.client.get(searchUrl, { headers });
            if (!response.ok) {
                console.error("Search request failed:", response.status);
                return { list: [], hasNextPage: false };
            }

            // Parse the HTML
            const doc = new Document(response.body);
            if (!doc) return { list: [], hasNextPage: false };

            // Extract anime items - updated selectors
            const animeItems = doc.select(".film_list-wrap .flw-item, .aitem-wrapper .aitem") || [];
            
            const list = animeItems.map(item => {
                const titleElement = item.selectFirst(".film-name a, a.title");
                const imageElement = item.selectFirst(".film-poster img, img.film-poster-img");
                
                return {
                    name: titleElement?.text?.trim() || "Unknown Title",
                    link: titleElement?.getHref || "",
                    imageUrl: imageElement?.attr("data-src") || 
                             imageElement?.attr("src") || 
                             ""
                };
            }).filter(item => item.link && item.imageUrl);

            // Check for next page
            const pagination = doc.select(".pagination li a, .page-item a");
            const hasNextPage = pagination.some(item => 
                item.text?.includes("Next") || item.text?.includes(">")
            );

            return { 
                list: list, 
                hasNextPage: hasNextPage 
            };
        } catch (error) {
            console.error("Search error:", error);
            return { list: [], hasNextPage: false };
        }
    }

    // =====================
    // 2. DETAIL EXTRACTION
    // =====================
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return null;

            // Title with multiple fallbacks
            const title = doc.selectFirst("h1.title")?.text?.trim() || 
                         doc.selectFirst(".anime-detail h1")?.text?.trim() || 
                         "Unknown Title";

            // Cover image with fallbacks
            const cover = doc.selectFirst(".anime-cover img")?.attr("src") || 
                        doc.selectFirst("img.cover")?.attr("src") || 
                        "";

            // Description
            const description = doc.selectFirst(".description")?.text?.trim() || 
                              "No description available";

            // Episodes
            const episodeItems = doc.select(".episode-list li, .eplist li") || [];
            const episodes = episodeItems.map((item, index) => {
                const epNum = parseInt(
                    item.attr("data-episode") || 
                    item.selectFirst(".episode-num")?.text?.match(/\d+/)?.[0] || 
                    (index + 1)
                );
                
                return {
                    name: item.selectFirst(".episode-title")?.text?.trim() || `Episode ${epNum}`,
                    url: item.selectFirst("a")?.getHref || `${url}/episode/${epNum}`,
                    episode: epNum,
                    thumbnailUrl: item.selectFirst("img")?.attr("src") || cover
                };
            }).filter(ep => ep.url);

            return {
                name: title,
                cover: cover,
                description: description,
                episodes: episodes.sort((a, b) => a.episode - b.episode)
            };
        } catch (error) {
            console.error("Detail extraction error:", error);
            return null;
        }
    }

    // =====================
    // 3. VIDEO EXTRACTION
    // =====================
    async getVideoList(episodeUrl) {
        try {
            const doc = await this.getPage(episodeUrl);
            if (!doc) return [];

            // Get user preferences
            const prefServer = this.getPreference("animekai_pref_stream_server") || "1";
            const showUncensored = this.getPreference("animekai_show_uncen_epsiodes") !== false;

            // Find the preferred server
            const server = doc.selectFirst(`.server-list li[data-server="${prefServer}"], 
                                          .server-tab[data-id="${prefServer}"]`);
            if (!server) return [];

            // Extract video sources
            const videoSources = server.select("[data-video], .video-item") || [];
            return videoSources.map(source => {
                const isUncensored = source.text?.includes("Uncensored");
                if (isUncensored && !showUncensored) return null;

                return {
                    name: source.selectFirst(".video-name")?.text?.trim() || "Source",
                    url: source.attr("data-video") || source.attr("data-src"),
                    quality: source.text?.match(/1080|720|480/)?.[0] || "Auto"
                };
            }).filter(Boolean);
        } catch (error) {
            console.error("Video extraction error:", error);
            return [];
        }
    }

    // =====================
    // 4. SETTINGS (UNCHANGED)
    // =====================
    getSourcePreferences() {
        return [
            {
                key: "animekai_base_url",
                editTextPreference: {
                    title: "Override base url",
                    summary: "",
                    value: "https://animekai.to",
                    dialogTitle: "Override base url",
                    dialogMessage: "",
                }
            }, {
                key: "animekai_title_lang",
                listPreference: {
                    title: 'Preferred title language',
                    summary: 'Choose in which language anime title should be shown',
                    valueIndex: 1,
                    entries: ["English", "Romaji"],
                    entryValues: ["title", "data-jp"]
                }
            },
            {
                key: "animekai_show_uncen_epsiodes",
                switchPreferenceCompat: {
                    title: 'Show uncensored episodes',
                    summary: "",
                    value: true
                }
            }, {
                key: "animekai_pref_stream_server",
                listPreference: {
                    title: 'Preferred server',
                    summary: 'Choose the server you want to extract streams from',
                    valueIndex: 0,
                    entries: ["Server 1", "Server 2"],
                    entryValues: ["1", "2"]
                }
            }
        ];
    }

    // =====================
    // HELPER METHODS
    // =====================
    getPreference(key) {
        return new SharedPreferences().get(key);
    }

    async getPage(url) {
        try {
            const fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
            const res = await this.client.get(fullUrl, {
                headers: {
                    "Referer": this.baseUrl,
                    "Origin": this.baseUrl,
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                }
            });
            return new Document(res.body);
        } catch (error) {
            console.error("Failed to fetch page:", error);
            return null;
        }
    }
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
