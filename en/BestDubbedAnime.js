{
  "name": "BestDubbedAnime",
  "baseUrl": "https://bestdubbedanime.com",
  "language": "en",
  "isDub": true,
  "hasSettings": true,
  "preferences": [
    {
      "key": "preferred_quality",
      "type": "list",
      "title": "Preferred Quality",
      "entries": ["1080p", "720p", "480p", "360p", "240p"],
      "values": ["1080", "720", "480", "360", "240"],
      "default": "1080"
    }
  ],
  "apis": {
    "popular": {
      "url": "/xz/trending.php?_=${timestamp}",
      "list": "li",
      "item": {
        "title": "div.cittx",
        "url": "a@href",
        "thumbnail": "img@src"
      }
    },
    "latest": {
      "url": "/xz/gridgrabrecent.php?p=${page}&limit=12&_=${timestamp}",
      "list": "div.grid > div.grid__item",
      "item": {
        "title": "div.tixtlis",
        "url": "a@href",
        "thumbnail": "img@src"
      }
    },
    "search": {
      "url": "/xz/searchgrid.php?p=${page}&limit=12&s=${query}&_=${timestamp}",
      "list": "div.grid > div.grid__item",
      "item": {
        "title": "div.tixtlis",
        "url": "a@href",
        "thumbnail": "img@src"
      }
    },
    "episodes": {
      "url": "/xz/v3/jsonEpi.php?slug=${slug}&_=${timestamp}",
      "list": "div.serversks",
      "item": {
        "server": "text()",
        "videos": {
          "url": "$baseUrl/xz/api/playeri.php?url=${hl}&_=${timestamp}",
          "quality": "source@label",
          "videoUrl": "source@src"
        }
      }
    }
  }
}
