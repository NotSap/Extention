// nineanimetv.dart
import 'package:mangayomi/main.dart' as mangayomi;

final source = mangayomi.Source(
  name: "9AnimeTV (Fixed)",
  baseUrl: "https://9animetv.to",
  lang: "en",
  typeSource: mangayomi.TypeSource.single,
  iconUrl: "https://raw.githubusercontent.com/kodjodevf/mangayomi-extensions/main/dart/anime/src/en/nineanimetv/icon.png",
  dateFormat: "",
  dateFormatLocale: "",
  isNsfw: false,
  version: "1.0.3",
);

class NineAnimeTV extends mangayomi.Extension {
  NineAnimeTV(this.source) : super(source);

  @override
  final mangayomi.Source source;

  @override
  Future<mangayomi.Response> request(String path, {Map<String, String>? headers}) async {
    final defaultHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Referer": source.baseUrl,
    };
    return await super.request(path, headers: {...defaultHeaders, ...?headers});
  }

  @override
  Future<mangayomi.ResultSearch> search(String query, int page, [List<mangayomi.Filter>? filters]) async {
    try {
      final url = query == "popular" 
          ? "${source.baseUrl}/popular?page=$page"
          : query == "latest"
            ? "${source.baseUrl}/latest?page=$page"
            : "${source.baseUrl}/search?keyword=${Uri.encodeQueryComponent(query)}&page=$page";

      final response = await request(url);
      final doc = mangayomi.Document.html(response.body);

      final items = doc
          .querySelectorAll('.film_list-wrap .flw-item')
          .map((item) {
            final titleEl = item.querySelector('.film-name a');
            final imgEl = item.querySelector('img');
            final isDub = item.querySelector('.tick-dub') != null;

            return mangayomi.Anime(
              name: '${titleEl?.text.trim()}${isDub ? ' (Dub)' : ''}',
              url: '${source.baseUrl}${titleEl?.attr('href')}',
              imageUrl: imgEl?.attr('data-src') ?? imgEl?.attr('src') ?? '',
              language: isDub ? 'dub' : 'sub',
            );
          })
          .where((anime) => anime.name.isNotEmpty && anime.url.isNotEmpty)
          .toList();

      return mangayomi.ResultSearch(
        list: items,
        hasNextPage: doc.querySelector('.pagination .page-item:last-child:not(.active)') != null,
      );
    } catch (e) {
      mangayomi.printLog('Search error: $e');
      return mangayomi.ResultSearch(list: [], hasNextPage: false);
    }
  }

  @override
  Future<mangayomi.ResultDetail> getDetail(String url) async {
    try {
      final response = await request(url);
      final doc = mangayomi.Document.html(response.body);

      final episodes = doc
          .querySelectorAll('.episode-list .ep-item')
          .map((ep) {
            final isDub = ep.querySelector('.dub') != null;
            if (!isDub) return null;

            final epLink = ep.querySelector('a');
            final epNum = epLink?.text.trim().split(RegExp(r'\D+')).last ?? '0';

            return mangayomi.Episode(
              num: int.tryParse(epNum) ?? 0,
              name: 'Episode $epNum (Dub)',
              url: '${source.baseUrl}${epLink?.attr('href')}',
              scanlator: '9AnimeTV',
            );
          })
          .whereType<mangayomi.Episode>()
          .toList()
          .reversed
          .toList();

      return mangayomi.ResultDetail(
        description: doc.querySelector('.description')?.text.trim() ?? 'No description',
        status: doc.querySelector('.anisc-info .item')?.text.contains('Ongoing') ?? false ? 0 : 1,
        genre: doc.querySelectorAll('.anisc-info a[href*="/genre/"]').map((e) => e.text.trim()).toList(),
        episodes: episodes,
      );
    } catch (e) {
      mangayomi.printLog('Detail error: $e');
      return mangayomi.ResultDetail(
        description: "Failed to load details",
        status: 5,
        genre: [],
        episodes: [],
      );
    }
  }

  @override
  Future<List<mangayomi.Video>> getVideoList(String url) async {
    try {
      final response = await request(url);
      final html = response.body;

      // First try extracting from iframe
      final iframeMatch = RegExp(r'<iframe[^>]+src="([^"]+)"').firstMatch(html);
      if (iframeMatch != null) {
        final iframeUrl = iframeMatch.group(1)!;
        return await _extractFromIframe(iframeUrl);
      }

      // Fallback to direct extraction
      final m3u8Match = RegExp(r'"file":"([^"]+\.m3u8)"').firstMatch(html);
      if (m3u8Match != null) {
        return [
          mangayomi.Video(
            url: m3u8Match.group(1)!.replaceAll(r'\/', '/'),
            quality: "1080p",
            isM3U8: true,
            headers: {"Referer": source.baseUrl},
          )
        ];
      }

      final mp4Match = RegExp(r'"file":"([^"]+\.mp4)"').firstMatch(html);
      if (mp4Match != null) {
        return [
          mangayomi.Video(
            url: mp4Match.group(1)!.replaceAll(r'\/', '/'),
            quality: "1080p",
            isM3U8: false,
            headers: {"Referer": source.baseUrl},
          )
        ];
      }

      return [];
    } catch (e) {
      mangayomi.printLog('Video error: $e');
      return [];
    }
  }

  Future<List<mangayomi.Video>> _extractFromIframe(String iframeUrl) async {
    try {
      final response = await request(iframeUrl, headers: {"Referer": source.baseUrl});
      final html = response.body;

      // Try multiple extraction patterns
      final patterns = [
        RegExp(r'file:"([^"]+\.m3u8)"'),
        RegExp(r'sources:\s*\[\s*{\s*file:\s*"([^"]+)"'),
        RegExp(r'player\.setup\([^)]*"file":"([^"]+)"'),
      ];

      for (final pattern in patterns) {
        final match = pattern.firstMatch(html);
        if (match != null) {
          final videoUrl = match.group(1)!.replaceAll(r'\/', '/');
          return [
            mangayomi.Video(
              url: videoUrl,
              quality: videoUrl.contains('.m3u8') ? "Auto" : "1080p",
              isM3U8: videoUrl.contains('.m3u8'),
              headers: {"Referer": iframeUrl},
            )
          ];
        }
      }

      return [];
    } catch (e) {
      mangayomi.printLog('Iframe extraction error: $e');
      return [];
    }
  }

  @override
  Future<mangayomi.ResultSearch> getPopular(int page) => search("popular", page);

  @override
  Future<mangayomi.ResultSearch> getLatestUpdates(int page) => search("latest", page);
}
