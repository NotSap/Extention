const mangayomiSources = [{
    "name": "9animeTV",
    "lang": "en",
    "baseUrl": "https://9animeTV.to",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://9animeTV.to",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.0.0",
    "pkgPath": "anime/src/en/9animeTV.js"
}];

class NineAnimeTVExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    getHeaders() {
        return {
            "Referer": this.source.baseUrl,
            "Origin": this.source.baseUrl,
            "X-Requested-With": "XMLHttpRequest"
        };
    }

    async getPopular(page) {
        const res = await this.client.get(`${this.source.baseUrl}/filter?sort=views&page=${page}`, this.getHeaders());
        return this.parseAnimeList(res.body);
    }

    async getLatestUpdates(page) {
        const res = await this.client.get(`${this.source.baseUrl}/filter?sort=recently_updated&page=${page}`, this.getHeaders());
        return this.parseAnimeList(res.body);
    }

    async search(query, page, filters) {
        let url = `${this.source.baseUrl}/filter?keyword=${encodeURIComponent(query)}`;
        
        // Handle filters if needed
        if (filters && filters.length > 0) {
            // Add filter logic here
        }
        
        url += `&page=${page}`;
        const res = await this.client.get(url, this.getHeaders());
        return this.parseAnimeList(res.body);
    }

    parseAnimeList(html) {
        const doc = new Document(html);
        const items = doc.select("div.film_list-wrap > div.flw-item");
        const list = [];
        
        items.forEach(item => {
            const titleElement = item.selectFirst("div.film-detail h3.film-name a");
            const imageElement = item.selectFirst("div.film-poster img");
            
            list.push({
                name: titleElement.text.trim(),
                imageUrl: imageElement.getSrc,
                link: titleElement.getHref
            });
        });
        
        return {
            list,
            hasNextPage: items.length > 0
        };
    }

    async getDetail(url) {
        const fullUrl = url.startsWith("http") ? url : `${this.source.baseUrl}${url}`;
        const res = await this.client.get(fullUrl, this.getHeaders());
        const doc = new Document(res.body);

        const anime = {
            title: doc.selectFirst("h2.film-name").text.trim(),
            description: doc.selectFirst("div.film-description > div.text").text.trim(),
            status: this.parseStatus(doc.selectFirst("div.film-status span").text.trim()),
            genres: doc.select("div.film-genre a").map(el => el.text.trim()),
            episodes: []
        };

        // Extract episode list
        const episodeElements = doc.select("ul.episodes li a");
        episodeElements.forEach((ep, index) => {
            anime.episodes.push({
                name: `Episode ${index + 1}`,
                url: ep.getHref,
                episodeNumber: index + 1
            });
        });

        return anime;
    }

    parseStatus(statusText) {
        const statusMap = {
            "Ongoing": 0,
            "Completed": 1,
            "Upcoming": 2
        };
        return statusMap[statusText] || 0;
    }

    async getVideoList(url) {
        const fullUrl = url.startsWith("http") ? url : `${this.source.baseUrl}${url}`;
        const res = await this.client.get(fullUrl, this.getHeaders());
        const doc = new Document(res.body);

        const servers = doc.select("div.server-item");
        const videos = [];

        for (const server of servers) {
            const serverName = server.text.trim();
            const serverId = server.getAttribute("data-id");
            const serverType = server.getAttribute("data-type"); // sub or dub

            // Skip if not preferred server type
            if (!this.isPreferredServer(serverName, serverType)) continue;

            // Get video sources from server
            const sourcesRes = await this.client.get(
                `${this.source.baseUrl}/ajax/episode/sources?id=${serverId}`,
                this.getHeaders()
            );
            const sourcesData = JSON.parse(sourcesRes.body);

            if (sourcesData.link) {
                const videoSources = await this.extractVideoSources(sourcesData.link, `${serverName} - ${serverType}`);
                videos.push(...videoSources);
            }
        }

        return this.sortVideos(videos);
    }

    async extractVideoSources(url, qualityPrefix) {
        try {
            const res = await this.client.get(url, this.getHeaders());
            const sources = [];

            // Parse HLS or direct video sources
            if (url.includes(".m3u8")) {
                // Parse HLS playlist
                const playlist = res.body.split('\n');
                for (let i = 0; i < playlist.length; i++) {
                    if (playlist[i].includes('RESOLUTION=')) {
                        const resolution = playlist[i].match(/RESOLUTION=(\d+)x(\d+)/)[2];
                        const videoUrl = playlist[i + 1];
                        sources.push({
                            url: videoUrl,
                            quality: `${qualityPrefix} - ${resolution}p`,
                            headers: this.getHeaders()
                        });
                    }
                }
            } else {
                // Direct video source
                sources.push({
                    url: url,
                    quality: `${qualityPrefix} - Default`,
                    headers: this.getHeaders()
                });
            }

            return sources;
        } catch (error) {
            console.error(`Error extracting video sources: ${error}`);
            return [];
        }
    }

    isPreferredServer(serverName, serverType) {
        const preferredServers = this.getPreference("preferred_servers") || ["Vidstreaming", "Vidcloud"];
        const preferredTypes = this.getPreference("preferred_types") || ["sub", "dub"];
        
        return preferredServers.some(s => serverName.includes(s)) && 
               preferredTypes.includes(serverType);
    }

    sortVideos(videos) {
        const preferredQuality = this.getPreference("preferred_quality") || "1080";
        return videos.sort((a, b) => {
            // Sort by preferred quality first
            if (a.quality.includes(preferredQuality) && !b.quality.includes(preferredQuality)) return -1;
            if (!a.quality.includes(preferredQuality) && b.quality.includes(preferredQuality)) return 1;
            
            // Then sort by resolution
            const aRes = parseInt(a.quality.match(/(\d+)p/)?.[1] || "0");
            const bRes = parseInt(b.quality.match(/(\d+)p/)?.[1] || "0");
            return bRes - aRes;
        });
    }

    getSourcePreferences() {
        return [
            {
                key: "preferred_servers",
                listPreference: {
                    title: "Preferred Servers",
                    summary: "Select which servers to use",
                    valueIndex: 0,
                    entries: ["Vidstreaming", "Vidcloud", "MyCloud", "StreamSB"],
                    entryValues: ["Vidstreaming", "Vidcloud", "MyCloud", "StreamSB"],
                    isMultiSelect: true
                }
            },
            {
                key: "preferred_types",
                listPreference: {
                    title: "Preferred Audio Types",
                    summary: "Select which audio types to show",
                    valueIndex: 0,
                    entries: ["Sub", "Dub"],
                    entryValues: ["sub", "dub"],
                    isMultiSelect: true
                }
            },
            {
                key: "preferred_quality",
                listPreference: {
                    title: "Preferred Quality",
                    summary: "Default quality preference",
                    valueIndex: 0,
                    entries: ["1080p", "720p", "480p", "360p"],
                    entryValues: ["1080", "720", "480", "360"]
                }
            }
        ];
    }
}
