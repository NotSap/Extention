const mangayomiSources = [{
    "name": "AllAnime",
    "lang": "en",
    "baseUrl": "https://allmanga.to",
    "apiUrl": "https://api.allanime.day/api",
    "iconUrl": "https://raw.githubusercontent.com/kodjodevf/mangayomi-extensions/main/javascript/icon/en.allanime.png",
    "typeSource": "single",
    "itemType": 1,
    "isNsfw": false,
    "version": "0.0.36",
    "dateFormat": "",
    "dateFormatLocale": "",
    "pkgPath": "anime/src/en/allanime.js"
}];

class DefaultExtension extends MProvider {
    async request(body) {
        const apiUrl = this.source.apiUrl;
        const baseUrl = this.source.baseUrl;
        
        try {
            const response = await new Client().get(apiUrl + body, { 
                "Referer": baseUrl,
                "Origin": baseUrl
            });
            return response?.body || "{}";
        } catch (error) {
            console.error("Request failed:", error);
            return "{}";
        }
    }

    async getPopular(page) {
        try {
            const encodedGql = `?variables=%7B%22type%22:%22anime%22,%22size%22:26,%22dateRange%22:1,%22page%22:${page}%7D&query=query($type:VaildPopularTypeEnumType!,$size:Int!,$dateRange:Int,$page:Int){queryPopular(type:$type,size:$size,dateRange:$dateRange,page:$page){recommendations{anyCard{_id,name,englishName,nativeName,thumbnail,slugTime}}}}`;
            const resList = JSON.parse(await this.request(encodedGql)).data?.queryPopular?.recommendations?.filter(e => e.anyCard !== null) || [];
            
            const preferences = new SharedPreferences();
            const titleStyle = preferences.get("preferred_title_style") || "romaji";
            const list = resList.map(anime => {
                let title;
                if (titleStyle === "romaji") title = anime.anyCard.name;
                else if (titleStyle === "eng") title = anime.anyCard.englishName || anime.anyCard.name;
                else title = anime.anyCard.nativeName || anime.anyCard.name;
                
                return {
                    name: title,
                    imageUrl: anime.anyCard.thumbnail,
                    link: `/bangumi/${anime.anyCard._id}/${anime.anyCard.name.replace(/[^a-zA-Z0-9]/g, "-").replace(/-{2,}/g, "-").toLowerCase()}`
                };
            });

            return { list, hasNextPage: list.length === 26 };
        } catch (error) {
            console.error("Error in getPopular:", error);
            return { list: [], hasNextPage: false };
        }
    }

    async getLatestUpdates(page) {
        return this.search("", page, []);
    }

    async search(query, page, filters) {
        try {
            query = query.replace(" ", "%20");
            const encodedGql = `?variables=%7B%22search%22:%7B%22query%22:%22${query}%22,%22allowAdult%22:false,%22allowUnknown%22:false%7D,%22countryOrigin%22:%22ALL%22,%22limit%22:26,%22page%22:${page}%7D&query=query($search:SearchInput,$limit:Int,$countryOrigin:VaildCountryOriginEnumType,$page:Int){shows(search:$search,limit:$limit,countryOrigin:$countryOrigin,page:$page){edges{_id,name,nativeName,englishName,thumbnail,slugTime}}}`;
            const resList = JSON.parse(await this.request(encodedGql)).data?.shows?.edges || [];
            
            const preferences = new SharedPreferences();
            const titleStyle = preferences.get("preferred_title_style") || "romaji";
            const list = resList.map(anime => {
                let title;
                if (titleStyle === "romaji") title = anime.name;
                else if (titleStyle === "eng") title = anime.englishName || anime.name;
                else title = anime.nativeName || anime.name;
                
                return {
                    name: title,
                    imageUrl: anime.thumbnail,
                    link: `/bangumi/${anime._id}/${anime.name.replace(/[^a-zA-Z0-9]/g, "-").replace(/-{2,}/g, "-").toLowerCase()}`
                };
            });

            return { list, hasNextPage: list.length === 26 };
        } catch (error) {
            console.error("Error in search:", error);
            return { list: [], hasNextPage: false };
        }
    }

