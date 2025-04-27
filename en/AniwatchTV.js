class AniwatchTV {
  constructor() {
    this.name = "AniwatchTV";
    this.baseUrl = "https://aniwatchtv.to";
    this.lang = "en";
  }

  async fetchSearch(query) {
    // return an array like [{id: '...', title: '...', image: '...'}, ...]
  }

  async fetchAnimeInfo(id) {
    // return anime info like { title: '...', episodes: [...] }
  }

  async fetchEpisodes(id) {
    // return list of episodes [{ id: '...', number: 1, title: '...' }]
  }

  async loadEpisodeSources(episodeId) {
    // return list of video links
  }
}

globalThis.extension = new AniwatchTV();
