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

  // Anymex uses `dio` instead of `http` or `MProvider.http`
  @override
  Future<MPages> getPopular(MSource source, int page) async {
    final res = await dio.get("$baseUrl/filter?sort=views&page=$page"); // ✅ Use `dio.get`
    final items = parse(res.data) // ✅ Use `res.data` instead of `res.body`
        .select('.film-list .film-item')
        .map((e) {
          final title = e.select('.film-name a').attr('title') ?? '';
          final url = e.select('.film-name a').attr('href') ?? '';
          final cover = e.select('.film-poster img').attr('data-src') ?? '';
          return MChapter(
              name: title,
              url: url,
              imageUrl: cover);
        })
        .toList();
    return MPages(items, true);
  }

  @override
  Future<MPages> getLatestUpdates(MSource source, int page) async {
    final res = await dio.get("$baseUrl/filter?sort=lastest&page=$page"); // ✅ `dio.get`
    final items = parse(res.data) // ✅ `res.data`
        .select('.film-list .film-item')
        .map((e) {
          final title = e.select('.film-name a').attr('title') ?? '';
          final url = e.select('.film-name a').attr('href') ?? '';
          final cover = e.select('.film-poster img').attr('data-src') ?? '';
          return MChapter(
              name: title,
              url: url,
              imageUrl: cover);
        })
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

    final res = await dio.get(url); // ✅ `dio.get`
    final items = parse(res.data) // ✅ `res.data`
        .select('.film-list .film-item')
        .map((e) {
          final title = e.select('.film-name a').attr('title') ?? '';
          final url = e.select('.film-name a').attr('href') ?? '';
          final cover = e.select('.film-poster img').attr('data-src') ?? '';
          return MChapter(
              name: title,
              url: url,
              imageUrl: cover);
        })
        .toList();
    return MPages(items, true);
  }

  @override
  Future<MManga> getDetail(MChapter chapter) async {
    final res = await dio.get(chapter.url); // ✅ `dio.get`
    final doc = parse(res.data); // ✅ `res.data`

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
    final res = await dio.get(chapter.url); // ✅ `dio.get`
    final script = parse(res.data).select('script:contains(ts_net)').first.text; // ✅ `res.data`
    
    // Extract ts_net array
    final tsNet = script.split("var ts_net = ")[1].split(";")[0];
    final list = tsNet.replaceAll("'", "").split(',').reversed.toList();
    final serverUrl = list[0].replaceAll(RegExp(r'[^A-Za-z0-9\-_\.\/:]'), '');

    // Extract encrypted token
    final tokenMatch = RegExp(r'var en_token\s*=\s*"([^"]+)"').firstMatch(script);
    final token = tokenMatch?.group(1) ?? '';

    // Build final URL
    final videoUrl = '$serverUrl/getvid?evid=$token';
    final videoRes = await dio.get(videoUrl, options: Options(headers: {'Referer': chapter.url})); // ✅ `dio.get` with headers
    final videoJson = jsonDecode(videoRes.data); // ✅ `videoRes.data`
    final videoSrc = videoJson['data']['src'];

    return [videoSrc];
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
