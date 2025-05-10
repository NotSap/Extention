const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "0.2.4",
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

    async request(slug) {
        try {
            var url = slug;
            var baseUrl = this.getBaseUrl();
            if (!slug.includes(baseUrl)) url = baseUrl + slug;
            var res = await this.client.get(url);
            return res.body;
        } catch (e) {
            console.log("Request failed:", e);
            return null;
        }
    }

    async getPage(slug) {
        var res = await this.request(slug);
        return res ? new Document(res) : null;
    }

    async searchPage({ query = "", page = 1, ...filters } = {}) {
        try {
            const params = new URLSearchParams();
            if (query) params.append("keyword", query.trim());
            params.append("page", page);
            
            // Add all filter parameters
            Object.entries(filters).forEach(([key, values]) => {
                if (Array.isArray(values)) values.forEach(v => params.append(`${key}[]`, v));
            });

            const body = await this.getPage(`/filter?${params.toString()}`);
            if (!body) return { list: [], hasNextPage: false };

            const list = [];
            const items = body.select(".film-list > .film-item, .items > .item");
            
            items.forEach(item => {
                try {
                    const link = item.selectFirst("a")?.getHref;
                    const image = item.selectFirst("img")?.attr("data-src") || item.selectFirst("img")?.getSrc;
                    const title = item.selectFirst(".film-name, .name")?.text?.trim();
                    
                    if (link && title) {
                        list.push({
                            name: title,
                            link: link.startsWith("/") ? link : `/${link}`,
                            imageUrl: image
                        });
                    }
                } catch (e) {
                    console.log("Error parsing item:", e);
                }
            });

            const hasNextPage = body.select(".pagination a:contains(Next)").length > 0;
            return { list, hasNextPage };
        } catch (e) {
            console.log("Search failed:", e);
            return { list: [], hasNextPage: false };
        }
    }

    async getPopular(page) {
        const types = this.getPreference("animekai_popular_latest_type") || ["tv", "movie"];
        return this.searchPage({ 
            sort: "trending",
            type: types,
            page
        });
    }

    async getLatestUpdates(page) {
        const types = this.getPreference("animekai_popular_latest_type") || ["tv", "movie"];
        return this.searchPage({
            sort: "updated_date",
            type: types,
            page
        });
    }

    async search(query, page, filters) {
        const filterValues = {};
        if (filters) {
            filters.forEach((filter, index) => {
                const key = ["type","genre","status","season","year","rating","country","language"][index];
                filterValues[key] = filter.state?.filter(s => s.state).map(s => s.value) || [];
            });
        }
        return this.searchPage({ query, page, ...filterValues });
    }

    async getDetail(url) {
        try {
            const body = await this.getPage(url);
            if (!body) return null;

            const main = body.selectFirst(".watch-section, .anime-detail");
            if (!main) return null;

            const details = {
                name: main.selectFirst(".title, h1")?.text?.trim() || "Unknown",
                imageUrl: main.selectFirst("img")?.getSrc || "",
                link: url,
                description: main.selectFirst(".desc, .description")?.text?.trim() || "",
                genre: [],
                status: 0,
                chapters: [],
                anifyInfo: {}
            };

            // Extract metadata
            main.select(".detail > div, .meta > div").forEach(item => {
                const text = item.text?.trim();
                if (text?.includes("Genres")) {
                    details.genre = text.replace("Genres:", "").split(",").map(g => g.trim());
                } else if (text?.includes("Status")) {
                    details.status = text.includes("Ongoing") ? 0 : 1;
                }
            });

            // Extract episodes
            const animeId = body.selectFirst("[data-id]")?.attr("data-id");
            if (animeId) {
                const token = await this.kaiEncrypt(animeId);
                const res = await this.request(`/ajax/episodes/list?ani_id=${animeId}&_=${token}`);
                if (res) {
                    const data = JSON.parse(res);
                    if (data.status === 200) {
                        const doc = new Document(data.result);
                        doc.select("li").forEach(ep => {
                            const a = ep.selectFirst("a");
                            if (a) {
                                details.chapters.push({
                                    name: `Episode ${a.attr("num")}`,
                                    url: a.attr("token"),
                                    scanlator: a.attr("langs") === "1" ? "SUB" : "DUB"
                                });
                            }
                        });
                        details.chapters.reverse();
                    }
                }
            }

            return details;
        } catch (e) {
            console.log("Failed to get details:", e);
            return null;
        }
    }

    async getVideoList(url) {
        try {
            const streams = [];
            const servers = this.getPreference("animekai_pref_stream_server") || ["1"];
            const dubTypes = this.getPreference("animekai_pref_stream_subdub_type") || ["sub"];

            for (const epId of url.split("||")) {
                const token = await this.kaiEncrypt(epId);
                const res = await this.request(`/ajax/links/list?token=${epId}&_=${token}`);
                if (!res) continue;

                const data = JSON.parse(res);
                if (data.status !== 200) continue;

                const doc = new Document(data.result);
                doc.select("div.server-items").forEach(server => {
                    const type = server.attr("data-id");
                    if (!dubTypes.includes(type)) return;

                    server.select("span.server").forEach(s => {
                        if (servers.includes(s.text.replace("Server ", ""))) {
                            const lid = s.attr("data-lid");
                            if (lid) streams.push({ server: s.text, lid, type });
                        }
                    });
                });
            }

            const results = [];
            for (const stream of streams) {
                const megaUrl = await this.getMegaUrl(stream.lid);
                if (!megaUrl) continue;

                const embed = await this.decryptMegaEmbed(megaUrl, stream.server, stream.type.toUpperCase());
                if (embed) results.push(...embed);
            }

            return results;
        } catch (e) {
            console.log("Failed to get video list:", e);
            return [];
        }
    }

    getFilterList() {
        function formateState(type_name, items, values) {
            var state = [];
            for (var i = 0; i < items.length; i++) {
                state.push({ type_name: type_name, name: items[i], value: values[i] });
            }
            return state;
        }

        var filters = [];

        var items = ["TV", "Special", "OVA", "ONA", "Music", "Movie"];
        var values = ["tv", "special", "ova", "ona", "music", "movie"];
        filters.push({
            type_name: "GroupFilter",
            name: "Types",
            state: formateState("CheckBox", items, values)
        });

        items = [
            "Action", "Adventure", "Avant Garde", "Boys Love", "Comedy", "Demons", "Drama", "Ecchi", "Fantasy",
            "Girls Love", "Gourmet", "Harem", "Horror", "Isekai", "Iyashikei", "Josei", "Kids", "Magic",
            "Mahou Shoujo", "Martial Arts", "Mecha", "Military", "Music", "Mystery", "Parody", "Psychological",
            "Reverse Harem", "Romance", "School", "Sci-Fi", "Seinen", "Shoujo", "Shounen", "Slice of Life",
            "Space", "Sports", "Super Power", "Supernatural", "Suspense", "Thriller", "Vampire"
        ];

        values = [
            "47", "1", "235", "184", "7", "127", "66", "8", "34", "926", "436", "196", "421", "77", "225",
            "555", "35", "78", "857", "92", "219", "134", "27", "48", "356", "240", "798", "145", "9", "36",
            "189", "183", "37", "125", "220", "10", "350", "49", "322", "241", "126"
        ];

        filters.push({
            type_name: "GroupFilter",
            name: "Genres",
            state: formateState("CheckBox", items, values)
        });

        items = ["Not Yet Aired", "Releasing", "Completed"];
        values = ["info", "releasing", "completed"];
        filters.push({
            type_name: "GroupFilter",
            name: "Status",
            state: formateState("CheckBox", items, values)
        });

        items = [
            "All", "Updated date", "Released date", "End date", "Added date", "Trending",
            "Name A-Z", "Average score", "MAL score", "Total views", "Total bookmarks", "Total episodes"
        ];

        values = [
            "", "updated_date", "released_date", "end_date", "added_date", "trending",
            "title_az", "avg_score", "mal_score", "total_views", "total_bookmarks", "total_episodes"
        ];
        filters.push({
            type_name: "SelectFilter",
            name: "Sort by",
            state: 0,
            values: formateState("SelectOption", items, values)
        });

        items = ["Fall", "Summer", "Spring", "Winter", "Unknown"];
        values = ["fall", "summer", "spring", "winter", "unknown"];
        filters.push({
            type_name: "GroupFilter",
            name: "Season",
            state: formateState("CheckBox", items, values)
        });

        const currentYear = new Date().getFullYear();
        var years = Array.from({ length: currentYear - 1999 }, (_, i) => (2000 + i).toString()).reverse();
        items = [...years, "1990s", "1980s", "1970s", "1960s", "1950s", "1940s", "1930s", "1920s", "1910s", "1900s"];
        filters.push({
            type_name: "GroupFilter",
            name: "Years",
            state: formateState("CheckBox", items, items)
        });

        items = [
            "G - All Ages",
            "PG - Children",
            "PG 13 - Teens 13 and Older",
            "R - 17+, Violence & Profanity",
            "R+ - Profanity & Mild Nudity",
            "Rx - Hentai"
        ];

        values = ["g", "pg", "pg_13", "r", "r+", "rx"];
        filters.push({
            type_name: "GroupFilter",
            name: "Ratings",
            state: formateState("CheckBox", items, items)
        });

        items = ["Japan", "China"];
        values = ["11", "2"];
        filters.push({
            type_name: "GroupFilter",
            name: "Country",
            state: formateState("CheckBox", items, items)
        });

        items = ["Hard Sub", "Soft Sub", "Dub", "Sub & Dub"];
        values = ["sub", "softsub", "dub", "subdub"];
        filters.push({
            type_name: "GroupFilter",
            name: "Language",
            state: formateState("CheckBox", items, items)
        });

        return filters;
    }

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
                key: "animekai_popular_latest_type",
                multiSelectListPreference: {
                    title: 'Preferred type of anime to be shown in popular & latest section',
                    summary: 'Choose which type of anime you want to see in the popular &latest section',
                    values: ["tv", "special", "ova", "ona"],
                    entries: ["TV", "Special", "OVA", "ONA", "Music", "Movie"],
                    entryValues: ["tv", "special", "ova", "ona", "music", "movie"]
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
                multiSelectListPreference: {
                    title: 'Preferred server',
                    summary: 'Choose the server/s you want to extract streams from',
                    values: ["1"],
                    entries: ["Server 1", "Server 2"],
                    entryValues: ["1", "2"]
                }
            }, {
                key: "animekai_pref_stream_subdub_type",
                multiSelectListPreference: {
                    title: 'Preferred stream sub/dub type',
                    summary: '',
                    values: ["sub", "softsub", "dub"],
                    entries: ["Hard Sub", "Soft Sub", "Dub"],
                    entryValues: ["sub", "softsub", "dub"]
                }
            }, {
                key: "animekai_pref_extract_streams",
                switchPreferenceCompat: {
                    title: 'Split stream into different quality streams',
                    summary: "Split stream Auto into 360p/720p/1080p",
                    value: true
                }
            },
        ];
    }

    formatSubtitles(subtitles, dubType) {
        var subs = [];
        subtitles.forEach(sub => {
            if (!sub.kind.includes("thumbnail")) {
                subs.push({
                    file: sub.file,
                    label: `${sub.label} - ${dubType}`
                });
            }
        });
        return subs;
    }

    async formatStreams(sUrl, serverName, dubType) {
        function streamNamer(res) {
            return `${res} - ${dubType} : ${serverName}`;
        }

        var streams = [{
            url: sUrl,
            originalUrl: sUrl,
            quality: streamNamer("Auto")
        }];

        var pref = this.getPreference("animekai_pref_extract_streams");
        if (!pref) return streams;

        var baseUrl = sUrl.split("/list.m3u8")[0].split("/list,")[0];

        const response = await new Client().get(sUrl);
        const body = response.body;
        const lines = body.split('\n');

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('#EXT-X-STREAM-INF:')) {
                var resolution = lines[i].match(/RESOLUTION=(\d+x\d+)/)[1];
                var qUrl = lines[i + 1].trim();
                var m3u8Url = `${baseUrl}/${qUrl}`;
                streams.push({
                    url: m3u8Url,
                    originalUrl: m3u8Url,
                    quality: streamNamer(resolution)
                });
            }
        }
        return streams;
    }

    async getMegaUrl(vidId) {
        var token = await this.kaiEncrypt(vidId);
        var res = await this.request(`/ajax/links/view?id=${vidId}&_=${token}`);
        var body = JSON.parse(res);
        if (body.status != 200) return;
        var outEnc = body.result;
        var out = await this.kaiDecrypt(outEnc);
        var o = JSON.parse(out);
        return decodeURIComponent(o.url);
    }

    async decryptMegaEmbed(megaUrl, serverName, dubType) {
        var streams = [];
        megaUrl = megaUrl.replace("/e/", "/media/");
        var res = await this.client.get(megaUrl);
        var body = JSON.parse(res.body);
        if (body.status != 200) return;
        var outEnc = body.result;
        var streamData = await this.megaDecrypt(outEnc);
        var url = streamData.sources[0].file;

        var streams = await this.formatStreams(url, serverName, dubType);

        var subtitles = streamData.tracks;
        streams[0].subtitles = this.formatSubtitles(subtitles, dubType);
        return streams;
    }

    base64UrlDecode(input) {
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
            f.push(String.fromCharCode(text.charCodeAt(a) ^ v[(v[w] + v[sum]) % 256]));
            a++;
        }
        return f.join('');
    }

    reverseString(input) {
        return input.split('').reverse().join('');
    }

    substitute(input, keys, values) {
        const map = {};
        for (let i = 0; i < keys.length; i++) {
            map[keys[i]] = values[i] || keys[i];
        }
        return input.split('').map(char => map[char] || char).join('');
    }

    async getDecoderPattern() {
        const preferences = new SharedPreferences();
        let pattern = preferences.getString("anime_kai_decoder_pattern", "");
        var pattern_ts = parseInt(preferences.getString("anime_kai_decoder_pattern_ts", "0"));
        var now_ts = parseInt(new Date().getTime() / 1000);

        if (now_ts - pattern_ts > 30 * 60) {
            var res = await this.client.get("https://raw.githubusercontent.com/amarullz/kaicodex/refs/heads/main/generated/kai_codex.json");
            pattern = res.body;
            preferences.setString("anime_kai_decoder_pattern", pattern);
            preferences.setString("anime_kai_decoder_pattern_ts", `${now_ts}`);
        }

        return JSON.parse(pattern);
    }

    async patternExecutor(key, type, id) {
        var result = id;
        var pattern = await this.getDecoderPattern();
        var logic = pattern[key][type];
        logic.forEach(step => {
            var method = step[0];
            if (method == "urlencode") result = encodeURIComponent(result);
            else if (method == "urldecode") result = decodeURIComponent(result);
            else if (method == "rc4") result = this.transform(step[1], result);
            else if (method == "reverse") result = this.reverseString(result);
            else if (method == "substitute") result = this.substitute(result, step[1], step[2]);
            else if (method == "safeb64_decode") result = this.base64UrlDecode(result);
            else if (method == "safeb64_encode") result = this.base64UrlEncode(result);
        });
        return result;
    }

    async kaiEncrypt(id) {
        var token = await this.patternExecutor("kai", "encrypt", id);
        return token;
    }

    async kaiDecrypt(id) {
        var token = await this.patternExecutor("kai", "decrypt", id);
        return token;
    }

    async megaDecrypt(data) {
        var streamData = await this.patternExecutor("megaup", "decrypt", data);
        return JSON.parse(streamData);
    }
}
