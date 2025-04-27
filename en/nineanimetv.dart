import 'package:mangayomi/bridge_lib.dart';
import 'dart:convert';

class NineAnimeTV extends MProvider {
  NineAnimeTV();
  @override
  final String id = "nineanimetv";
  final String name = "9AnimeTV";
  final String lang = "en";
  final bool isNsfw = false;
  final String baseUrl = "https://9animetv.to";

  // Universal request method that works with Anymex
  Future<dynamic> _makeRequest(String url, {Map<String, String>? headers}) async {
    try {
      // Try Anymex's native request method first
      return await MProvider.invokeMethod('request', {'url': url, 'headers': headers ?? {}});
    } catch (e) {
      // Fallback to standard method if native fails
      final res = await request(url, headers: headers);
      return res;
    }
  }

  @override
  Future<MPages> getPopular(MSource source, int page) async {
    final res = await _makeRequest("$baseUrl/filter?sort=views&page=$page");
    final body = res is String ? res : res.body;
    final items = parse(body)
        .select('.film-list .film-item')
        .map((e) => MChapter(
              name: e.select('.film-name a').attr('title') ?? '',
              url: e.select('.film-name a').attr('href') ?? '',
              imageUrl: e.select('.film-poster img').attr('data-src') ?? '',
            ))
        .toList();
    return MPages(items, true);
  }

  @override
  Future<MPages> getLatestUpdates(MSource source, int page) async {
    final res = await _makeRequest("$baseUrl/filter?sort=lastest&page=$page");
    final body = res is String ? res : res.body;
    final items = parse(body)
        .select('.film-list .film-item')
        .map((e) => MChapter(
              name: e.select('.film-name a').attr('title') ?? '',
              url: e.select('.film-name a').attr('href') ?? '',
              imageUrl: e.select('.film-poster img').attr('data-src') ?? '',
            ))
        .toList();
    return MPages(items, true);
  }

  @override
  Future<MPages> search(MSource source, String query, int page, FilterList filterList) async {
    final filters = filterList.filters;
    String url = "$baseUrl/filter?keyword=$query&page=$page";

    final genreFilter = filters.whereType<GenreFilter>().firstOrNull;
    if (genreFilter != null && genreFilter.state != 0) {
      url += "&genre=${genreFilter.state}";
    }

    final statusFilter = filters.whereType<SelectFilter>().firstWhere((f) => f.name == "Status");
    if (statusFilter.state != 0) {
      url += statusFilter.state == 1 ? "&status=ongoing" : "&status=completed";
    }

    final res = await _makeRequest(url);
    final body = res is String ? res : res.body;
    final items = parse(body)
        .select('.film-list .film-item')
        .map((e) => MChapter(
              name: e.select('.film-name a').attr('title') ?? '',
              url: e.select('.film-name a').attr('href') ?? '',
              imageUrl: e.select('.film-poster img').attr('data-src') ?? '',
            ))
        .toList();
    return MPages(items, true);
  }

  @override
  Future<MManga> getDetail(MChapter chapter) async {
    final res = await _makeRequest(chapter.url);
    final body = res is String ? res : res.body;
    final doc = parse(body);

    final description = doc.select('#description-mobile').text.trim();
    final statusStr = doc.select('.film-status').text.trim();
    final status = statusStr.toLowerCase().contains('ongoing') ? MStatus.ongoing : MStatus.completed;

    final genres = doc.select('.film-genre a')
        .map((e) => e.text.trim())
        .toList();

    final chapters = doc.select('.ss-list .episode-item')
        .map((e) {
          final name = e.select('.episode-name').text.trim();
          final url = e.select('a').attr('href') ?? '';
          final date = e.select('.episode-date').text.trim();
          return MChapter(
              name: name,
              url: url,
              date: date);
        })
        .toList()
        .reversed
        .toList();

    return MManga(
      title: chapter.name,
      description: description,
      status: status,
      genres: genres,
      chapters: chapters,
      cover: chapter.imageUrl,
    );
  }

  @override
  Future<List<String>> getPageList(MChapter chapter) async {
    final res = await _makeRequest(chapter.url);
    final body = res is String ? res : res.body;
    final script = parse(body).select('script:contains(ts_net)').first.text;
    
    final tsNet = script.split("var ts_net = ")[1].split(";")[0];
    final serverUrl = tsNet.replaceAll("'", "").split(',').reversed.first;
    final cleanUrl = serverUrl.replaceAll(RegExp(r'[^A-Za-z0-9\-_\.\/:]'), '');

    final token = RegExp(r'var en_token\s*=\s*"([^"]+)"').firstMatch(script)?.group(1) ?? '';
    final videoRes = await _makeRequest('$cleanUrl/getvid?evid=$token', 
        headers: {'Referer': chapter.url});
    final videoBody = videoRes is String ? videoRes : videoRes.body;

    return [jsonDecode(videoBody)['data']['src']];
  }

  @override
  FilterList getFilterList() {
    return FilterList([
      SelectFilter("Status", "All", ["All", "Ongoing", "Completed"]),
      GenreFilter("Genre", 0, [
        "Action", "Adventure", "Cars", "Comedy", "Dementia", 
        "Demons", "Drama", "Ecchi", "Fantasy", "Game", 
        "Harem", "Historical", "Horror", "Josei", "Kids", 
        "Magic", "Martial Arts", "Mecha", "Military", "Music", 
        "Mystery", "Parody", "Police", "Psychological", "Romance", 
        "Samurai", "School", "Sci-Fi", "Seinen", "Shoujo", 
        "Shoujo Ai", "Shounen", "Shounen Ai", "Slice of Life", "Space", 
        "Sports", "Super Power", "Supernatural", "Thriller", "Vampire", 
        "Yaoi", "Yuri"
      ])
    ]);
  }
}
