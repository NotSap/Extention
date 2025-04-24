const mangayomiSources = [{
    name: "Aniwatch+Kitsu",
    lang: "en",
    baseUrl: "https://aniwatchtv.to",
    apiUrl: "https://kitsu.io/api/edge",
    iconUrl: "https://aniwatchtv.to/favicon.ico",
    typeSource: "hybrid",
    itemType: 1,
    version: "1.0.2"
}];

class HybridProvider extends MProvider {
    constructor() {
        super();
        this.client = new Client({
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
    }

    // Required Methods
    async search(query, page = 1) {
        try {
            const kitsuRes = await this.client.get(
                `${this.source.apiUrl}/anime?` +
                `filter[text]=${encodeURIComponent(query)}&` +
                `page[limit]=20&page[offset]=${(page-1)*20}`
            );
            
            const kitsuData = JSON.parse(kitsuRes.body);
            return {
                list: kitsuData.data.map(anime => ({
                    name: anime.attributes.canonicalTitle,
                    imageUrl: anime.attributes.posterImage?.medium || "",
                    link: `anime/${anime.id}` // Using Kitsu ID temporarily
                })),
                hasNextPage: !!kitsuData.links?.next
            };
        } catch (e) {
            console.error("Search failed:", e);
            return { list: [], hasNextPage: false };
        }
    }

    async getDetail(url) {
        const kitsuId = url.split('/').pop();
        const [kitsuRes, aniwatchRes] = await Promise.all([
            this.client.get(`${this.source.apiUrl}/anime/${kitsuId}`),
            this.client.get(`${this.source.baseUrl}/search?keyword=${encodeURIComponent(url.split('/')[1])}`)
        ]);

        const kitsuAnime = JSON.parse(kitsuRes.body).data;
        const $ = cheerio.load(aniwatchRes.body);
        
        const aniwatchId = $('.film_list-wrap .film-poster').first()
            .attr('href').split('/')[2];

        return {
            title: kitsuAnime.attributes.canonicalTitle,
            description: kitsuAnime.attributes.synopsis,
            poster: kitsuAnime.attributes.posterImage?.large || "",
            status: kitsuAnime.attributes.status === "current" ? 0 : 1,
            episodes: await this.getEpisodes(aniwatchId)
        };
    }

    async getEpisodes(aniwatchId) {
        const html = await this.client.get(
            `${this.source.baseUrl}/ajax/v2/episode/list/${aniwatchId}`
        ).then(r => r.text());
        
        return JSON.parse(html.match(/<ul class="episodes">(.*?)<\/ul>/s)[0])
            .querySelectorAll('li')
            .map(ep => ({
                id: ep.getAttribute('data-id'),
                number: ep.querySelector('.episode-number').textContent,
                title: ep.querySelector('.episode-title').textContent
            }));
    }

    async getVideoList(episodeId) {
        const servers = await this.client.get(
            `${this.source.baseUrl}/ajax/v2/episode/servers?episodeId=${episodeId}`
        ).then(r => JSON.parse(r.body));
        
        const vidstreamId = servers.html.match(/data-id="([^"]+)"/)[1];
        const sources = await this.client.get(
            `${this.source.baseUrl}/ajax/v2/episode/sources?id=${vidstreamId}`
        ).then(r => JSON.parse(r.body));
        
        return [{
            url: sources.link,
            quality: "Auto",
            headers: {
                Referer: `${this.source.baseUrl}/`,
                Origin: this.source.baseUrl
            }
        }];
    }
}

// Proper exports
module.exports = {
    sources: mangayomiSources,
    provider: HybridProvider,
    // Explicitly export all required methods
    search: HybridProvider.prototype.search,
    getDetail: HybridProvider.prototype.getDetail,
    getEpisodes: HybridProvider.prototype.getEpisodes,
    getVideoList: HybridProvider.prototype.getVideoList
};
