globalThis.extension = {
    // Extension metadata
    name: "BestDubbedAnime",
    version: "1.0.0",
    // Set type to anime and language to English
    type: "anime",
    language: "en",
    // Base URL for the site
    baseUrl: "https://bestdubbedanime.com",
    // Fetch popular (A–Z) list of anime series
    fetchPopular: async function(page = 1) {
        if (page > 1) {
            // No pagination on A–Z list
            return { list: [], hasNextPage: false };
        }
        let url = `${this.baseUrl}/`;  // Change to the actual series list page if needed
        let res = await fetch(url);
        let html = await res.text();
        let doc = new DOMParser().parseFromString(html, 'text/html');
        let anchors = Array.from(doc.querySelectorAll("a"));
        let seriesMap = new Map();
        anchors.forEach(a => {
            let href = a.href;
            // Only include links within the site
            if (!href || !href.startsWith(this.baseUrl)) return;
            // Skip obvious navigation links by short text
            let title = a.textContent.trim();
            if (!title || title.length < 3) {
                let img = a.querySelector('img');
                if (img && img.alt) {
                    title = img.alt.trim();
                }
            }
            if (!title || title.length < 3) return;
            // Avoid duplicates
            if (seriesMap.has(href)) return;
            // Get cover image if present
            let img = a.querySelector('img');
            let coverUrl = img ? img.src : "";
            seriesMap.set(href, { name: title, url: href, link: coverUrl });
        });
        let list = Array.from(seriesMap.values());
        return { list: list, hasNextPage: false };
    },
    // Search by filtering the full series list locally
    search: async function(page = 1, query = "") {
        // Load all series (same as fetchPopular) then filter
        let popular = await this.fetchPopular(1);
        query = query.toLowerCase();
        let filtered = popular.list.filter(item => item.name.toLowerCase().includes(query));
        return { list: filtered, hasNextPage: false };
    },
    // Fetch anime detail (description, cover, etc.)
    fetchAnimeInfo: async function(anime) {
        let res = await fetch(anime.url);
        let html = await res.text();
        let doc = new DOMParser().parseFromString(html, 'text/html');
        // Extract description (replace selector with actual site selector)
        let descElem = doc.querySelector(".description") || doc.querySelector("meta[name='description']");
        let description = descElem ? (descElem.textContent || descElem.getAttribute('content')).trim() : "";
        // Extract cover image
        let coverImg = doc.querySelector(".anime-cover img") || doc.querySelector("meta[property='og:image']");
        let cover = coverImg ? (coverImg.src || coverImg.getAttribute('content')) : "";
        // Extract genre/tags if any
        let genreElems = doc.querySelectorAll(".genres a");
        let genres = Array.from(genreElems, g => g.textContent.trim());
        return {
            title: anime.name,
            description: description,
            cover: cover,
            genre: genres
        };
    },
    // Fetch episodes for the given anime
    fetchEpisodes: async function(anime) {
        let res = await fetch(anime.url);
        let html = await res.text();
        let doc = new DOMParser().parseFromString(html, 'text/html');
        // Extract episodes list (replace selector with actual site structure)
        let episodeElems = doc.querySelectorAll(".episode-list a");
        let episodes = [];
        episodeElems.forEach(ep => {
            let epUrl = ep.href;
            let epName = ep.textContent.trim();
            if (epUrl && epName) {
                episodes.push({ name: epName, url: epUrl });
            }
        });
        return episodes;
    },
    // Load video sources for an episode
    loadEpisodeSources: async function(episode) {
        let res = await fetch(episode.url);
        let html = await res.text();
        let doc = new DOMParser().parseFromString(html, 'text/html');
        // Look for an iframe or video source
        let sources = [];
        let iframe = doc.querySelector("iframe[src]");
        if (iframe) {
            let videoUrl = iframe.src;
            sources.push({ url: videoUrl, originalUrl: videoUrl, quality: "HD" });
        } else {
            // Fallback: look for video tags
            let video = doc.querySelector("video source");
            if (video) {
                let videoUrl = video.src;
                let qual = video.getAttribute('res') || "HD";
                sources.push({ url: videoUrl, originalUrl: videoUrl, quality: qual });
            }
        }
        return sources;
    },
    // Extension settings (none in this case)
    getSettings: function() {
        return [];
    }
};
