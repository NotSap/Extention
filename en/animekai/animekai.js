const mangayomiSources = [{
    "name": "Animekai",
    "id": 123456789,
    "baseUrl": "https://animekai.to",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "https://raw.githubusercontent.com/NotSap/mangayomi-animekai/main/en/animekai/animekai.js",
    "apiUrl": "",
    "version": "1.0.1",
    "isManga": false,
    "itemType": 1,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1
}];

class AnimeKaiExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
        this.cache = new Map();
    }

    getPreference(key) {
        const pref = new SharedPreferences().get(key);
        return pref !== undefined ? pref : "";
    }

    getBaseUrl() {
        return this.getPreference("animekai_base_url") || "https://animekai.to";
    }

    async request(url, options = {}) {
        try {
            const fullUrl = url.startsWith("http") ? url : this.getBaseUrl() + url;
            const res = await this.client.get(fullUrl, {
                headers: {
                    "Referer": this.getBaseUrl(),
                    ...(options.headers || {})
                },
                ...options
            });
            return res?.body || null;
        } catch (error) {
            console.error(`Request failed for ${url}:`, error);
            return null;
        }
    }

    async getPage(url) {
        const content = await this.request(url);
        return content ? new Document(content) : null;
    }

    async searchPage(params = {}) {
        const {
            query = "",
            type = [],
            genre = [],
            status = [],
            sort = "updated_date",
            season = [],
            year = [],
            rating = [],
            country = [],
            language = [],
            page = 1
        } = params;

        function bundleParams(category, items) {
            return items.map(item => `&${category}[]=${encodeURIComponent(item)}`).join("");
        }

        let slug = "/browser?keyword=" + encodeURIComponent(query);
        slug += bundleParams("type", type);
        slug += bundleParams("genre", genre);
        slug += bundleParams("status", status);
        slug += bundleParams("season", season);
        slug += bundleParams("year", year);
        slug += bundleParams("rating", rating);
        slug += bundleParams("country", country);
        slug += bundleParams("language", language);
        slug += `&sort=${sort}&page=${page}`;

        const body = await this.getPage(slug);
        if (!body) {
            return {
                list: [{
                    name: "Nothing Found",
                    link: "",
                    imageUrl: "",
                    description: "Try different search terms"
                }],
                hasNextPage: false
            };
        }

        const paginations = body.select(".pagination > li");
        const hasNextPage = paginations.length > 0 
            ? !paginations.last().className.includes("active") 
            : false;

        const titlePref = this.getPreference("animekai_title_lang") || "title";
        const animeItems = body.select(".aitem-wrapper .aitem");
        const list = animeItems.map(anime => {
            const titleElement = anime.selectFirst(`a.title`);
            return {
                name: titleElement?.attr(titlePref) || titleElement?.text || "Untitled",
                link: anime.selectFirst("a")?.getHref || "",
                imageUrl: anime.selectFirst("img")?.attr("data-src") || "",
                description: anime.selectFirst(".desc")?.text?.substring(0, 100) + "..." || ""
            };
        }).filter(item => item.link);

        return { list, hasNextPage };
    }

    async getPopular(page = 1) {
        const types = this.getPreference("animekai_popular_latest_type") || ["tv"];
        return this.searchPage({ 
            sort: "trending", 
            type: Array.isArray(types) ? types : [types], 
            page 
        });
    }

    async getLatestUpdates(page = 1) {
        const types = this.getPreference("animekai_popular_latest_type") || ["tv"];
        return this.searchPage({ 
            sort: "updated_date", 
            type: Array.isArray(types) ? types : [types], 
            page 
        });
    }

    async search(query = "", page = 1, filters = []) {
        const getActiveFilters = (filter) => {
            if (!filter || !filter.state) return [];
            return filter.state
                .filter(f => f?.state)
                .map(f => f?.value)
                .filter(Boolean);
        };

        // Ensure filters array is properly initialized
        while (filters.length < 9) {
            filters.push({ state: [] });
        }

        return this.searchPage({
            query,
            page,
            type: getActiveFilters(filters[0]),
            genre: getActiveFilters(filters[1]),
            status: getActiveFilters(filters[2]),
            sort: filters[3]?.values?.[filters[3]?.state]?.value || "updated_date",
            season: getActiveFilters(filters[4]),
            year: getActiveFilters(filters[5]),
            rating: getActiveFilters(filters[6]),
            country: getActiveFilters(filters[7]),
            language: getActiveFilters(filters[8])
        });
    }

    async getDetail(url) {
        const statusMap = {
            "Releasing": 0,
            "Completed": 1,
            "Not Yet Aired": 4,
            "Hiatus": 2,
            "Cancelled": 3
        };

        const body = await this.getPage(url);
        if (!body) {
            return {
                name: "Error Loading Anime",
                imageUrl: "",
                link: this.getBaseUrl() + url,
                description: "Failed to load anime details",
                genre: [],
                status: 5,
                chapters: []
            };
        }

        const mainSection = body.selectFirst(".watch-section");
        if (!mainSection) {
            return {
                name: "Invalid Page Structure",
                imageUrl: "",
                link: this.getBaseUrl() + url,
                description: "The anime page has unexpected format",
                genre: [],
                status: 5,
                chapters: []
            };
        }

        const titlePref = this.getPreference("animekai_title_lang") || "title";
        const name = mainSection.selectFirst(".title")?.attr(titlePref) || 
                   mainSection.selectFirst(".title")?.text || "Untitled";
        
        const imageUrl = mainSection.selectFirst(".poster img")?.getSrc || "";
        const description = mainSection.selectFirst(".desc")?.text || "No description available";

        let genre = [];
        let status = 5;
        mainSection.select(".detail > div").forEach(item => {
            const text = item.text.trim();
            if (text.startsWith("Genres:")) {
                genre = text.replace("Genres:", "").trim().split(", ").filter(Boolean);
            } else if (text.startsWith("Status:")) {
                const statusText = item.selectFirst("span")?.text;
                status = statusMap[statusText] || 5;
            }
        });

        const animeId = body.selectFirst("#anime-rating")?.attr("data-id");
        if (!animeId) {
            return {
                name,
                imageUrl,
                link: this.getBaseUrl() + url,
                description,
                genre,
                status,
                chapters: [{
                    name: "Episodes Not Available",
                    url: "",
                    scanlator: "Check back later"
                }]
            };
        }

        const token = await this.kaiEncrypt(animeId);
        const res = await this.request(`/ajax/episodes/list?ani_id=${animeId}&_=${token}`);
        if (!res) {
            return {
                name,
                imageUrl,
                link: this.getBaseUrl() + url,
                description,
                genre,
                status,
                chapters: [{
                    name: "Failed to Load Episodes",
                    url: "",
                    scanlator: "Try refreshing"
                }]
            };
        }

        let episodesData;
        try {
            episodesData = JSON.parse(res);
        } catch (e) {
            return {
                name,
                imageUrl,
                link: this.getBaseUrl() + url,
                description,
                genre,
                status,
                chapters: [{
                    name: "Invalid Episode Data",
                    url: "",
                    scanlator: "Server error"
                }]
            };
        }

        if (episodesData.status !== 200 || !episodesData.result) {
            return {
                name,
                imageUrl,
                link: this.getBaseUrl() + url,
                description,
                genre,
                status,
                chapters: [{
                    name: "Episode Coming Soon",
                    url: "",
                    scanlator: "Check back later"
                }]
            };
        }

        const doc = new Document(episodesData.result);
        const episodeElements = doc.select(".eplist.titles li");
        const showUncenEp = this.getPreference("animekai_show_uncen_epsiodes") !== "false";

        const chapters = [];
        const processedEps = new Set();

        for (const item of episodeElements) {
            const aTag = item.selectFirst("a");
            if (!aTag) continue;

            const num = parseInt(aTag.attr("num")) || 0;
            if (processedEps.has(num)) continue;

            const title = aTag.selectFirst("span")?.text || "";
            const epName = title.includes("Episode") ? `Episode ${num}` : `Episode ${num}: ${title}`;
            const langs = aTag.attr("langs");
            const scanlator = langs === "1" ? "SUB" : "SUB, DUB";
            const token = aTag.attr("token");
            const isUncensored = aTag.attr("slug")?.includes("uncen");

            if (isUncensored && !showUncenEp) continue;

            const epData = {
                name: isUncensored ? `${epName} (Uncensored)` : epName,
                url: token,
                scanlator: isUncensored ? `${scanlator}, UNCENSORED` : scanlator,
                dateUpload: item.attr("data-date") || ""
            };

            chapters.push(epData);
            processedEps.add(num);
        }

        return {
            name,
            imageUrl,
            link: this.getBaseUrl() + url,
            description,
            genre,
            status,
            chapters: chapters.reverse()
        };
    }

    async getVideoList(url) {
        if (!url) {
            return [{
                url: "",
                quality: "Invalid URL",
                originalUrl: "",
                subtitles: []
            }];
        }

        const streams = [];
        const prefServer = (this.getPreference("animekai_pref_stream_server") || "1").split(",");
        const prefDubType = (this.getPreference("animekai_pref_stream_subdub_type") || "sub").split(",");
        const epSlugs = url.split("||");

        for (let i = 0; i < epSlugs.length; i++) {
            const epId = epSlugs[i];
            if (!epId) continue;

            const isUncensored = i > 0;
            const token = await this.kaiEncrypt(epId);
            const res = await this.request(`/ajax/links/list?token=${epId}&_=${token}`);
            if (!res) continue;

            let body;
            try {
                body = JSON.parse(res);
            } catch (e) {
                continue;
            }

            if (body.status !== 200 || !body.result) continue;

            const serverResult = new Document(body.result);
            const serverItems = serverResult.select(".server-items");

            for (const dubSection of serverItems) {
                const dubType = dubSection.attr("data-id");
                if (!dubType || !prefDubType.includes(dubType)) continue;

                for (const server of dubSection.select("span.server")) {
                    const serverName = server.text;
                    const serverNum = serverName.replace("Server ", "");
                    if (!serverNum || !prefServer.includes(serverNum)) continue;

                    const dataId = server.attr("data-lid");
                    if (!dataId) continue;

                    const megaUrl = await this.getMegaUrl(dataId);
                    if (!megaUrl) continue;

                    const serverStreams = await this.decryptMegaEmbed(
                        megaUrl, 
                        serverName, 
                        dubType.toUpperCase() + (isUncensored ? " [Uncensored]" : "")
                    );
                    
                    if (serverStreams?.length) {
                        streams.push(...serverStreams);
                    }
                }
            }
        }

        return streams.length > 0 ? streams : [{
            url: "",
            quality: "No streams available",
            originalUrl: "",
            subtitles: []
        }];
    }

    getFilterList() {
        function formatState(type_name, items, values) {
            return items.map((name, i) => ({
                type_name,
                name,
                value: values[i]
            }));
        }

        return [
            {
                type_name: "GroupFilter",
                name: "Types",
                state: formatState(
                    "CheckBox",
                    ["TV", "Special", "OVA", "ONA", "Music", "Movie"],
                    ["tv", "special", "ova", "ona", "music", "movie"]
                )
            },
            {
                type_name: "GroupFilter",
                name: "Genres",
                state: formatState(
                    "CheckBox",
                    [
                        "Action", "Adventure", "Avant Garde", "Boys Love", "Comedy", 
                        "Demons", "Drama", "Ecchi", "Fantasy", "Girls Love"
                    ],
                    [
                        "47", "1", "235", "184", "7", 
                        "127", "66", "8", "34", "926"
                    ]
                )
            },
            {
                type_name: "GroupFilter",
                name: "Status",
                state: formatState(
                    "CheckBox",
                    ["Not Yet Aired", "Releasing", "Completed"],
                    ["info", "releasing", "completed"]
                )
            },
            {
                type_name: "SelectFilter",
                name: "Sort by",
                state: 0,
                values: formatState(
                    "SelectOption",
                    [
                        "All", "Updated date", "Released date", "End date", 
                        "Added date", "Trending", "Name A-Z"
                    ],
                    [
                        "", "updated_date", "released_date", "end_date", 
                        "added_date", "trending", "title_az"
                    ]
                )
            },
            {
                type_name: "GroupFilter",
                name: "Season",
                state: formatState(
                    "CheckBox",
                    ["Fall", "Summer", "Spring", "Winter", "Unknown"],
                    ["fall", "summer", "spring", "winter", "unknown"]
                )
            },
            {
                type_name: "GroupFilter",
                name: "Years",
                state: formatState(
                    "CheckBox",
                    Array.from({length: new Date().getFullYear() - 1999}, (_, i) => (2000 + i).toString()).reverse(),
                    Array.from({length: new Date().getFullYear() - 1999}, (_, i) => (2000 + i).toString()).reverse()
                )
            },
            {
                type_name: "GroupFilter",
                name: "Ratings",
                state: formatState(
                    "CheckBox",
                    [
                        "G - All Ages",
                        "PG - Children",
                        "PG 13 - Teens 13+",
                        "R - 17+ (Violence)",
                        "R+ - Mild Nudity",
                        "Rx - Hentai"
                    ],
                    ["g", "pg", "pg_13", "r", "r+", "rx"]
                )
            },
            {
                type_name: "GroupFilter",
                name: "Country",
                state: formatState(
                    "CheckBox",
                    ["Japan", "China"],
                    ["11", "2"]
                )
            },
            {
                type_name: "GroupFilter",
                name: "Language",
                state: formatState(
                    "CheckBox",
                    ["Hard Sub", "Soft Sub", "Dub", "Sub & Dub"],
                    ["sub", "softsub", "dub", "subdub"]
                )
            }
        ];
    }

    getSourcePreferences() {
        return [
            {
                key: "animekai_base_url",
                editTextPreference: {
                    title: "Base URL",
                    summary: "Change if site is down",
                    value: "https://animekai.to",
                    dialogTitle: "Enter AnimeKai URL",
                    dialogMessage: "Only modify if needed"
                }
            },
            {
                key: "animekai_popular_latest_type",
                multiSelectListPreference: {
                    title: "Content Types",
                    summary: "For Popular/Latest sections",
                    values: ["tv", "movie"],
                    entries: ["TV Shows", "Movies", "OVAs", "Specials", "ONAs", "Music"],
                    entryValues: ["tv", "movie", "ova", "special", "ona", "music"]
                }
            },
            {
                key: "animekai_title_lang",
                listPreference: {
                    title: "Title Language",
                    summary: "Preferred title display",
                    valueIndex: 0,
                    entries: ["English", "Romaji", "Native"],
                    entryValues: ["title", "data-jp", "data-native"]
                }
            },
            {
                key: "animekai_show_uncen_epsiodes",
                switchPreferenceCompat: {
                    title: "Show Uncensored",
                    summary: "Include uncensored episodes",
                    value: false
                }
            },
            {
                key: "animekai_pref_stream_server",
                multiSelectListPreference: {
                    title: "Preferred Servers",
                    summary: "Streaming server priority",
                    values: ["1", "2"],
                    entries: ["Server 1", "Server 2", "Server 3"],
                    entryValues: ["1", "2", "3"]
                }
            },
            {
                key: "animekai_pref_stream_subdub_type",
                multiSelectListPreference: {
                    title: "Audio Preference",
                    summary: "Sub/Dub priority",
                    values: ["sub", "dub"],
                    entries: ["Subtitled", "Dubbed", "Softsubs"],
                    entryValues: ["sub", "dub", "softsub"]
                }
            },
            {
                key: "animekai_pref_extract_streams",
                switchPreferenceCompat: {
                    title: "Extract Resolutions",
                    summary: "Show quality options",
                    value: true
                }
            }
        ];
    }

    formatSubtitles(subtitles, dubType) {
        return (subtitles || []).filter(sub => 
            sub?.file && !sub.kind?.includes("thumbnail")
        ).map(sub => ({
            file: sub.file,
            label: `${sub.label || 'Sub'} - ${dubType}`
        }));
    }

    async formatStreams(sUrl, serverName, dubType) {
        if (!sUrl) return [];

        const streamNamer = (res) => `${res} - ${dubType} : ${serverName}`;
        const streams = [{
            url: sUrl,
            originalUrl: sUrl,
            quality: streamNamer("Auto")
        }];

        const pref = this.getPreference("animekai_pref_extract_streams");
        if (!pref || pref === "false") return streams;

        try {
            const baseUrl = sUrl.split("/list.m3u8")[0].split("/list,")[0];
            const response = await this.client.get(sUrl);
            const lines = response.body.split('\n');

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('#EXT-X-STREAM-INF:')) {
                    const resolution = lines[i].match(/RESOLUTION=(\d+x\d+)/)?.[1];
                    const qUrl = lines[i + 1]?.trim();
                    if (resolution && qUrl) {
                        const m3u8Url = `${baseUrl}/${qUrl}`;
                        streams.push({
                            url: m3u8Url,
                            originalUrl: m3u8Url,
                            quality: streamNamer(resolution)
                        });
                    }
                }
            }
        } catch (e) {
            console.error("Failed to extract streams:", e);
        }

        return streams;
    }

    async getMegaUrl(vidId) {
        if (!vidId) return null;

        const token = await this.kaiEncrypt(vidId);
        const res = await this.request(`/ajax/links/view?id=${vidId}&_=${token}`);
        if (!res) return null;

        try {
            const body = JSON.parse(res);
            if (body.status !== 200 || !body.result) return null;

            const out = await this.kaiDecrypt(body.result);
            const o = JSON.parse(out);
            return decodeURIComponent(o.url);
        } catch (e) {
            console.error("Failed to get mega URL:", e);
            return null;
        }
    }

    async decryptMegaEmbed(megaUrl, serverName, dubType) {
        if (!megaUrl) return [];

        try {
            const processedUrl = megaUrl.replace("/e/", "/media/");
            const res = await this.client.get(processedUrl);
            const body = JSON.parse(res.body);

            if (body.status !== 200 || !body.result) return [];

            const streamData = await this.megaDecrypt(body.result);
            if (!streamData?.sources?.[0]?.file) return [];

            const streams = await this.formatStreams(
                streamData.sources[0].file, 
                serverName, 
                dubType
            );

            if (streams[0]) {
                streams[0].subtitles = this.formatSubtitles(
                    streamData.tracks || [], 
                    dubType
                );
            }

            return streams;
        } catch (e) {
            console.error("Failed to decrypt mega embed:", e);
            return [];
        }
    }

    base64UrlDecode(input) {
        if (!input) return "";

        let base64 = input
            .replace(/-/g, "+")
            .replace(/_/g, "/");

        while (base64.length % 4 !== 0) {
            base64 += "=";
        }

        const base64abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        const outputBytes = [];

        for (let i = 0; i < base64.length; i += 4) {
            const c1 = base64abc.indexOf(base64[i]);
            const c2 = base64abc.indexOf(base64[i + 1]);
            const c3 = base64abc.indexOf(base64[i + 2]);
            const c4 = base64abc.indexOf(base64[i + 3]);

            const triplet = (c1 << 18) | (c2 << 12) | ((c3 & 63) << 6) | (c4 & 63);

            outputBytes.push((triplet >> 16) & 0xFF);
            if (base64[i + 2] !== "=") outputBytes.push((triplet >> 8) & 0xFF);
            if (base64[i + 3] !== "=") outputBytes.push(triplet & 0xFF);
        }

        return String.fromCharCode(...outputBytes);
    }

    base64UrlEncode(str) {
        if (!str) return "";

        const bytes = [];
        for (let i = 0; i < str.length; i++) {
            bytes.push(str.charCodeAt(i) & 0xFF);
        }

        const base64abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let base64 = "";

        for (let i = 0; i < bytes.length; i += 3) {
            const b1 = bytes[i];
            const b2 = bytes[i + 1] ?? 0;
            const b3 = bytes[i + 2] ?? 0;

            const triplet = (b1 << 16) | (b2 << 8) | b3;

            base64 += base64abc[(triplet >> 18) & 0x3F];
            base64 += base64abc[(triplet >> 12) & 0x3F];
            base64 += i + 1 < bytes.length ? base64abc[(triplet >> 6) & 0x3F] : "=";
            base64 += i + 2 < bytes.length ? base64abc[triplet & 0x3F] : "=";
        }

        return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }

    transform(key, text) {
        if (!key || !text) return "";

        const v = Array.from({ length: 256 }, (_, i) => i);
        let c = 0;
        const f = [];

        for (let w = 0; w < 256; w++) {
            c = (c + v[w] + key.charCodeAt(w % key.length)) % 256;
            [v[w], v[c]] = [v[c], v[w]];
        }

        let a = 0, w = 0, sum = 0;
        while (a < text.length) {
            w = (w + 1) % 256;
            sum = (sum + v[w]) % 256;
            [v[w], v[sum]] = [v[sum], v[w]];
            f.push(String.fromCharCode(text.charCodeAt(a) ^ v[(v[w] + v[sum]) % 256]);
            a++;
        }
        return f.join('');
    }

    reverseString(input) {
        return input?.split('').reverse().join('') || "";
    }

    substitute(input, keys, values) {
        if (!input) return "";

        const map = {};
        for (let i = 0; i < keys.length; i++) {
            map[keys[i]] = values[i] || keys[i];
        }
        return input.split('').map(char => map[char] || char).join('');
    }

    async getDecoderPattern() {
        try {
            const preferences = new SharedPreferences();
            let pattern = preferences.getString("anime_kai_decoder_pattern", "");
            const pattern_ts = parseInt(preferences.getString("anime_kai_decoder_pattern_ts", "0"));
            const now_ts = Math.floor(Date.now() / 1000);

            if (now_ts - pattern_ts > 1800) {
                const res = await this.client.get("https://raw.githubusercontent.com/amarullz/kaicodex/main/generated/kai_codex.json");
                if (res && res.body) {
                    pattern = res.body;
                    preferences.setString("anime_kai_decoder_pattern", pattern);
                    preferences.setString("anime_kai_decoder_pattern_ts", now_ts.toString());
                }
            }

            return JSON.parse(pattern || "{}");
        } catch (e) {
            console.error("Failed to get decoder pattern:", e);
            return {};
        }
    }

    async patternExecutor(key, type, id) {
        if (!id) return "";

        try {
            const pattern = await this.getDecoderPattern();
            const logic = pattern[key]?.[type];
            if (!logic) return id;

            let result = id;
            for (const step of logic) {
                const method = step[0];
                switch (method) {
                    case "urlencode":
                        result = encodeURIComponent(result);
                        break;
                    case "urldecode":
                        result = decodeURIComponent(result);
                        break;
                    case "rc4":
                        result = this.transform(step[1], result);
                        break;
                    case "reverse":
                        result = this.reverseString(result);
                        break;
                    case "substitute":
                        result = this.substitute(result, step[1], step[2]);
                        break;
                    case "safeb64_decode":
                        result = this.base64UrlDecode(result);
                        break;
                    case "safeb64_encode":
                        result = this.base64UrlEncode(result);
                        break;
                }
            }
            return result;
        } catch (e) {
            console.error("Pattern execution failed:", e);
            return "";
        }
    }

    async kaiEncrypt(id) {
        return this.patternExecutor("kai", "encrypt", id);
    }

    async kaiDecrypt(id) {
        return this.patternExecutor("kai", "decrypt", id);
    }

    async megaDecrypt(data) {
        const decrypted = await this.patternExecutor("megaup", "decrypt", data);
        try {
            return JSON.parse(decrypted);
        } catch (e) {
            console.error("Failed to parse decrypted data:", e);
            return {};
        }
    }
}

// Correct export for MangaYomi
if (typeof module !== 'undefined') {
    module.exports = {
        sources: mangayomiSources,
        extension: AnimeKaiExtension
    };
}
