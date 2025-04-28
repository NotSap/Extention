const mangayomiSources = [{
    "name": "9animeTV",
    "lang": "en",
    "baseUrl": "https://9animetv.to",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://9animetv.to",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.0.0",
    "pkgPath": "anime/src/en/9animeTV.js"
}];

class NineAnimeTV extends MProvider {
    constructor(source) {
        super(source);
        this.client = new Client(source);
    }

    async getPopular(page) {
        try {
            const res = await this.client.get(`${this.source.baseUrl}/filter?sort=views&page=${page}`);
            return this.parseAnimeList(res.body);
        } catch (e) {
            console.error("Error in getPopular:", e);
            return { list: [], hasNextPage: false };
        }
    }

    async getLatestUpdates(page) {
        try {
            const res = await this.client.get(`${this.source.baseUrl}/filter?sort=recently_updated&page=${page}`);
            return this.parseAnimeList(res.body);
        } catch (e) {
            console.error("Error in getLatestUpdates:", e);
            return { list: [], hasNextPage: false };
        }
    }

    async search(query, page, filterList) {
        try {
            let url = `${this.source.baseUrl}/filter?keyword=${encodeURIComponent(query)}&page=${page}`;
            const res = await this.client.get(url);
            return this.parseAnimeList(res.body);
        } catch (e) {
            console.error("Error in search:", e);
            return { list: [], hasNextPage: false };
        }
    }

    parseAnimeList(html) {
        const doc = parseHtml(html);
        const items = doc.select("div.film_list-wrap > div.flw-item");
        const list = [];
        
        items.forEach(item => {
            try {
                const titleEl = item.selectFirst("div.film-detail h3.film-name a");
                const imgEl = item.selectFirst("div.film-poster img");
                
                if (titleEl && imgEl) {
                    list.push({
                        name: titleEl.text.trim(),
                        imageUrl: imgEl.getSrc,
                        link: titleEl.getHref
                    });
                }
            } catch (e) {
                console.error("Error parsing anime item:", e);
            }
        });
        
        return { 
            list, 
            hasNextPage: items.length > 0 
        };
    }

    async getDetail(url) {
        try {
            const fullUrl = url.startsWith("http") ? url : `${this.source.baseUrl}${url}`;
            const res = await this.client.get(fullUrl);
            const doc = parseHtml(res.body);

            const anime = new MManga();
            anime.title = doc.selectFirst("h2.film-name")?.text.trim() || "No Title";
            anime.description = doc.selectFirst("div.film-description > div.text")?.text.trim() || "";
            
            // Parse status
            const statusText = doc.selectFirst("div.film-status span")?.text.trim() || "";
            anime.status = this.parseStatus(statusText);
            
            // Parse genres
            anime.genre = doc.select("div.film-genre a").map(el => el.text.trim());
            
            // Parse episodes
            const episodeElements = doc.select("ul.episodes li a");
            anime.chapters = episodeElements.map((ep, index) => {
                const chapter = new MChapter();
                chapter.name = `Episode ${index + 1}`;
                chapter.url = ep.getHref;
                return chapter;
            });

            return anime;
        } catch (e) {
            console.error("Error in getDetail:", e);
            return new MManga();
        }
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
        try {
            const fullUrl = url.startsWith("http") ? url : `${this.source.baseUrl}${url}`;
            const res = await this.client.get(fullUrl);
            const doc = parseHtml(res.body);

            const servers = doc.select("div.server-item");
            const videos = [];

            for (const server of servers) {
                try {
                    const serverName = server.text.trim();
                    const serverId = server.getAttribute("data-id");
                    const serverType = server.getAttribute("data-type"); // sub or dub

                    // Skip if not preferred server type
                    if (!this.isPreferredServer(serverName, serverType)) continue;

                    // Get video sources from server
                    const sourcesRes = await this.client.get(
                        `${this.source.baseUrl}/ajax/episode/sources?id=${serverId}`,
                        { headers: { "X-Requested-With": "XMLHttpRequest" } }
                    );
                    
                    const sourcesData = JSON.parse(sourcesRes.body);
                    if (sourcesData.link) {
                        const videoSources = await this.extractVideoSources(sourcesData.link, `${serverName} - ${serverType}`);
                        videos.push(...videoSources);
                    }
                } catch (e) {
                    console.error("Error processing server:", e);
                }
            }

            return this.sortVideos(videos);
        } catch (e) {
            console.error("Error in getVideoList:", e);
            return [];
        }
    }