    async getDetail(url) {
        try {
            const id = url.substringAfter('bangumi/').substringBefore('/');
            const encodedGql = `?variables=%7B%22id%22:%22${id}%22%7D&query=query($id:String!){show(_id:$id){thumbnail,description,type,season,score,genres,status,studios,availableEpisodesDetail}}`;
            const show = JSON.parse(await this.request(encodedGql)).data?.show;
            
            if (!show) return this.emptyDetailResponse();

            const episodes = this.processEpisodes(id, show.availableEpisodesDetail);
            
            return {
                description: `${show.description || ""}\n\nType: ${show.type || "Unknown"}\nAired: ${show.season?.quarter || "-"} ${show.season?.year || "-"}\nScore: ${show.score || "-"}★`,
                author: show.studios?.[0] || "",
                status: this.parseStatus(show.status),
                genre: show.genres || [],
                episodes
            };
        } catch (error) {
            console.error("Error in getDetail:", error);
            return this.emptyDetailResponse();
        }
    }

    emptyDetailResponse() {
        return {
            description: "Error loading details",
            author: "",
            status: 5,
            genre: [],
            episodes: []
        };
    }

    processEpisodes(id, availableEpisodes) {
        const episodesSub = (availableEpisodes?.sub || []).map(ep => ({
            num: parseInt(ep) || 1,
            name: `Episode ${parseInt(ep) || 1}`,
            url: JSON.stringify({ showId: id, translationType: ["sub"], episodeString: ep }),
            scanlator: "sub"
        }));

        const episodesDub = (availableEpisodes?.dub || []).map(ep => ({
            num: parseInt(ep) || 1,
            name: `Episode ${parseInt(ep) || 1}`,
            url: JSON.stringify({ showId: id, translationType: ["dub"], episodeString: ep }),
            scanlator: "dub"
        }));

        return episodesSub.length > 0 ? 
            episodesSub.map(ep => {
                const dub = episodesDub.find(e => e.num === ep.num);
                return dub ? {
                    name: ep.name,
                    url: JSON.stringify({
                        showId: id,
                        translationType: ['sub', 'dub'],
                        episodeString: JSON.parse(ep.url).episodeString
                    }),
                    scanlator: "sub, dub"
                } : ep;
            }) : 
            episodesDub;
    }

    parseStatus(string) {
        if (!string) return 5;
        switch (string) {
            case "Releasing": return 0;
            case "Finished": return 1;
            case "Not Yet Released": return 0;
            default: return 5;
        }
    }

    async getVideoList(url) {
        try {
            const baseUrl = this.source.baseUrl;
            const preferences = new SharedPreferences();
            const subPref = preferences.get("preferred_sub") || "sub";
            const ep = JSON.parse(url);
            
            const allTranslationTypes = Array.isArray(ep.translationType) ? 
                [...new Set(ep.translationType)] : 
                (ep.translationType ? [ep.translationType] : ["sub"]);

            const videos = [];
            const altHosterSelection = (preferences.get('alt_hoster_selection1') || [])
                .filter(h => h !== "mp4upload");

            // Try all available translation types
            for (const transType of allTranslationTypes) {
                try {
                    const typeVideos = await this.fetchVideosForType(
                        ep.showId,
                        ep.episodeString,
                        transType,
                        baseUrl,
                        altHosterSelection
                    );
                    
                    // Deduplicate while adding
                    typeVideos.forEach(newVid => {
                        if (!videos.some(existingVid => 
                            existingVid.url === newVid.url && 
                            existingVid.quality === newVid.quality
                        )) {
                            videos.push(newVid);
                        }
                    });
                } catch (error) {
                    console.error(`Error fetching ${transType} videos:`, error);
                }
            }

            // If still no videos found, try alternative methods
            if (videos.length === 0) {
                console.log("No videos found in primary method, trying fallback");
                try {
                    const fallbackVideos = await this.tryFallbackSources(
                        ep.showId,
                        ep.episodeString,
                        baseUrl,
                        altHosterSelection
                    );
                    fallbackVideos.forEach(v => videos.push(v));
                } catch (error) {
                    console.error("Fallback method failed:", error);
                }
            }

            return this.sortVideos(videos);
        } catch (error) {
            console.error("Error in getVideoList:", error);
            return [];
        }
    }

