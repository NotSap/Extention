const mangayomiSources = [{
    name: "AnimeX-Hybrid",
    lang: "en",
    baseUrl: "https://aniwatchtv.to",
    apiUrl: "https://kitsu.io/api/edge",
    iconUrl: "https://i.imgur.com/JnX8WXV.png",
    typeSource: "hybrid",
    itemType: 1,
    version: "2.1.0",
    isAnimeX: true  // Special flag for AnymeX compatibility
}];

class AnimeXHybridProvider extends MProvider {
    constructor() {
        super();
        this.cache = new Map();  // For caching Aniwatch IDs
        this.client = new Client({
            interceptors: [
                {
                    request: (options) => {
                        options.headers = {
                            ...options.headers,
                            'User-Agent': 'AnymeX/2.0 (+https://github.com/RyanYuuki/AnymeX)',
                            'X-Requested-With': 'XMLHttpRequest'
                        };
                        return options;
                    }
                }
            ]
        });
    }

    // ========================
    // CORE ANYMEX INTEGRATION
    // ========================
    
    async search(query, page = 1) {
        const response = await this._kitsuRequest(`/anime?filter[text]=${encodeURIComponent(query)}&page[limit]=10&page[offset]=${(page-1)*10}`);
        
        return {
            results: await Promise.all(response.data.map(async anime => ({
                id: anime.id,
                title: anime.attributes.canonicalTitle,
                thumbnail: anime.attributes.posterImage?.medium || "",
                aniwatchId: await this._getAniwatchId(anime.attributes.canonicalTitle),
                kitsuData: anime  // Preserve full Kitsu object
            }))),
            hasMore: !!response.links?.next
        };
    }

    async getMedia(mediaId) {
        const [kitsuRes, episodes] = await Promise.all([
            this._kitsuRequest(`/anime/${mediaId}`),
            this.getEpisodes(mediaId)
        ]);
        
        return {
            ...kitsuRes.data.attributes,
            episodes,
            aniwatchId: await this._getAniwatchId(kitsuRes.data.attributes.canonicalTitle)
        };
    }

    async getEpisodes(mediaId) {
        const aniwatchId = await this.cache.get(mediaId) || 
                           await this._getAniwatchId(mediaId);
        
        const { body } = await this.client.get(
            `${this.baseUrl}/ajax/v2/episode/list/${aniwatchId}`
        );
        
        return JSON.parse(body).episodes.map(ep => ({
            id: ep.id,
            number: ep.number,
            title: ep.title || `Episode ${ep.number}`
        }));
    }

    async getSources(episodeId) {
        const { body } = await this.client.get(
            `${this.baseUrl}/ajax/v2/episode/servers?episodeId=${episodeId}`
        );
        
        const serverId = body.match(/data-id="([^"]+)"/)[1];
        const { body: sources } = await this.client.get(
            `${this.baseUrl}/ajax/v2/episode/sources?id=${serverId}`
        );
        
        return {
            sources: [{
                url: sources.link,
                quality: 'default',
                headers: {
                    Referer: this.baseUrl,
                    Origin: this.baseUrl
                }
            }],
            subtitles: []  // AnymeX expects this array
        };
    }

    // ========================
    // PRIVATE HELPERS
    // ========================
    
    async _kitsuRequest(endpoint) {
        const { body } = await this.client.get(`${this.apiUrl}${endpoint}`);
        return JSON.parse(body);
    }

    async _getAniwatchId(title) {
        if (this.cache.has(title)) return this.cache.get(title);
        
        const { body } = await this.client.get(
            `${this.baseUrl}/search?keyword=${encodeURIComponent(title)}`
        );
        
        const $ = cheerio.load(body);
        const aniwatchId = $('.film_list-wrap .film-poster')
            .first()
            .attr('href')
            .split('/')[2];
            
        this.cache.set(title, aniwatchId);
        return aniwatchId;
    }
}

// ANYMEX-SPECIFIC EXPORTS
module.exports = {
    meta: {
        identifier: 'animex-hybrid',
        name: 'AnimeX Hybrid Source',
        type: 'anime',
        version: '2.1.0',
        needsPackager: false
    },
    
    // AnymeX required methods
    search: AnimeXHybridProvider.prototype.search,
    getMedia: AnimeXHybridProvider.prototype.getMedia,
    getEpisodes: AnimeXHybridProvider.prototype.getEpisodes,
    getSources: AnimeXHybridProvider.prototype.getSources,
    
    // Optional
    getFilters: () => ({}),
    applyFilter: (filter) => ({ results: [], hasMore: false })
};
