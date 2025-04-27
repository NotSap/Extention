const mangayomiSources = [{
    "name": "AllAnime",
    "lang": "en",
    "baseUrl": "https://allanime.to",
    "apiUrl": "https://api.allanime.day/api",
    "iconUrl": "https://raw.githubusercontent.com/kodjodevf/mangayomi-extensions/main/javascript/icon/en.allanime.png",
    "typeSource": "single",
    "itemType": 1,
    "isNsfw": false,
    "version": "0.0.35",
    "dateFormat": "",
    "dateFormatLocale": "",
    "pkgPath": "anime/src/en/allanime.js"
}];

class DefaultExtension extends MProvider {
    async request(body) {
        const apiUrl = this.source.apiUrl;
        const baseUrl = this.source.baseUrl;
        
        try {
            const response = await new Client().get(apiUrl + body, { "Referer": baseUrl });
            
            if (!response.body) {
                throw new Error("Empty response body");
            }
            
            return response.body;
        } catch (error) {
            console.error("Request failed:", error);
            throw error;
        }
    }

    async getPopular(page) {
        try {
            const encodedGql = `?variables=%0A%20%20%20%20%20%20%20%20%7B%0A%20%20%20%20%20%20%20%20%20%20%22type%22:%20%22anime%22,%0A%20%20%20%20%20%20%20%20%20%20%22size%22:%2026,%0A%20%20%20%20%20%20%20%20%20%20%22dateRange%22:%201,%0A%20%20%20%20%20%20%20%20%20%20%22page%22:%20${page}%0A%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20&query=%0A%20%20%20%20%20%20%20%20query($type:%20VaildPopularTypeEnumType!,%20$size:%20Int!,%20$dateRange:%20Int,%20$page:%20Int)%20%7B%0A%20%20%20%20%20%20%20%20%20%20queryPopular(type:%20$type,%20size:%20$size,%20dateRange:%20$dateRange,%20page:%20$page)%20%7B%0A%20%20%20%20%20%20%20%20%20%20%20%20recommendations%20%7B%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20anyCard%20%7B%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20_id%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20name%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20englishName%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20nativeName%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20thumbnail%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20slugTime%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20`
            const response = await this.request(encodedGql);
            const jsonResponse = JSON.parse(response);
            
            if (!jsonResponse?.data?.queryPopular?.recommendations) {
                return { list: [], hasNextPage: false };
            }
            
            const resList = jsonResponse.data.queryPopular.recommendations.filter(e => e.anyCard !== null);
            const preferences = new SharedPreferences();
            const titleStyle = preferences.get("preferred_title_style") || "romaji";
            const list = [];
            
            for (const anime of resList) {
                let title;
                if (titleStyle === "romaji") {
                    title = anime.anyCard.name;
                } else if (titleStyle === "eng") {
                    title = anime.anyCard.englishName || anime.anyCard.name;
                } else {
                    title = anime.anyCard.nativeName || anime.anyCard.name;
                }
                
                const name = title;
                const imageUrl = anime.anyCard.thumbnail;
                const link = `/bangumi/${anime.anyCard._id}/${anime.anyCard.name.replace(/[^a-zA-Z0-9]/g, "-")
                    .replace(/-{2,}/g, "-")
                    .toLowerCase()}`;
                list.push({ name, imageUrl, link });
            }

            return {
                list: list,
                hasNextPage: list.length === 26
            };
        } catch (error) {
            console.error("Error in getPopular:", error);
            return { list: [], hasNextPage: false };
        }
    }

    async getLatestUpdates(page) {
        try {
            return await this.search("", page, []);
        } catch (error) {
            console.error("Error in getLatestUpdates:", error);
            return { list: [], hasNextPage: false };
        }
    }

