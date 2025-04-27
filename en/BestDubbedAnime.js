globalThis.source = new Extension({
    name: "BestDubbedAnime",
    version: "1.0.0",
    type: "anime",
    language: "en",
    baseUrl: "https://bestdubbedanime.com",

    async fetchPopular(page = 1) {
        if (page > 1) return { list: [], hasNextPage: false };
        const res = await fetch(this.baseUrl + "/");
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, "text/html");

        const list = [];
        const links = doc.querySelectorAll("a");
        links.forEach((a) => {
            const href = a.href;
            let title = a.textContent.trim();
            if (!href || !href.startsWith(this.baseUrl)) return;
            if (!title || title.length < 2) return;
            const img = a.querySelector("img");
            const cover = img ? img.src : "";
            list.push({
                name: title,
                url: href,
                link: cover,
            });
        });

        return { list: list, hasNextPage: false };
    },

    async search(page = 1, query = "") {
        if (page > 1) return { list: [], hasNextPage: false };
        const res = await fetch(this.baseUrl + "/");
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, "text/html");

        const list = [];
        const links = doc.querySelectorAll("a");
        links.forEach((a) => {
            const href = a.href;
            let title = a.textContent.trim();
            if (!href || !href.startsWith(this.baseUrl)) return;
            if (!title || title.length < 2) return;
            if (title.toLowerCase().includes(query.toLowerCase())) {
                const img = a.querySelector("img");
                const cover = img ? img.src : "";
                list.push({
                    name: title,
                    url: href,
                    link: cover,
                });
            }
        });

        return { list: list, hasNextPage: false };
    },

    async fetchAnimeInfo(anime) {
        const res = await fetch(anime.url);
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, "text/html");

        const descriptionElem = doc.querySelector(".description") || doc.querySelector("meta[name='description']");
        const description = descriptionElem ? (descriptionElem.content || descriptionElem.textContent || "").trim() : "";

        const coverElem = doc.querySelector("img");
        const cover = coverElem ? coverElem.src : "";

        return {
            title: anime.name,
            description: description,
            cover: cover,
            genre: [],
        };
    },

    async fetchEpisodes(anime) {
        const res = await fetch(anime.url);
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, "text/html");

        const episodes = [];
        const episodeLinks = doc.querySelectorAll(".episode-list a");
        episodeLinks.forEach((a) => {
            const href = a.href;
            const name = a.textContent.trim();
            if (href && name) {
                episodes.push({ name: name, url: href });
            }
        });

        return episodes;
    },

    async loadEpisodeSources(episode) {
        const res = await fetch(episode.url);
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, "text/html");

        const sources = [];
        const iframe = doc.querySelector("iframe");
        if (iframe) {
            const src = iframe.src;
            if (src) {
                sources.push({ url: src, originalUrl: src, quality: "HD" });
            }
        }

        return sources;
    },

    getSettings() {
        return [];
    },
});
