(function() {
    'use strict';

    class AnimeDaoDubbed {
        constructor() {
            // Core metadata - must match your JSON configuration
            this.metadata = {
                id: 987654323,
                name: "AnimeDao (Dubbed)",
                url: "https://animedao.com.ru/dubbed",
                type: "anime",
                language: "en",
                version: "1.0.1",  // Incremented version
                icon: "https://www.google.com/s2/favicons?sz=64&domain_url=https://animedao.com.ru",
                website: "https://animedao.com.ru"
            };

            // Initialize base URL
            this.baseUrl = this.metadata.url;

            // Bind all methods to ensure proper 'this' context
            this.search = this.search.bind(this);
            this.getAnimeDetails = this.getAnimeDetails.bind(this);
            this.getEpisodeSources = this.getEpisodeSources.bind(this);
            this._getEpisodes = this._getEpisodes.bind(this);
            this._fetch = this._fetch.bind(this);
            this._absoluteUrl = this._absoluteUrl.bind(this);
            this._parseStatus = this._parseStatus.bind(this);
        }

        // ====================
        // PUBLIC API METHODS
        // ====================

        async search(query, page = 1) {
            try {
                if (!query || typeof query !== 'string') {
                    throw new Error('Invalid search query');
                }

                const searchUrl = `${this.baseUrl}/search.html?keyword=${encodeURIComponent(query)}&page=${page}`;
                const data = await this._fetch(searchUrl);
                
                if (!data) {
                    throw new Error('No data received from server');
                }

                const $ = this.cheerio.load(data);
                const results = $('div.anime-list div.anime-item').map((i, el) => {
                    const element = $(el);
                    const anchor = element.find('a').first();
                    const img = element.find('img').first();
                    
                    if (!anchor.length || !img.length) {
                        return null;
                    }

                    return {
                        id: anchor.attr('href'),
                        title: `${element.find('h5').first().text().trim()} (Dubbed)`,
                        thumbnail: img.attr('data-src') || img.attr('src'),
                        url: this._absoluteUrl(anchor.attr('href'))
                    };
                }).get().filter(Boolean);

                return results;
            } catch (error) {
                console.error('[AnimeDaoDubbed] Search error:', error);
                return [];
            }
        }

        async getAnimeDetails(id) {
            try {
                if (!id) {
                    throw new Error('Invalid anime ID');
                }

                const data = await this._fetch(id);
                
                if (!data) {
                    throw new Error('No data received for anime details');
                }

                const $ = this.cheerio.load(data);
                const title = $('h1.title').first().text().trim();
                const description = $('div.anime-details p').first().text().trim();
                const thumbnail = $('div.anime-info-poster img').first().attr('src');
                const statusText = $('div.anime-info-status:contains(Status) + div').first().text().trim();

                return {
                    id: id,
                    title: `${title} (Dubbed)`,
                    description: description,
                    thumbnail: thumbnail,
                    genres: $('div.anime-info-genres a').map((i, el) => $(el).text().trim()).get(),
                    status: this._parseStatus(statusText),
                    episodes: await this._getEpisodes(id)
                };
            } catch (error) {
                console.error('[AnimeDaoDubbed] getAnimeDetails error:', error);
                return null;
            }
        }

        async getEpisodeSources(episodeId) {
            try {
                if (!episodeId) {
                    throw new Error('Invalid episode ID');
                }

                const data = await this._fetch(episodeId);
                
                if (!data) {
                    throw new Error('No data received for episode');
                }

                const $ = this.cheerio.load(data);
                const iframeUrl = $('#video-player').first().attr('src');

                if (!iframeUrl) {
                    throw new Error('No video iframe found');
                }

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
                const $ = this.cheerio.load(data);
                
                return $('ul.episodes-range li').map((i, el) => {
                    const element = $(el);
                    const anchor = element.find('a').first();
                    const episodeNum = parseFloat(element.attr('data-jname')) || 0;
                    
                    if (!anchor.length || isNaN(episodeNum)) {
                        return null;
                    }

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
                console.error('[AnimeDaoDubbed] _fetch error:', error);
                throw error;
            }
        }

        _absoluteUrl(path) {
            if (!path) return this.baseUrl;
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

    // For CommonJS/Node.js environments
    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            module.exports = {
                create: function() {
                    return new AnimeDaoDubbed();
                }
            };
        }
        exports.create = function() {
            return new AnimeDaoDubbed();
        };
    }

    // For browser environments
    if (typeof window !== 'undefined') {
        window.createAnimeDaoDubbedExtension = function() {
            return new AnimeDaoDubbed();
        };
    }

    // For direct script inclusion
    if (typeof extension === 'undefined' && typeof window !== 'undefined') {
        window.extension = new AnimeDaoDubbed();
    }

    // For ES module imports
    if (typeof define === 'function' && define.amd) {
        define([], function() {
            return AnimeDaoDubbed;
        });
    }
})();
