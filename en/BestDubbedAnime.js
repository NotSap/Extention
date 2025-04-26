const baseUrl = "https://bestdubbedanime.com";

async function search(context, query) {
    const url = `${baseUrl}/xz/searchgrid.php?p=1&limit=12&s=${encodeURIComponent(query)}&_=${Date.now()}`;
    let res = await fetch(url);
    if (!res.ok) return [];
    let text = await res.text();
    let results = [];
    const regex = /<a href="([^"]+)"[^>]*>(?:[\s\S]*?)<img[^>]*src="([^"]+)"[^>]*>(?:[\s\S]*?)<div class="gridtitlek">([^<]+)<\/div>/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        let href = match[1];
        let image = match[2];
        let title = match[3];
        // Make URLs absolute if needed
        if (!href.startsWith("http")) {
            href = baseUrl + href;
        }
        if (!image.startsWith("http")) {
            image = baseUrl + image;
        }
        results.push({ title: title.trim(), url: href, image: image });
    }
    return results;
}

async function fetchAnimeInfo(context, animeUrl) {
    let res = await fetch(animeUrl);
    if (!res.ok) return null;
    let text = await res.text();
    let info = {};
    // Title
    let titleMatch = text.match(/<h4[^>]*>([^<]+)<\/h4>/);
    if (titleMatch) {
        info.title = titleMatch[1].trim();
    }
    // Description
    let descMatch = text.match(/<div class="animeDescript">[\s\S]*?<p>([\s\S]*?)<\/p>/);
    if (descMatch) {
        info.description = descMatch[1].trim();
    }
    // Year (e.g. Released: 2021)
    let yearMatch = text.match(/Released:\s*([0-9]{4})/);
    if (yearMatch) {
        info.year = parseInt(yearMatch[1]);
    }
    // Cover image
    let imgMatch = text.match(/<div class="fkimgs">[\s\S]*?<img[^>]*src="([^"]+)"/);
    if (imgMatch) {
        let img = imgMatch[1];
        if (!img.startsWith("http")) {
            img = baseUrl + img;
        }
        info.image = img;
    }
    return info;
}

async function fetchEpisodes(context, animeUrl) {
    let res = await fetch(animeUrl);
    if (!res.ok) return [];
    let text = await res.text();
    let episodes = [];
    // Match episode links
    const epRegex = /<a[^>]*class="epibloks"[^>]*href="([^"]+)"[^>]*>(?:[\s\S]*?<span class="isgrxx">([^<]+)<\/span>)?/g;
    let match;
    while ((match = epRegex.exec(text)) !== null) {
        let epUrl = match[1];
        let epTitle = match[2] || null;
        if (!epUrl.startsWith("http")) {
            epUrl = baseUrl + epUrl;
        }
        episodes.push({ title: epTitle, url: epUrl });
    }
    return episodes;
}

async function loadEpisodeSources(context, episodeUrl) {
    // Determine slug from episodeUrl (path after baseUrl)
    let slug;
    try {
        let u = new URL(episodeUrl);
        slug = u.pathname.substring(1); // remove leading '/'
    } catch (e) {
        slug = episodeUrl.replace(baseUrl + "/", "");
    }
    const apiUrl = `${baseUrl}/xz/v3/jsonEpi.php?slug=${encodeURIComponent(slug)}`;
    let res = await fetch(apiUrl);
    if (!res.ok) return [];
    let data = await res.json();
    if (!data || !data.result || !data.result.anime || data.result.anime.length === 0) {
        return [];
    }
    let serversHTML = data.result.anime[0].serversHTML;
    // Remove backslashes if any
    serversHTML = serversHTML.replace(/\\+/g, "");
    let sources = [];
    // Find all hl="..." occurrences
    const hlRegex = /hl="([^"]+)"/g;
    let hls = [];
    let hlMatch;
    while ((hlMatch = hlRegex.exec(serversHTML)) !== null) {
        hls.push(hlMatch[1]);
    }
    for (let hl of hls) {
        try {
            const playerRes = await fetch(`${baseUrl}/xz/api/playeri.php?url=${encodeURIComponent(hl)}`);
            if (!playerRes.ok) continue;
            let playerText = await playerRes.text();
            let linkMatch = playerText.match(/src="([^"]+)"[^>]*label="([^"]+)"/);
            if (linkMatch) {
                let fileUrl = linkMatch[1];
                let qualityLabel = linkMatch[2];
                // Ensure quality label ends with 'p'
                if (!qualityLabel.endsWith("p")) {
                    qualityLabel = qualityLabel + "p";
                }
                let quality = parseInt(qualityLabel);
                sources.push({
                    url: fileUrl,
                    quality: quality,
                    isM3U8: fileUrl.includes(".m3u8")
                });
            }
        } catch (e) {
            // Ignore errors and continue
        }
    }
    return sources;
}

export default {
    name: "BestDubbedAnime",
    search,
    fetchAnimeInfo,
    fetchEpisodes,
    loadEpisodeSources
};