    async fetchVideosForType(showId, episodeString, transType, baseUrl, altHosterSelection) {
        const videos = [];
        const scanlator = transType === "sub" ? "sub" : "dub";
        
        try {
            const encodedGql = `?variables=%7B%22showId%22:%22${showId}%22,%22episodeString%22:%22${episodeString}%22,%22translationType%22:%22${transType}%22%7D&query=query($showId:String!,$episodeString:String!,$translationType:VaildTranslationTypeEnumType!){episode(showId:$showId,episodeString:$episodeString,translationType:$translationType){sourceUrls}}`;
            const response = await this.request(encodedGql);
            const videoJson = JSON.parse(response);

            if (!videoJson?.data?.episode?.sourceUrls) {
                console.log(`No sourceUrls found for ${scanlator}`);
                return videos;
            }

            await Promise.all(videoJson.data.episode.sourceUrls.map(async (video) => {
                try {
                    if (!video.sourceUrl) return;
                    
                    const videoUrl = this.decryptSource(video.sourceUrl);
                    if (!videoUrl) return;

                    // Process internal player
                    if (videoUrl.includes("/apivtwo/") && altHosterSelection.includes('player')) {
                        const quality = `internal ${video.sourceName} (${scanlator})`;
                        const vids = await new AllAnimeExtractor({ 
                            "Referer": baseUrl,
                            "Origin": baseUrl
                        }, baseUrl).videoFromUrl(videoUrl, quality);
                        videos.push(...vids);
                    }
                    // Process vidstreaming
                    else if (["vidstreaming", "gogo", "playgo1", "playtaku", "vidcloud"].some(element => videoUrl.includes(element)) && altHosterSelection.includes('vidstreaming')) {
                        const vids = await gogoCdnExtractor(videoUrl);
                        vids.forEach(v => v.quality += ` (${scanlator})`);
                        videos.push(...vids);
                    }
                    // Process doodstream
                    else if (["dood", "d0"].some(element => videoUrl.includes(element)) && altHosterSelection.includes('dood')) {
                        const vids = await doodExtractor(videoUrl);
                        vids.forEach(v => v.quality += ` (${scanlator})`);
                        videos.push(...vids);
                    }
                    // Process okru
                    else if (["ok.ru", "okru"].some(element => videoUrl.includes(element)) && altHosterSelection.includes('okru')) {
                        const vids = await okruExtractor(videoUrl);
                        vids.forEach(v => v.quality += ` (${scanlator})`);
                        videos.push(...vids);
                    }
                    // Process streamlare
                    else if (videoUrl.includes("streamlare.com") && altHosterSelection.includes('streamlare')) {
                        const vids = await streamlareExtractor(videoUrl, 'Streamlare ');
                        vids.forEach(v => v.quality += ` (${scanlator})`);
                        videos.push(...vids);
                    }
                    // Process filemoon
                    else if (["filemoon", "moonplayer"].some(element => videoUrl.includes(element)) && altHosterSelection.includes('filemoon')) {
                        const vids = await filemoonExtractor(videoUrl);
                        vids.forEach(v => v.quality += ` (${scanlator})`);
                        videos.push(...vids);
                    }
                    // Process streamwish
                    else if (videoUrl.includes("wish") && altHosterSelection.includes('streamwish')) {
                        const vids = await streamWishExtractor(videoUrl, 'StreamWish ');
                        vids.forEach(v => v.quality += ` (${scanlator})`);
                        videos.push(...vids);
                    }
                } catch (error) {
                    console.error(`Error processing ${scanlator} video source:`, error);
                }
            }));

        } catch (error) {
            console.error(`Error fetching ${scanlator} videos:`, error);
        }
        
        return videos;
    }

