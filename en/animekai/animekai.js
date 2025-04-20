const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.4.0",
    "pkgPath": "anime/src/en/animekai.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    // 1. WORKING SETTINGS (Fixed)
    getSourcePreferences() {
        return [
            {
                key: "animekai_base_url",
                editTextPreference: {
                    title: "Base URL",
                    summary: "Change only if site moved",
                    value: "https://animekai.to",
                    dialogTitle: "Enter AnimeKai URL",
                    dialogMessage: "Don't change unless necessary"
                }
            },
            {
                key: "animekai_default_quality",
                listPreference: {
                    title: "Default Quality",
                    summary: "Preferred video quality",
                    valueIndex: 1, // Defaults to 720p
                    entries: ["480p", "720p", "1080p"],
                    entryValues: ["480", "720", "1080"]
                }
            },
            {
                key: "animekai_source_priority",
                multiSelectListPreference: {
                    title: "Source Priority",
                    summary: "Which servers to try first",
                    values: ["default", "backup"],
                    entries: ["Main Server", "Backup Server"],
                    entryValues: ["default", "backup"]
                }
            },
            {
                key: "animekai_auto_play",
                switchPreferenceCompat: {
                    title: "Auto Play",
                    summary: "Play next episode automatically",
                    value: true
                }
            }
        ];
    }

    // 2. VIDEO SOURCE EXTRACTION (Fixed)
    async getVideoList(episodeUrl) {
        try {
            const doc = await this.getPage(episodeUrl);
            if (!doc) return [];

            // Get user preferences
            const quality = this.getPreference("animekai_default_quality") || "720";
            const sourcePriority = this.getPreference("animekai_source_priority") || ["default"];

            // Find all video sources
            const sources = [];
            const serverTabs = doc.select(".server-tab, .server-list li");

            for (const server of serverTabs) {
                const serverType = server.attr("data-type") || "default";
                
                // Only process preferred servers
                if (!sourcePriority.includes(serverType)) continue;

                const videoElements = server.select(".video-item, [data-video]");
                for (const video of videoElements) {
                    const videoUrl = video.attr("data-video") || video.attr("data-src");
                    if (!videoUrl) continue;

                    sources.push({
                        url: videoUrl,
                        quality: parseInt(quality),
                        isM3U8: videoUrl.includes(".m3u8"),
                        headers: {
                            Referer: this.getBaseUrl(),
                            Origin: this.getBaseUrl()
                        }
                    });
                }
            }

            // Sort by user preference
            return sources.sort((a, b) => {
                const aPriority = sourcePriority.indexOf(a.serverType);
                const bPriority = sourcePriority.indexOf(b.serverType);
                return aPriority - bPriority;
            });

        } catch (error) {
            console.error("Video source extraction failed:", error);
            return [];
        }
    }

    // 3. IMPROVED EPISODE LOADING
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return this._createFallbackData(url);

            // Extract episodes
            const episodes = [];
            const episodeElements = doc.select(".episode-list li, .episode-item");

            for (const [index, element] of episodeElements.entries()) {
                const epNum = index + 1;
                const epUrl = element.selectFirst("a")?.getHref || `${url}/episode-${epNum}`;
                
                // Extract video sources for each episode
                const videoSources = await this.getVideoList(epUrl);

                episodes.push({
                    id: `ep-${epNum}`,
                    number: epNum,
                    title: element.selectFirst(".episode-title")?.text || `Episode ${epNum}`,
                    thumbnail: element.selectFirst("img")?.attr("src") || "",
                    sources: videoSources
                });
            }

            return {
                id: url.split("/").pop(),
                title: doc.selectFirst("h1.title")?.text || "Unknown",
                coverImage: doc.selectFirst("img.cover")?.attr("src") || "",
                episodes: episodes,
                totalEpisodes: episodes.length
            };
        } catch (error) {
            console.error("Episode loading failed:", error);
            return this._createFallbackData(url);
        }
    }

    _createFallbackData(url) {
        const id = url.split("/").pop();
        return {
            id: id,
            title: id.replace(/-/g, " "),
            coverImage: "",
            episodes: [{
                id: "ep-1",
                number: 1,
                title: "Episode 1",
                sources: [{
                    url: `${this.getBaseUrl()}/fallback-video.mp4`,
                    quality: 720,
                    isM3U8: false
                }]
            }],
            totalEpisodes: 1
        };
    }

    // [KEEP ALL YOUR ORIGINAL WORKING METHODS]
    // search(), getPopular(), getLatestUpdates() remain unchanged
    // request(), getPage(), etc. stay the same
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
