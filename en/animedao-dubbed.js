(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.AnimeDaoDubbed = factory();
    }
}(this, function() {
    'use strict';

    class AnimeDaoDubbed {
        constructor() {
            // Configuration matching your JSON
            this.metadata = {
                id: 987654323,
                name: "AnimeDao (Dubbed)",
                url: "https://animedao.com.ru",
                type: "anime",
                language: "en",
                version: "1.0.3",
                icon: "https://www.google.com/s2/favicons?sz=64&domain_url=https://animedao.com.ru",
                website: "https://animedao.com.ru/dubbed"
            };

            this.baseUrl = this.metadata.url;
            this.dubbedPath = "/dubbed";
            this.searchPath = "/search";

            // Bind all methods to prevent context issues
            Object.getOwnPropertyNames(Object.getPrototypeOf(this))
                .filter(prop => typeof this[prop] === 'function' && prop !== 'constructor')
                .forEach(method => {
                    this[method] = this[method].bind(this);
                });
        }

        // ====================
        // PUBLIC API METHODS
        // ====================

        async search(query, page = 1) {
            try {
                if (!query || typeof query !== 'string') {
                    throw new Error('Invalid search query');
                }

                // Format search query (e.g., "One piece" -> "One+piece")
                const formattedQuery = encodeURIComponent(query.trim().replace(/\s+/g, '+'));
                const searchUrl = `${this.baseUrl}${this.searchPath}/${formattedQuery}`;
                
                const data = await this._fetch(searchUrl);
                if (!data) throw new Error('Empty search response');
                
                const $ = this.cheerio.load(data);
                const results = this._processSearchResults($);
                
                return results;
            } catch (error) {
                console.error('[AnimeDaoDubbed] Search error:', error);
                return [];
            }
        }

        async getAnimeDetails(id) {
            try {
                if (!id || typeof id !== 'string') {
                    throw new Error('Invalid anime ID');
                }

                // Ensure we're getting dubbed content
                if (!id.includes(this.dubbedPath)) {
                    id = `${this.dubbedPath}${id.startsWith('/') ? '' : '/'}${id}`;
                }

                const data = await this._fetch(id);
                if (!data) throw new Error('Empty anime details response');
                
                const $ = this.cheerio.load(data);
                
                return {
                    id: id,
                    title: `${$('h1.title').first().text().trim()} (Dubbed)`,
                    description: $('div.anime-details p').first().text().trim(),
                    thumbnail: $('div.anime-info-poster img').first().attr('src'),
                    genres: $('div.anime-info-genres a').map((i, el) => $(el).text().trim()).get(),
                    status: this._parseStatus($('div.anime-info-status:contains(Status) + div').first().text().trim()),
                    episodes: await this._getEpisodes(id)
                };
            } catch (error) {
                console.error('[AnimeDaoDubbed] getAnimeDetails error:', error);
                return null;
            }
        }

        async getEpisodeSources(episodeId) {
            try {
                if (!episodeId || typeof episodeId !== 'string') {
                    throw new Error('Invalid episode ID');
                }

                const data = await this._fetch(episodeId);
                if (!data) throw new Error('Empty episode response');
                
                const $ = this.cheerio.load(data);
                const iframeUrl = $('#video-player').first().attr('src');
                
                if (!iframeUrl) throw new Error('No video player found');
                
                return {
                    sources: [{
                        url: iframeUrl,
                        quality: 'default',
                        isM3U8: iframeUrl.includes('.m3u8'),
                        isDASH: false
                    }],
                    subtitles: []
                };
            } catch (error) {
                console.error('[AnimeDaoDubbed] getEpisodeSources error:', error);
                return { sources: [], subtitles: [] };
            }
        }

        // ====================
        // PRIVATE HELPERS
        // ====================

        async _getEpisodes(id) {
            try {
                const data = await this._fetch(id);
                if (!data) throw new Error('Empty episodes response');
                
                const $ = this.cheerio.load(data);
                
                return $('ul.episodes-range li').map((i, el) => {
                    const element = $(el);
                    const anchor = element.find('a').first();
                    const episodeNum = parseFloat(element.attr('data-jname')) || 0;
                    
                    if (!anchor.length || isNaN(episodeNum)) return null;
                    
                    return {
                        id: anchor.attr('href'),
                        number: episodeNum,
                        title: `Episode ${episodeNum} (Dubbed)`,
                        url: this._absoluteUrl(anchor.attr('href'))
                    };
                }).get().filter(Boolean).reverse();
            } catch (error) {
                console.error('[AnimeDaoDubbed] _getEpisodes error:', error);
                return [];
            }
        }

        _processSearchResults($) {
            const results = [];
            
            $('div.anime-list div.anime-item').each((i, el) => {
                try {
                    const element = $(el);
                    const anchor = element.find('a').first();
                    const img = element.find('img').first();
                    const title = element.find('h5').first().text().trim();
                    
                    if (!anchor || !img || !title) return;
                    
                    const itemUrl = anchor.attr('href');
                    if (!itemUrl.includes(this.dubbedPath)) return;
                    
                    results.push({
                        id: itemUrl,
                        title: `${title} (Dubbed)`,
                        thumbnail: img.attr('data-src') || img.attr('src'),
                        url: this._absoluteUrl(itemUrl)
                    });
                } catch (error) {
                    console.error('[AnimeDaoDubbed] Error processing search result:', error);
                }
            });

            return results;
        }

        async _fetch(url) {
            try {
                const absoluteUrl = this._absoluteUrl(url);
                const response = await fetch(absoluteUrl, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Referer": this.baseUrl,
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                return await response.text();
            } catch (error) {
                console.error('[AnimeDaoDubbed] Fetch error:', error);
                throw error;
            }
        }

        _absoluteUrl(path) {
            if (!path) return this.baseUrl + this.dubbedPath;
            if (path.startsWith('http')) return path;
            return `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
        }

        _parseStatus(status) {
            if (!status) return 'unknown';
            status = status.toLowerCase();
            if (status.includes('ongoing')) return 'ongoing';
            if (status.includes('completed')) return 'completed';
            return 'unknown';
        }
    }

    // ====================
    // EXPORT MECHANISMS
    // ====================

    return {
        // Standard extension interface
        create: function() {
            return new AnimeDaoDubbed();
        },
        
        // Direct access to class for testing
        class: AnimeDaoDubbed,
        
        // Current version info
        version: "1.0.3",
        
        // Initialized instance for immediate use
        instance: new AnimeDaoDubbed()
    };
}));
