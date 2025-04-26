{
  "name": "BestDubbedAnime",
  "id": "bestdubbedanime",
  "version": 1,
  "baseUrl": "https://bestdubbedanime.com",
  "language": "en",
  "isDub": true,
  "type": "anime",
  "apis": {
    "popular": {
      "url": "/xz/trending.php?_=${timestamp}",
      "list": "li",
      "item": {
        "id": "a@href | split('/')[3]",
        "title": "div.cittx",
        "url": "a@href",
        "image": "img@src"
      }
    },
    "latest": {
      "url": "/xz/gridgrabrecent.php?p=${page}&limit=12&_=${timestamp}",
      "list": "div.grid > div.grid__item",
      "item": {
        "id": "a@href | split('/')[3]",
        "title": "div.tixtlis",
        "url": "a@href",
        "image": "img@src"
      }
    },
    "search": {
      "url": "/xz/searchgrid.php?p=${page}&limit=12&s=${query}&_=${timestamp}",
      "list": "div.grid > div.grid__item",
      "item": {
        "id": "a@href | split('/')[3]",
        "title": "div.tixtlis",
        "url": "a@href",
        "image": "img@src"
      }
    },
    "info": {
      "url": "/movies/jsonMovie.php?slug=${id}&_=${timestamp}",
      "data": "$.result.anime[0]",
      "fields": {
        "title": "title",
        "description": "desc",
        "status": "status | replace('Ongoing', 'ONGOING') | replace('Completed', 'COMPLETED')",
        "genres": "tags | split(',')"
      }
    },
    "episodes": {
      "url": "/xz/v3/jsonEpi.php?slug=${id}&_=${timestamp}",
      "list": "div.serversks",
      "item": {
        "name": "text()",
        "videoUrl": "$baseUrl/xz/api/playeri.php?url=@hl&_=${timestamp}",
        "quality": "source@label"
      }
    }
  },
  "settings": [
    {
      "key": "preferred_quality",
      "title": "Preferred Quality",
      "type": "list",
      "options": ["1080", "720", "480", "360", "240"],
      "default": "1080"
    }
  ]
}