    async tryFallbackSources(showId, episodeString, baseUrl, altHosterSelection) {
        const videos = [];
        console.log("Trying fallback sources");
        
        try {
            // Try alternative API endpoint
            const altUrl = `?variables=%7B%22showId%22:%22${showId}%22,%22episodeString%22:%22${episodeString}%22%7D&query=query($showId:String!,$episodeString:String!){episode(showId:$showId,episodeString:$episodeString){sourceUrls}}`;
            const response = await this.request(altUrl);
            const videoJson = JSON.parse(response);

            if (!videoJson?.data?.episode?.sourceUrls) {
                console.log("No fallback sources found");
                return videos;
            }

            // Process the alternative sources
            await Promise.all(videoJson.data.episode.sourceUrls.map(async (video) => {
                try {
                    if (!video.sourceUrl) return;
                    
                    const videoUrl = this.decryptSource(video.sourceUrl);
                    if (!videoUrl) return;

                    if (videoUrl.includes("/apivtwo/") && altHosterSelection.includes('player')) {
                        const quality = `internal ${video.sourceName} (fallback)`;
                        const vids = await new AllAnimeExtractor({ 
                            "Referer": baseUrl,
                            "Origin": baseUrl
                        }, baseUrl).videoFromUrl(videoUrl, quality);
                        videos.push(...vids);
                    }
                    else if (["vidstreaming"].some(element => videoUrl.includes(element)) && altHosterSelection.includes('vidstreaming')) {
                        const vids = await gogoCdnExtractor(videoUrl);
                        vids.forEach(v => v.quality += " (fallback)");
                        videos.push(...vids);
                    }
                } catch (error) {
                    console.error("Error processing fallback source:", error);
                }
            }));
        } catch (error) {
            console.error("Error in fallback method:", error);
        }
        
        return videos;
    }

    sortVideos(videos) {
        try {
            const preferences = new SharedPreferences();
            const hoster = preferences.get("preferred_hoster1") || "";
            const quality = preferences.get("preferred_quality") || "";
            
            return [...videos].sort((a, b) => {
                const aMatch = a.quality.includes(hoster) && a.quality.includes(quality) ? 1 : 0;
                const bMatch = b.quality.includes(hoster) && b.quality.includes(quality) ? 1 : 0;
                return bMatch - aMatch;
            });
        } catch (error) {
            console.error("Error in sortVideos:", error);
            return videos;
        }
    }

    decryptSource(str) {
        if (!str) return "";
        if (str.startsWith("-")) {
            return str.substring(str.lastIndexOf('-') + 1)
                .match(/.{1,2}/g)
                .map(hex => parseInt(hex, 16))
                .map(byte => String.fromCharCode(byte ^ 56))
                .join("");
        }
        return str;
    }

