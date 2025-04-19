function Animekai() {
  return {
    name: "Animekai",
    lang: "en",
    type: "anime",

    search: async (query, page) => {
      const res = await fetch(`https://animekai.to/search?keyword=${encodeURIComponent(query)}&page=${page}`);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const elements = doc.querySelectorAll('.film_list-wrap .flw-item');

      return Array.from(elements).map(el => ({
        title: el.querySelector('.film-name a')?.textContent.trim(),
        url: el.querySelector('.film-name a')?.href,
        thumbnailUrl: el.querySelector('img')?.getAttribute('data-src') || el.querySelector('img')?.src
      }));
    }
  };
}

globalThis.Animekai = Animekai;