    async search(query, page, filters) {
        try {
            query = query.replace(" ", "%20");
            const encodedGql = `?variables=%0A%20%20%20%20%20%20%20%20%7B%0A%20%20%20%20%20%20%20%20%20%20%22search%22:%20%7B%0A%20%20%20%20%20%20%20%20%20%20%20%20%22query%22:%20%22${query}%22,%0A%20%20%20%20%20%20%20%20%20%20%20%20%22allowAdult%22:%20false,%0A%20%20%20%20%20%20%20%20%20%20%20%20%22allowUnknown%22:%20false%0A%20%20%20%20%20%20%20%20%20%20%7D,%0A%20%20%20%20%20%20%20%20%20%20%22countryOrigin%22:%20%22ALL%22,%0A%20%20%20%20%20%20%20%20%20%20%22limit%22:%2026,%0A%20%20%20%20%20%20%20%20%20%20%22page%22:%20${page}%0A%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20&query=%0A%20%20%20%20%20%20%20%20query($search:%20SearchInput,%20$limit:%20Int,%20$countryOrigin:%20VaildCountryOriginEnumType,%20$page:%20Int)%20%7B%0A%20%20%20%20%20%20%20%20%20%20shows(search:%20$search,%20limit:%20$limit,%20countryOrigin:%20$countryOrigin,%20page:%20$page)%20%7B%0A%20%20%20%20%20%20%20%20%20%20%20%20edges%20%7B%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20_id%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20name%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20nativeName%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20englishName%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20thumbnail%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20slugTime%0A%20%20%20%20%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20`;
            const response = await this.request(encodedGql);
            const jsonResponse = JSON.parse(response);
            
            if (!jsonResponse?.data?.shows?.edges) {
                return { list: [], hasNextPage: false };
            }
            
            const resList = jsonResponse.data.shows.edges;
            const preferences = new SharedPreferences();
            const titleStyle = preferences.get("preferred_title_style") || "romaji";
            const list = [];
            
            for (const anime of resList) {
                let title;
                if (titleStyle === "romaji") {
                    title = anime.name;
                } else if (titleStyle === "eng") {
                    title = anime.englishName || anime.name;
                } else {
                    title = anime.nativeName || anime.name;
                }
                
                const name = title;
                const imageUrl = anime.thumbnail;
                const link = `/bangumi/${anime._id}/${anime.name.replace(/[^a-zA-Z0-9]/g, "-")
                    .replace(/-{2,}/g, "-")
                    .toLowerCase()}`;
                list.push({ name, imageUrl, link });
            }

            return {
                list: list,
                hasNextPage: list.length === 26
            };
        } catch (error) {
            console.error("Error in search:", error);
            return { list: [], hasNextPage: false };
        }
    }

    async getDetail(url) {
        try {
            const id = url.substringAfter('bangumi/').substringBefore('/');
            const encodedGql = `?variables=%0A%20%20%20%20%20%20%20%20%7B%0A%20%20%20%20%20%20%20%20%20%20%22id%22:%20%22${id}%22%0A%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20&query=%0A%20%20%20%20%20%20%20%20query($id:%20String!)%20%7B%0A%20%20%20%20%20%20%20%20%20%20show(_id:%20$id)%20%7B%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20thumbnail%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20description%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20type%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20season%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20score%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20genres%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20status%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20studios%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20availableEpisodesDetail%0A%20%20%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20`;
            const response = await this.request(encodedGql);
            const show = JSON.parse(response).data.show;
            
            if (!show) {
                return {
                    description: "Error loading details",
                    author: "",
                    status: 5,
                    genre: [],
                    episodes: []
                };
            }
            
            const genre = show.genres || [];
            const status = this.parseStatus(show.status);
            const author = show.studios?.length > 0 ? show.studios[0] : "";
            let description = show.description || "";
            
            description = description.concat(
                "\n\n", 
                `Type: ${show.type || "Unknown"}`, 
                `\nAired: ${show.season?.quarter || "-"} ${show.season?.year || "-"}`, 
                `\nScore: ${show.score || "-"}★`
            );
            
            let episodesSub = [];
            if (show.availableEpisodesDetail?.sub) {
                for (const episode of show.availableEpisodesDetail.sub) {
                    const num = parseInt(episode) || 1;
                    const name = `Episode ${num}`;
                    const url = JSON.stringify({
                        showId: id,
                        translationType: ["sub"],
                        episodeString: episode
                    });
                    const scanlator = "sub";
                    episodesSub.push({ num, name, url, scanlator });
                }
            }
            
            let episodesDub = [];
            if (show.availableEpisodesDetail?.dub) {
                for (const episode of show.availableEpisodesDetail.dub) {
                    const num = parseInt(episode) || 1;
                    const name = `Episode ${num}`;
                    const url = JSON.stringify({
                        showId: id,
                        translationType: ["dub"],
                        episodeString: episode
                    });
                    const scanlator = "dub";
                    episodesDub.push({ num, name, url, scanlator });
                }
            }
            
            let episodes = [];
            if (episodesSub.length > 0) {
                episodes = episodesSub.map(ep => {
                    const f = episodesDub.filter(e => e.num === ep.num);
                    if (f.length > 0) {
                        const url = JSON.parse(ep.url);
                        return {
                            "name": ep.name, 
                            "url": JSON.stringify({
                                showId: url.showId,
                                translationType: ['sub', 'dub'],
                                episodeString: url.episodeString
                            }), 
                            scanlator: `sub, dub`
                        };
                    } else {
                        return ep;
                    }
                });
            } else {
                episodes = episodesDub;
            }
            
            return {
                description, 
                author, 
                status, 
                genre, 
                episodes
            };
        } catch (error) {
            console.error("Error in getDetail:", error);
            return {
                description: "Error loading details",
                author: "",
                status: 5,
                genre: [],
                episodes: []
            };
        }
    }

