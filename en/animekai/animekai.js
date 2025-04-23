const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.0.4",
    "pkgPath": "anime/src/en/animekai.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    getPreference(key) {
        return new SharedPreferences().get(key);
    }

    getBaseUrl() {
        return this.getPreference("animekai_base_url") || "https://animekai.to";
    }

    async request(url, options = {}) {
        try {
            const fullUrl = url.startsWith("http") ? url : this.getBaseUrl() + url;
            const res = await this.client.get(fullUrl, options);
            return res.body;
        } catch (error) {
            console.error("Request failed:", error);
            return null;
        }
    }

    async getPage(url) {
        const res = await this.request(url);
        return res ? new Document(res) : null;
    }

    async search(query, page, filters) {
        try {
            const filterValues = {
                type: filters[0]?.state?.filter(f => f.state).map(f => f.value) || [],
                genre: filters[1]?.state?.filter(f => f.state).map(f => f.value) || [],
                status: filters[2]?.state?.filter(f => f.state).map(f => f.value) || [],
                sort: filters[3]?.values?.[filters[3]?.state]?.value || "updated_date",
                season: filters[4]?.state?.filter(f => f.state).map(f => f.value) || [],
                year: filters[5]?.state?.filter(f => f.state).map(f => f.value) || [],
                rating: filters[6]?.state?.filter(f => f.state).map(f => f.value) || [],
                country: filters[7]?.state?.filter(f => f.state).map(f => f.value) || [],
                language: filters[8]?.state?.filter(f => f.state).map(f => f.value) || []
            };

            let slug = "/browser?keyword=" + encodeURIComponent(query);
            
            for (const [key, values] of Object.entries(filterValues)) {
                if (values.length > 0) {
                    if (key === "sort") {
                        slug += `&${key}=${values}`;
                    } else {
                        values.forEach(value => {
                            slug += `&${key}[]=${encodeURIComponent(value)}`;
                        });
                    }
                }
            }

            slug += `&page=${page}`;

            const body = await this.getPage(slug);
            if (!body) return { list: [], hasNextPage: false };

            const titlePref = this.getPreference("animekai_title_lang") || "title";
            const animeItems = body.select(".aitem-wrapper .aitem") || [];
            
            const list = animeItems.map(anime => {
                const link = anime.selectFirst("a")?.getHref;
                const imageUrl = anime.selectFirst("img")?.attr("data-src") || 
                               anime.selectFirst("img")?.attr("src");
                const name = anime.selectFirst("a.title")?.attr(titlePref) || 
                            anime.selectFirst("a.title")?.text;
                return { name, link, imageUrl };
            }).filter(item => item.link && item.imageUrl);

            const paginations = body.select(".pagination > li") || [];
            const hasNextPage = paginations.length > 0 ? 
                !paginations[paginations.length - 1].className.includes("active") : false;

            return { list, hasNextPage };
        } catch (error) {
            console.error("Search failed:", error);
            return { list: [], hasNextPage: false };
        }
    }

    async getPopular(page) {
        const types = this.getPreference("animekai_popular_latest_type") || ["tv"];
        return this.search("", page, [
            { state: types.map(t => ({ state: true, value: t })) },
            { state: [] }, { state: [] },
            { values: [{ value: "trending" }], state: 0 },
            { state: [] }, { state: [] },
            { state: [] }, { state: [] },
            { state: [] }
        ]);
    }

    async getLatestUpdates(page) {
        const types = this.getPreference("animekai_popular_latest_type") || ["tv"];
        return this.search("", page, [
            { state: types.map(t => ({ state: true, value: t })) },
            { state: [] }, { state: [] },
            { values: [{ value: "updated_date" }], state: 0 },
            { state: [] }, { state: [] },
            { state: [] }, { state: [] },
            { state: [] }
        ]);
    }

    async getDetail(url) {
        function statusCode(status) {
            return {
                "Releasing": 0,
                "Completed": 1,
                "Not Yet Aired": 4,
            }[status] ?? 5;
        }

        try {
            const slug = url;
            const link = this.getBaseUrl() + slug;
            const body = await this.getPage(slug);
            if (!body) return null;

            const mainSection = body.selectFirst(".watch-section");
            if (!mainSection) return null;

            const imageUrl = mainSection.selectFirst("div.poster")?.selectFirst("img")?.getSrc ||
                            mainSection.selectFirst("div.poster")?.selectFirst("img")?.attr("data-src");

            const namePref = this.getPreference("animekai_title_lang") || "title";
            const nameSection = mainSection.selectFirst("div.title");
            const name = namePref.includes("jp") ? nameSection?.attr(namePref) : nameSection?.text;

            const description = mainSection.selectFirst("div.desc")?.text;

            const detailSection = mainSection.select("div.detail > div") || [];

            let genre = [];
            let status = 5;
            detailSection.forEach(item => {
                const itemText = item.text.trim();
                if (itemText.includes("Genres")) {
                    genre = itemText.replace("Genres:  ", "").split(", ");
                }
                if (itemText.includes("Status")) {
                    const statusText = item.selectFirst("span")?.text;
                    status = statusCode(statusText);
                }
            });

            const chapters = [];
            const animeId = body.selectFirst("#anime-rating")?.attr("data-id");
            if (animeId) {
                const token = await this.kaiEncrypt(animeId);
                const res = await this.request(`/ajax/episodes/list?ani_id=${animeId}&_=${token}`, {
                    headers: {
                        "X-Requested-With": "XMLHttpRequest",
                        "Referer": link
                    }
                });
                
                if (res) {
                    const data = JSON.parse(res);
                    if (data.status === 200) {
                        const doc = new Document(data.result);
                        const episodes = doc.select("li") || [];
                        const showUncenEp = this.getPreference("animekai_show_uncen_epsiodes");

                        for (const item of episodes) {
                            const aTag = item.selectFirst("a");
                            if (!aTag) continue;

                            const num = parseInt(aTag.attr("num")) || 0;
                            let title = aTag.selectFirst("span")?.text;
                            title = title?.includes("Episode") ? "" : `: ${title}`;
                            let epName = `Episode ${num}${title}`;

                            const langs = aTag.attr("langs");
                            const scanlator = langs === "1" ? "SUB" : "SUB, DUB";
                            const token = aTag.attr("token");

                            let epData = {
                                name: epName,
                                url: token,
                                scanlator
                            };

                            const slug = aTag.attr("slug");
                            if (slug?.includes("uncen")) {
                                if (!showUncenEp) continue;

                                epName = `Episode ${num} (Uncensored)`;
                                epData = {
                                    name: epName,
                                    url: token,
                                    scanlator: scanlator + ", UNCENSORED"
                                };

                                const exData = chapters[num - 1];
                                if (exData) {
                                    exData.url += "||" + epData.url;
                                    exData.scanlator += ", " + epData.scanlator;
                                    chapters[num - 1] = exData;
                                    continue;
                                }
                            }
                            chapters.push(epData);
                        }
                    }
                }
            }
            chapters.reverse();
            
            return { 
                name, 
                imageUrl, 
                link, 
                description, 
                genre, 
                status, 
                chapters 
            };
        } catch (error) {
            console.error("Failed to get detail:", error);
            return null;
        }
    }

    async getVideoList(url) {
        try {
            const streams = [];
            const prefServer = this.getPreference("animekai_pref_stream_server") || ["1", "2"];
            const prefDubType = this.getPreference("animekai_pref_stream_subdub_type") || ["sub", "dub"];
            
            const epSlug = url.split("||");
            let isUncensoredVersion = false;

            for (const epId of epSlug) {
                const endpoints = [
                    `/ajax/links/list?token=${epId}&_=`,
                    `/ajax/server/list/${epId}?_=`
                ];
                
                let body;
                for (const endpoint of endpoints) {
                    const token = await this.kaiEncrypt(epId);
                    const res = await this.request(endpoint + token, {
                        headers: {
                            "X-Requested-With": "XMLHttpRequest"
                        }
                    });
                    if (res) {
                        body = JSON.parse(res);
                        if (body.status === 200) break;
                    }
                }
                if (!body || body.status !== 200) continue;

                const serverResult = new Document(body.result);
                const SERVERDATA = [];
                
                const serverContainers = serverResult.select("div.server-items, .server-list, .server-tab, div[data-id]") || [];
                for (const container of serverContainers) {
                    const dubType = container.attr("data-id") || "sub";
                    if (!prefDubType.includes(dubType)) continue;

                    const serverElements = container.select("span.server, .server-item, [data-lid]") || [];
                    for (const server of serverElements) {
                        const serverName = server.text?.trim() || "Server";
                        const serverNum = serverName.replace("Server ", "");
                        
                        if (!serverNum.match(/^\d+$/)) {
                            serverNum = server.attr("data-id") || 
                                      server.attr("id")?.replace("server-", "") || 
                                      "1";
                        }

                        if (!prefServer.includes(serverNum)) continue;

                        const dataId = server.attr("data-lid") || server.attr("data-id");
                        if (dataId) {
                            SERVERDATA.push({
                                serverName: `Server ${serverNum}`,
                                dataId: dataId,
                                dubType: dubType
                            });
                        }
                    }
                }

                for (const serverData of SERVERDATA) {
                    const { serverName, dataId, dubType } = serverData;
                    const formattedDubType = dubType.toUpperCase() === "SUB" ? "HARDSUB" : dubType.toUpperCase();
                    const finalDubType = isUncensoredVersion ? `${formattedDubType} [Uncensored]` : formattedDubType;

                    const megaUrl = await this.getMegaUrl(dataId);
                    if (!megaUrl) continue;

                    const serverStreams = await this.decryptMegaEmbed(megaUrl, serverName, finalDubType);
                    if (serverStreams && serverStreams.length > 0) {
                        streams.push(...serverStreams);
                    }

                    if (dubType.includes("DUB") && megaUrl.includes("sub.list=")) {
                        try {
                            const subList = megaUrl.split("sub.list=")[1];
                            const subres = await this.client.get(subList);
                            const subtitles = JSON.parse(subres.body);
                            const subs = this.formatSubtitles(subtitles, finalDubType);
                            if (streams.length > 0) {
                                streams[streams.length - 1].subtitles = subs;
                            }
                        } catch (e) {
                            console.error("Failed to get subtitles:", e);
                        }
                    }
                }
                isUncensoredVersion = true;
            }

            return streams.length > 0 ? streams : [{ url: "", name: "No streams found - try changing server preferences" }];
        } catch (error) {
            console.error("Failed to get video list:", error);
            return [{ url: "", name: "Error loading streams - try again later" }];
        }
    }

    formatSubtitles(subtitles, dubType) {
        return subtitles
            .filter(sub => !sub.kind.includes("thumbnail"))
            .map(sub => ({
                file: sub.file,
                label: `${sub.label} - ${dubType}`
            }));
    }

    async formatStreams(sUrl, serverName, dubType) {
        function streamNamer(res) {
            return `${res} - ${dubType} : ${serverName}`;
        }

        const streams = [{
            url: sUrl,
            originalUrl: sUrl,
            quality: streamNamer("Auto")
        }];

        const pref = this.getPreference("animekai_pref_extract_streams");
        if (!pref) return streams;

        try {
            const baseUrl = sUrl.split("/list.m3u8")[0].split("/list,")[0];
            const response = await new Client().get(sUrl);
            const body = response.body;
            const lines = body.split('\n');

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('#EXT-X-STREAM-INF:')) {
                    const resolution = lines[i].match(/RESOLUTION=(\d+x\d+)/)?.[1];
                    if (!resolution) continue;
                    
                    const qUrl = lines[i + 1]?.trim();
                    if (!qUrl) continue;
                    
                    const m3u8Url = `${baseUrl}/${qUrl}`;
                    streams.push({
                        url: m3u8Url,
                        originalUrl: m3u8Url,
                        quality: streamNamer(resolution)
                    });
                }
            }
        } catch (error) {
            console.error("Failed to extract stream qualities:", error);
        }

        return streams;
    }

    async getMegaUrl(vidId) {
        const token = await this.kaiEncrypt(vidId);
        const res = await this.request(`/ajax/links/view?id=${vidId}&_=${token}`, {
            headers: {
                "X-Requested-With": "XMLHttpRequest"
            }
        });
        if (!res) return null;
        
        const body = JSON.parse(res);
        if (body.status !== 200) return null;
        
        const outEnc = body.result;
        const out = await this.kaiDecrypt(outEnc);
        try {
            const o = JSON.parse(out);
            return decodeURIComponent(o.url);
        } catch (e) {
            console.error("Failed to parse mega URL response:", e);
            return null;
        }
    }

    async decryptMegaEmbed(megaUrl, serverName, dubType) {
        megaUrl = megaUrl.replace("/e/", "/media/");
        const res = await this.client.get(megaUrl);
        if (!res) return [];
        
        const body = JSON.parse(res.body);
        if (body.status !== 200) return [];
        
        const outEnc = body.result;
        const streamData = await this.megaDecrypt(outEnc);
        if (!streamData?.sources?.[0]?.file) return [];
        
        const url = streamData.sources[0].file;
        return await this.formatStreams(url, serverName, dubType);
    }

    // ... (keep all the base64, transform, reverseString, substitute methods the same)

    async getDecoderPattern() {
        const preferences = new SharedPreferences();
        let pattern = preferences.getString("anime_kai_decoder_pattern", "");
        const pattern_ts = parseInt(preferences.getString("anime_kai_decoder_pattern_ts", "0"));
        const now_ts = Math.floor(Date.now() / 1000);

        if (now_ts - pattern_ts > 30 * 60) {
            try {
                const res = await this.client.get("https://raw.githubusercontent.com/amarullz/kaicodex/main/generated/kai_codex.json");
                pattern = res.body;
                preferences.setString("anime_kai_decoder_pattern", pattern);
                preferences.setString("anime_kai_decoder_pattern_ts", `${now_ts}`);
            } catch (error) {
                console.error("Failed to fetch decoder pattern:", error);
            }
        }

        try {
            return JSON.parse(pattern);
        } catch (e) {
            console.error("Failed to parse decoder pattern:", e);
            return {};
        }
    }

    // ... (keep all the patternExecutor, kaiEncrypt, kaiDecrypt, megaDecrypt methods the same)

    getFilterList() {
        // ... (keep the same filter list implementation)
    }

    getSourcePreferences() {
        // ... (keep the same preferences implementation)
    }
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
