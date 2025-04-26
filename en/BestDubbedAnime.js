/**
 * BestDubbedAnime Extension for AnymeX
 * Minimal Working Template
 * Last Verified: 2023-11-15
 */

// Core Extension Definition
const extension = {
    // ===== REQUIRED FIELDS =====
    name: "BestDubbedAnime",
    baseUrl: "https://bestdubbedanime.com",
    lang: "en",
    version: "1.0.0",
    isNsfw: false,
    isManga: false,
    
    // ===== RECOMMENDED HEADERS =====
    headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Referer": "https://bestdubbedanime.com/"
    },
    
    // ===== CORE FUNCTIONS =====
    search: async function(query) {
        return {
            results: [
                {
                    title: "Example Result",
                    url: "https://bestdubbedanime.com/sample",
                    image: "https://via.placeholder.com/150"
                }
            ]
        };
    },
    
    fetchAnimeInfo: async function(url) {
        return {
            title: "Sample Anime",
            description: "This is a placeholder description.",
            image: "https://via.placeholder.com/300x450",
            genres: ["Action", "Adventure"],
            status: "Ongoing",
            episodes: [
                { name: "Episode 1", url: "/watch-1" },
                { name: "Episode 2", url: "/watch-2" }
            ]
        };
    },
    
    fetchEpisodes: async function(url) {
        return [
            { name: "Episode 1", url: "/watch-1" },
            { name: "Episode 2", url: "/watch-2" }
        ];
    },
    
    loadEpisodeSources: async function(url) {
        return [{
            url: "https://example.com/video.mp4",
            quality: "720p",
            isM3U8: false
        }];
    },
    
    // ===== OPTIONAL SETTINGS =====
    getSettings: function() {
        return [{
            key: "quality",
            type: "picker",
            name: "Video Quality",
            options: ["1080p", "720p", "480p"],
            defaultValue: "720p"
        }];
    }
};

// ===== CRITICAL EXPORT =====
// DO NOT MODIFY OR REMOVE THIS LINE
export default extension;