    parseStatus(string) {
        if (!string) return 5;
        
        switch (string) {
            case "Releasing":
                return 0;
            case "Finished":
                return 1;
            case "Not Yet Released":
                return 0;
            default:
                return 5;
        }
    }

async getVideoList(url) {
    try {
        const baseUrl = this.source.baseUrl;
        const preferences = new SharedPreferences();
        const subPref = preferences.get("preferred_sub") || "sub";
        const ep = JSON.parse(url);
        
        // Debugging: Log the episode info we're working with
        console.log("Processing episode:", {
            showId: ep.showId,
            episodeString: ep.episodeString,
            translationTypes: ep.translationType
        });

        // Get all available translation types
        const allTranslationTypes = Array.isArray(ep.translationType) ? 
            [...new Set(ep.translationType)] : 
            (ep.translationType ? [ep.translationType] : ["sub"]);

        // Debugging: Log available types
        console.log("Available translation types:", allTranslationTypes);

        const videos = [];
        const altHosterSelection = preferences.get('alt_hoster_selection1') || [];
        
        // Debugging: Log hoster selection
        console.log("Enabled hosters:", altHosterSelection);

        // 1. First try preferred type
        if (allTranslationTypes.includes(subPref)) {
            console.log(`Trying preferred type: ${subPref}`);
            const preferredVideos = await this.fetchVideosForType(
                ep.showId,
                ep.episodeString,
                subPref,
                baseUrl,
                altHosterSelection
            );
            videos.push(...preferredVideos);
            console.log(`Found ${preferredVideos.length} videos for preferred type`);
        }

        // 2. If no videos found, try all other available types
        if (videos.length === 0) {
            console.log("No preferred videos found, trying all types");
            for (const transType of allTranslationTypes) {
                if (transType === subPref) continue;
                
                console.log(`Trying type: ${transType}`);
                const typeVideos = await this.fetchVideosForType(
                    ep.showId,
                    ep.episodeString,
                    transType,
                    baseUrl,
                    altHosterSelection
                );
                videos.push(...typeVideos);
                console.log(`Found ${typeVideos.length} videos for ${transType}`);
            }
        }

        // 3. Final fallback to sub if still no videos
        if (videos.length === 0 && !allTranslationTypes.includes("sub")) {
            console.log("No videos found, trying fallback to sub");
            const defaultVideos = await this.fetchVideosForType(
                ep.showId,
                ep.episodeString,
                "sub",
                baseUrl,
                altHosterSelection
            );
            videos.push(...defaultVideos);
            console.log(`Found ${defaultVideos.length} fallback videos`);
        }

        console.log(`Total videos found: ${videos.length}`);
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
        const encodedGql = `?variables=%0A%20%20%20%20%20%20%20%20%7B%0A%20%20%20%20%20%20%20%20%20%20%22showId%22:%20%22${showId}%22,%0A%20%20%20%20%20%20%20%20%20%20%22episodeString%22:%20%22${episodeString}%22,%0A%20%20%20%20%20%20%20%20%20%20%22translationType%22:%20%22${transType}%22%0A%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20&query=%0A%20%20%20%20%20%20%20%20query(%0A%20%20%20%20%20%20%20%20%20%20$showId:%20String!%0A%20%20%20%20%20%20%20%20%20%20$episodeString:%20String!%0A%20%20%20%20%20%20%20%20%20%20$translationType:%20VaildTranslationTypeEnumType!%0A%20%20%20%20%20%20%20%20)%20%7B%0A%20%20%20%20%20%20%20%20%20%20episode(%0A%20%20%20%20%20%20%20%20%20%20%20%20showId:%20$showId%0A%20%20%20%20%20%20%20%20%20%20%20%20episodeString:%20$episodeString%0A%20%20%20%20%20%20%20%20%20%20%20%20translationType:%20$translationType%0A%20%20%20%20%20%20%20%20%20%20)%20%7B%0A%20%20%20%20%20%20%20%20%20%20%20%20sourceUrls%0A%20%20%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20`;
        
        console.log(`Fetching videos for ${scanlator} with query:`, encodedGql);
        const response = await this.request(encodedGql);
        console.log(`API response for ${scanlator}:`, response);

        const videoJson = JSON.parse(response);
        console.log(`Parsed JSON for ${scanlator}:`, videoJson);

        if (!videoJson?.data?.episode?.sourceUrls) {
            console.log(`No sourceUrls found for ${scanlator}`);
            return videos;
        }

        console.log(`Found ${videoJson.data.episode.sourceUrls.length} sources for ${scanlator}`);
        
        for (const video of videoJson.data.episode.sourceUrls) {
            try {
                if (!video.sourceUrl) {
                    console.log("Skipping empty sourceUrl");
                    continue;
                }

                console.log(`Processing source: ${video.sourceUrl.substring(0, 50)}...`);
                const videoUrl = this.decryptSource(video.sourceUrl);
                console.log(`Decrypted URL: ${videoUrl.substring(0, 50)}...`);

                if (!videoUrl) {
                    console.log("Skipping empty decrypted URL");
                    continue;
                }

                // Process internal player
                if (videoUrl.includes("/apivtwo/") && altHosterSelection.includes('player')) {
                    console.log("Processing internal player source");
                    const quality = `internal ${video.sourceName} (${scanlator})`;
                    const vids = await new AllAnimeExtractor({ "Referer": baseUrl }, "https://allanime.to").videoFromUrl(videoUrl, quality);
                    console.log(`Found ${vids.length} internal player videos`);
                    videos.push(...vids);
                }
                // Add other hoster processing here...

            } catch (error) {
                console.error(`Error processing ${scanlator} video source:`, error);
            }
        }
    } catch (error) {
        console.error(`Error fetching ${scanlator} videos:`, error);
    }
    
    console.log(`Returning ${videos.length} videos for ${scanlator}`);
    return videos;
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
                    "entries": [
                        "2160p",
                        "1440p",
                        "1080p",
                        "720p",
                        "480p",
                        "360p",
                        "240p",
                        "80p"],
                    "entryValues": [
                        "2160",
                        "1440",
                        "1080",
                        "720",
                        "480",
                        "360",
                        "240",
                        "80"]
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
                    "entries": [
                        "Ac", "Ak", "Kir", "Rab", "Luf-mp4",
                        "Si-Hls", "S-mp4", "Ac-Hls", "Uv-mp4", "Pn-Hls",
                        "vidstreaming", "okru", "mp4upload", "streamlare", "doodstream",
                        "filemoon",
                        "streamwish"
                    ],
                    "entryValues": [
                        "Ac", "Ak", "Kir", "Rab", "Luf-mp4",
                        "Si-Hls", "S-mp4", "Ac-Hls", "Uv-mp4", "Pn-Hls",
                        "vidstreaming", "okru", "mp4upload", "streamlare", "doodstream",
                        "filemoon",
                        "streamwish"
                    ]
                }
            },
            {
                "key": "alt_hoster_selection1",
                "multiSelectListPreference": {
                    "title": "Enable/Disable Alternative Hosts",
                    "summary": "",
                    "entries": [
                        "player",
                        "vidstreaming",
                        "okru",
                        "mp4upload",
                        "streamlare",
                        "doodstream",
                        "filemoon",
                        "streamwish"
                    ],
                    "entryValues": [
                        "player",
                        "vidstreaming",
                        "okru",
                        "mp4upload",
                        "streamlare",
                        "doodstream",
                        "filemoon",
                        "streamwish"
                    ],
                    "values": [
                        "player",
                        "vidstreaming",
                        "okru",
                        "mp4upload",
                        "streamlare",
                        "doodstream",
                        "filemoon",
                        "streamwish"
                    ]
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
        
        const kilobyte = 1000;
        const megabyte = kilobyte * 1000;
        const gigabyte = megabyte * 1000;
        const terabyte = gigabyte * 1000;

        if (bytes >= 0 && bytes < kilobyte) {
            return `${bytes} b/s`;
        } else if (bytes >= kilobyte && bytes < megabyte) {
            return `${Math.floor(bytes / kilobyte)} kb/s`;
        } else if (bytes >= megabyte && bytes < gigabyte) {
            return `${Math.floor(bytes / megabyte)} mb/s`;
        } else if (bytes >= gigabyte && bytes < terabyte) {
            return `${Math.floor(bytes / gigabyte)} gb/s`;
        } else if (bytes >= terabyte) {
            return `${Math.floor(bytes / terabyte)} tb/s`;
        } else {
            return `${bytes} bits/s`;
        }
    }

    async videoFromUrl(url, name) {
        const videoList = [];
        
        try {
            const endPointResponse = JSON.parse((await new Client().get(`${this.baseUrl}/getVersion`, this.headers)).body);
            
            if (!endPointResponse?.episodeIframeHead) {
                return [];
            }
            
            const endPoint = endPointResponse.episodeIframeHead;
            const resp = await new Client().get(endPoint + url.replace("/clock?", "/clock.json?"), this.headers);

            if (resp.statusCode !== 200) {
                return [];
            }
            
            const linkJson = JSON.parse(resp.body);
            
            if (!linkJson?.links) {
                return [];
            }
            
            for (const link of linkJson.links) {
                try {
                    const subtitles = [];
                    if (link.subtitles && link.subtitles.length > 0) {
                        subtitles.push(...link.subtitles.map(sub => {
                            const label = sub.label ? ` - ${sub.label}` : '';
                            return { file: sub.src, label: `${sub.lang}${label}` };
                        }));
                    }
                    
                    if (link.mp4) {
                        videoList.push({
                            url: link.link,
                            quality: `Original (${name} - ${link.resolutionStr})`,
                            originalUrl: link.link,
                            subtitles,
                        });
                    } 
                    else if (link.hls) {
                        const headers = {
                            'Host': link.link.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/)[1],
                            'Origin': endPoint,
                            'Referer': `${endPoint}/`
                        };
                        
                        const resp = await new Client().get(link.link, headers);

                        if (resp.statusCode === 200) {
                            const masterPlaylist = resp.body;
                            const audios = [];
                            
                            if (masterPlaylist.includes('#EXT-X-MEDIA:TYPE=AUDIO')) {
                                const audioInfo = masterPlaylist.substringAfter('#EXT-X-MEDIA:TYPE=AUDIO').substringBefore('\n');
                                const language = audioInfo.substringAfter('NAME="').substringBefore('"');
                                const url = audioInfo.substringAfter('URI="').substringBefore('"');
                                audios.push({ file: url, label: language });
                            }
                            
                            if (!masterPlaylist.includes('#EXT-X-STREAM-INF:')) {
                                if (audios.length === 0) {
                                    videoList.push({ 
                                        url: link.link, 
                                        quality: `${name} - ${link.resolutionStr}`, 
                                        originalUrl: link.link, 
                                        subtitles, 
                                        headers 
                                    });
                                } else {
                                    videoList.push({ 
                                        url: link.link, 
                                        quality: `${name} - ${link.resolutionStr}`, 
                                        originalUrl: link.link, 
                                        subtitles, 
                                        audios, 
                                        headers 
                                    });
                                }
                            } else {
                                masterPlaylist.substringAfter('#EXT-X-STREAM-INF:').split('#EXT-X-STREAM-INF:').forEach(it => {
                                    let bandwidth = '';
                                    if (it.includes('AVERAGE-BANDWIDTH')) {
                                        bandwidth = ` ${this.bytesIntoHumanReadable(it.substringAfter('AVERAGE-BANDWIDTH=').substringBefore(','))}`;
                                    }
                                    
                                    const quality = `${it.substringAfter('RESOLUTION=').substringAfter('x').substringBefore(',')}p${bandwidth} (${name} - ${link.resolutionStr})`;
                                    let videoUrl = it.substringAfter('\n').substringBefore('\n');

                                    if (!videoUrl.startsWith('http')) {
                                        videoUrl = resp.request.url.substringBeforeLast('/') + `/${videoUrl}`;
                                    }
                                    
                                    const headers = {
                                        'Host': videoUrl.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/)[1],
                                        'Origin': endPoint,
                                        'Referer': `${endPoint}/`
                                    };
                                    
                                    if (audios.length === 0) {
                                        videoList.push({ 
                                            url: videoUrl, 
                                            quality, 
                                            originalUrl: videoUrl, 
                                            subtitles, 
                                            headers 
                                        });
                                    } else {
                                        videoList.push({ 
                                            url: videoUrl, 
                                            quality, 
                                            originalUrl: videoUrl, 
                                            subtitles, 
                                            audios, 
                                            headers 
                                        });
                                    }
                                });
                            }
                        }
                    } 
                    else if (link.crIframe) {
                        if (link.portData?.streams) {
                            for (const stream of link.portData.streams) {
                                if (stream.format === 'adaptive_dash') {
                                    videoList.push({
                                        url: stream.url,
                                        quality: `Original (AC - Dash${stream.hardsub_lang?.length === 0 ? '' : ` - Hardsub: ${stream.hardsub_lang}`})`,
                                        originalUrl: stream.url,
                                        subtitles,
                                    });
                                } else if (stream.format === 'adaptive_hls') {
                                    const resp = await new Client().get(stream.url, { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:101.0) Gecko/20100101 Firefox/101.0' });
                                    
                                    if (resp.statusCode === 200) {
                                        const masterPlaylist = resp.body;
                                        masterPlaylist.substringAfter('#EXT-X-STREAM-INF:').split('#EXT-X-STREAM-INF:').forEach(t => {
                                            const quality = `${t.substringAfter('RESOLUTION=').substringAfter('x').substringBefore(',')}p (AC - HLS${stream.hardsub_lang?.length === 0 ? '' : ` - Hardsub: ${stream.hardsub_lang}`})`;
                                            const videoUrl = t.substringAfter('\n').substringBefore('\n');
                                            videoList.push({ 
                                                url: videoUrl, 
                                                quality, 
                                                originalUrl: videoUrl, 
                                                subtitles 
                                            });
                                        });
                                    }
                                }
                            }
                        }
                    } 
                    else if (link.dash) {
                        const audios = link.rawUrls?.audios ? link.rawUrls.audios.map(it => { 
                            return { 
                                file: it.url, 
                                label: this.bytesIntoHumanReadable(it.bandwidth) 
                            }; 
                        }) : [];
                        
                        const videos = link.rawUrls?.vids ? link.rawUrls.vids.map(it => {
                            if (!audios) {
                                return { 
                                    url: it.url, 
                                    quality: `${name} - ${it.height} ${this.bytesIntoHumanReadable(it.bandwidth)}`, 
                                    originalUrl: it.url, 
                                    subtitles 
                                };
                            } else {
                                return { 
                                    url: it.url, 
                                    quality: `${name} - ${it.height} ${this.bytesIntoHumanReadable(it.bandwidth)}`, 
                                    originalUrl: it.url, 
                                    audios, 
                                    subtitles 
                                };
                            }
                        }) : [];

                        if (videos.length > 0) {
                            videoList.push(...videos);
                        }
                    }
                } catch (error) {
                    console.error("Error processing video link:", error);
                }
            }
        } catch (error) {
            console.error("Error in videoFromUrl:", error);
        }
        
        return videoList;
    }
}