    getSourcePreferences() {
        return [
            {
                "key": "preferred_title_style",
                "listPreference": {
                    "title": "Preferred Title Style",
                    "summary": "",
                    "valueIndex": 0,
                    "entries": ["Romaji", "English", "Native"],
                    "entryValues": ["romaji", "eng", "native"]
                }
            },
            {
                "key": "preferred_quality",
                "listPreference": {
                    "title": "Preferred quality",
                    "summary": "",
                    "valueIndex": 0,
                    "entries": ["2160p", "1440p", "1080p", "720p", "480p", "360p", "240p", "80p"],
                    "entryValues": ["2160", "1440", "1080", "720", "480", "360", "240", "80"]
                }
            },
            {
                "key": "preferred_sub",
                "listPreference": {
                    "title": "Prefer subs or dubs?",
                    "summary": "",
                    "valueIndex": 0,
                    "entries": ["Subs", "Dubs"],
                    "entryValues": ["sub", "dub"]
                }
            },
            {
                "key": "preferred_hoster1",
                "listPreference": {
                    "title": "Preferred Video Server",
                    "summary": "",
                    "valueIndex": 0,
                    "entries": ["Ac", "Ak", "Kir", "Rab", "Luf-mp4", "Si-Hls", "S-mp4", "Ac-Hls", "Uv-mp4", "Pn-Hls", "vidstreaming", "okru", "streamlare", "doodstream", "filemoon", "streamwish"],
                    "entryValues": ["Ac", "Ak", "Kir", "Rab", "Luf-mp4", "Si-Hls", "S-mp4", "Ac-Hls", "Uv-mp4", "Pn-Hls", "vidstreaming", "okru", "streamlare", "doodstream", "filemoon", "streamwish"]
                }
            },
            {
                "key": "alt_hoster_selection1",
                "multiSelectListPreference": {
                    "title": "Enable/Disable Alternative Hosts",
                    "summary": "",
                    "entries": ["player", "vidstreaming", "okru", "streamlare", "doodstream", "filemoon", "streamwish"],
                    "entryValues": ["player", "vidstreaming", "okru", "streamlare", "doodstream", "filemoon", "streamwish"],
                    "values": ["player", "vidstreaming", "okru", "streamlare", "doodstream", "filemoon", "streamwish"]
                }
            }
        ];
    }
}

class AllAnimeExtractor {
    constructor(headers, baseUrl) {
        this.headers = headers;
        this.baseUrl = baseUrl;
    }

    bytesIntoHumanReadable(bytes) {
        if (!bytes) return "0 b/s";
        const units = ["b/s", "kb/s", "mb/s", "gb/s", "tb/s"];
        let unitIndex = 0;
        while (bytes >= 1000 && unitIndex < units.length - 1) {
            bytes /= 1000;
            unitIndex++;
        }
        return `${Math.floor(bytes)} ${units[unitIndex]}`;
    }

    async videoFromUrl(url, name) {
        const videoList = [];
        
        try {
            const endPointResponse = JSON.parse((await new Client().get(`${this.baseUrl}/getVersion`, this.headers)).body);
            const endPoint = endPointResponse?.episodeIframeHead;
            if (!endPoint) return [];

            const resp = await new Client().get(endPoint + url.replace("/clock?", "/clock.json?"), this.headers);
            if (resp.statusCode !== 200) return [];

            const linkJson = JSON.parse(resp.body);
            if (!linkJson?.links) return [];

            await Promise.all(linkJson.links.map(async (link) => {
                try {
                    const subtitles = (link.subtitles || []).map(sub => ({
                        file: sub.src,
                        label: `${sub.lang}${sub.label ? ` - ${sub.label}` : ''}`
                    }));

                    if (link.mp4) {
                        videoList.push({
                            url: link.link,
                            quality: `Original (${name} - ${link.resolutionStr})`,
                            originalUrl: link.link,
                            subtitles
                        });
                    } 
                    else if (link.hls) {
                        await this.processHlsSource(link, name, endPoint, videoList, subtitles);
                    }
                    else if (link.crIframe && link.portData?.streams) {
                        await this.processCrIframe(link, videoList, subtitles);
                    }
                    else if (link.dash && link.rawUrls) {
                        this.processDashSource(link, name, videoList, subtitles);
                    }
                } catch (error) {
                    console.error("Error processing video link:", error);
                }
            }));
        } catch (error) {
            console.error("Error in videoFromUrl:", error);
        }
        
        return videoList;
    }