    async extractVideoSources(url, qualityPrefix) {
        try {
            const res = await this.client.get(url);
            const sources = [];

            // Parse HLS or direct video sources
            if (url.includes(".m3u8")) {
                // Parse HLS playlist
                const playlist = res.body.split('\n');
                for (let i = 0; i < playlist.length; i++) {
                    if (playlist[i].includes('RESOLUTION=')) {
                        const resolution = playlist[i].match(/RESOLUTION=(\d+)x(\d+)/)?.[2] || "0";
                        const videoUrl = playlist[i + 1];
                        if (videoUrl && !videoUrl.startsWith("#")) {
                            const video = new MVideo();
                            video.url = videoUrl;
                            video.quality = `${qualityPrefix} - ${resolution}p`;
                            sources.push(video);
                        }
                    }
                }
            } else {
                // Direct video source
                const video = new MVideo();
                video.url = url;
                video.quality = `${qualityPrefix} - Default`;
                sources.push(video);
            }

            return sources;
        } catch (error) {
            console.error("Error extracting video sources:", error);
            return [];
        }
    }

    isPreferredServer(serverName, serverType) {
        const preferredServers = this.preferenceHosterSelection();
        const preferredTypes = this.preferenceTypeSelection();
        
        return preferredServers.some(s => serverName.includes(s)) && 
               preferredTypes.includes(serverType);
    }

    sortVideos(videos) {
        const preferredQuality = this.getPreferenceValue(this.source.id, "preferred_quality") || "1080";
        return videos.sort((a, b) => {
            // Sort by preferred quality first
            const aHasQuality = a.quality.includes(preferredQuality);
            const bHasQuality = b.quality.includes(preferredQuality);
            if (aHasQuality && !bHasQuality) return -1;
            if (!aHasQuality && bHasQuality) return 1;
            
            // Then sort by resolution
            const aRes = parseInt(a.quality.match(/(\d+)p/)?.[1] || "0");
            const bRes = parseInt(b.quality.match(/(\d+)p/)?.[1] || "0");
            return bRes - aRes;
        });
    }

    preferenceHosterSelection() {
        return getPreferenceValue(this.source.id, "hoster_selection") || ["Vidstreaming", "Vidcloud"];
    }

    preferenceTypeSelection() {
        return getPreferenceValue(this.source.id, "type_selection") || ["sub", "dub"];
    }

    getSourcePreferences() {
        return [
            new ListPreference({
                key: "preferred_quality",
                title: "Preferred Quality",
                summary: "",
                valueIndex: 0,
                entries: ["1080p", "720p", "480p", "360p"],
                entryValues: ["1080", "720", "480", "360"]
            }),
            new MultiSelectListPreference({
                key: "hoster_selection",
                title: "Enable/Disable Hosts",
                summary: "",
                entries: ["Vidstreaming", "Vidcloud", "MyCloud", "StreamSB"],
                entryValues: ["Vidstreaming", "Vidcloud", "MyCloud", "StreamSB"],
                values: ["Vidstreaming", "Vidcloud"]
            }),
            new MultiSelectListPreference({
                key: "type_selection",
                title: "Enable/Disable Types",
                summary: "",
                entries: ["Sub", "Dub"],
                entryValues: ["sub", "dub"],
                values: ["sub", "dub"]
            })
        ];
    }
}

function main(source) {
    return new NineAnimeTV(source);
}