    async processHlsSource(link, name, endPoint, videoList, subtitles) {
        try {
            const headers = {
                'Host': link.link.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/)[1],
                'Origin': endPoint,
                'Referer': `${endPoint}/`
            };
            
            const resp = await new Client().get(link.link, headers);
            if (resp.statusCode !== 200) return;

            const masterPlaylist = resp.body;
            const audios = [];
            
            if (masterPlaylist.includes('#EXT-X-MEDIA:TYPE=AUDIO')) {
                const audioInfo = masterPlaylist.substringAfter('#EXT-X-MEDIA:TYPE=AUDIO').substringBefore('\n');
                const language = audioInfo.substringAfter('NAME="').substringBefore('"');
                const url = audioInfo.substringAfter('URI="').substringBefore('"');
                audios.push({ file: url, label: language });
            }

            if (!masterPlaylist.includes('#EXT-X-STREAM-INF:')) {
                videoList.push({
                    url: link.link,
                    quality: `${name} - ${link.resolutionStr}`,
                    originalUrl: link.link,
                    subtitles,
                    ...(audios.length ? { audios } : {}),
                    headers
                });
                return;
            }

            masterPlaylist.substringAfter('#EXT-X-STREAM-INF:').split('#EXT-X-STREAM-INF:').forEach(it => {
                const bandwidth = it.includes('AVERAGE-BANDWIDTH') ? 
                    ` ${this.bytesIntoHumanReadable(it.substringAfter('AVERAGE-BANDWIDTH=').substringBefore(','))}` : '';
                
                const quality = `${it.substringAfter('RESOLUTION=').substringAfter('x').substringBefore(',')}p${bandwidth} (${name} - ${link.resolutionStr})`;
                let videoUrl = it.substringAfter('\n').substringBefore('\n');

                if (!videoUrl.startsWith('http')) {
                    videoUrl = resp.request.url.substringBeforeLast('/') + `/${videoUrl}`;
                }
                
                videoList.push({
                    url: videoUrl,
                    quality,
                    originalUrl: videoUrl,
                    subtitles,
                    ...(audios.length ? { audios } : {}),
                    headers
                });
            });
        } catch (error) {
            console.error("Error processing HLS source:", error);
        }
    }

    async processCrIframe(link, videoList, subtitles) {
        try {
            await Promise.all(link.portData.streams.map(async (stream) => {
                if (stream.format === 'adaptive_dash') {
                    videoList.push({
                        url: stream.url,
                        quality: `Original (AC - Dash${stream.hardsub_lang?.length ? ` - Hardsub: ${stream.hardsub_lang}` : ''})`,
                        originalUrl: stream.url,
                        subtitles
                    });
                } 
                else if (stream.format === 'adaptive_hls') {
                    const resp = await new Client().get(stream.url, { 
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:101.0) Gecko/20100101 Firefox/101.0' 
                    });
                    
                    if (resp.statusCode === 200) {
                        resp.body.substringAfter('#EXT-X-STREAM-INF:').split('#EXT-X-STREAM-INF:').forEach(t => {
                            videoList.push({
                                url: t.substringAfter('\n').substringBefore('\n'),
                                quality: `${t.substringAfter('RESOLUTION=').substringAfter('x').substringBefore(',')}p (AC - HLS${stream.hardsub_lang?.length ? ` - Hardsub: ${stream.hardsub_lang}` : ''})`,
                                originalUrl: t.substringAfter('\n').substringBefore('\n'),
                                subtitles
                            });
                        });
                    }
                }
            }));
        } catch (error) {
            console.error("Error processing CR iframe:", error);
        }
    }

    processDashSource(link, name, videoList, subtitles) {
        try {
            const audios = (link.rawUrls.audios || []).map(it => ({
                file: it.url,
                label: this.bytesIntoHumanReadable(it.bandwidth)
            }));

            (link.rawUrls.vids || []).forEach(it => {
                videoList.push({
                    url: it.url,
                    quality: `${name} - ${it.height} ${this.bytesIntoHumanReadable(it.bandwidth)}`,
                    originalUrl: it.url,
                    ...(audios.length ? { audios } : {}),
                    subtitles
                });
            });
        } catch (error) {
            console.error("Error processing DASH source:", error);
        }
    }
}
