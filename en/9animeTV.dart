import 'package:mangayomi/bridge_lib.dart';
import 'dart:convert';
import 'package:html/parser.dart' as html_parser;
import 'package:html/dom.dart';

class NineAnime extends MProvider {
  NineAnime({required this.source});

  final MSource source;
  final Client client = Client(source);
  final Map<String, String> _headers = {
    "Referer": "https://9anime.pl/",
    "Origin": "https://9anime.pl"
  };

  @override
  Future<MPages> getPopular(int page) => _getAnimeList("popular", page);

  @override
  Future<MPages> getLatestUpdates(int page) => _getAnimeList("updated", page);

  Future<MPages> _getAnimeList(String sort, int page) async {
    try {
      final response = await client.get(
        Uri.parse("${source.baseUrl}/filter?sort=$sort&page=$page"),
      );
      final document = html_parser.parse(response.body);
      
      final items = document.querySelectorAll(".film-list > .item").map((Element el) {
        final isDub = el.querySelector(".dub") != null;
        final name = el.querySelector(".name")?.text ?? "Unknown Title";
        final image = el.querySelector("img")?.attributes["src"] ?? "";
        final link = el.querySelector("a")?.attributes["href"] ?? "";

        return MManga()
          ..name = "$name${isDub ? ' (Dub)' : ''}"
          ..imageUrl = image
          ..link = link
          ..language = isDub ? "dub" : "sub";
      }).toList();

      final hasNextPage = document.querySelector(".pagination > a") != null;
      return MPages(items, hasNextPage);
    } catch (e) {
      print("Error in _getAnimeList: $e");
      return MPages([], false);
    }
  }

  @override
  Future<MPages> search(String query, int page, FilterList filters) async {
    try {
      final response = await client.get(
        Uri.parse("${source.baseUrl}/filter?keyword=${Uri.encodeComponent(query)}&page=$page"),
      );
      return _getAnimeList("", page);
    } catch (e) {
      print("Error in search: $e");
      return MPages([], false);
    }
  }

  @override
  Future<MManga> getDetail(String url) async {
    try {
      final response = await client.get(Uri.parse("${source.baseUrl}$url"));
      final document = html_parser.parse(response.body);
      
      final filmId = document.querySelector("[data-film-id]")?.attributes["data-film-id"] ?? "";
      final serverResponse = await client.get(
        Uri.parse("${source.baseUrl}/ajax/film/servers?id=$filmId"),
        headers: _headers,
      );
      
      final serverHtml = jsonDecode(serverResponse.body)["html"] as String;
      final serverDoc = html_parser.parse(serverHtml);
      
      final episodes = serverDoc.querySelectorAll(".server").expand((Element server) {
        final type = server.attributes["data-type"] ?? "sub";
        return server.querySelectorAll(".episodes > a").map((Element ep) {
          return MChapter()
            ..name = "Episode ${ep.text} (${_capitalize(type)})"
            ..url = "${ep.attributes["data-id"]}|$type";
        });
      }).toList();

      return MManga()
        ..description = document.querySelector(".content")?.text ?? ""
        ..status = document.querySelector(".status")?.text?.contains("Ongoing") == true ? 0 : 1
        ..genre = document.querySelectorAll(".genre > a").map((e) => e.text).toList()
        ..chapters = episodes.reversed.toList();
    } catch (e) {
      print("Error in getDetail: $e");
      return MManga();
    }
  }

  @override
  Future<List<MVideo>> getVideoList(String url) async {
    try {
      final parts = url.split("|");
      if (parts.length != 2) return [];
      
      final response = await client.get(
        Uri.parse("${source.baseUrl}/ajax/episode/info?id=${parts[0]}&server=${parts[1]}"),
        headers: _headers,
      );
      
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final videoUrl = data["url"]?.toString() ?? "";
      
      if (videoUrl.isEmpty) return [];
      
      return [
        MVideo()
          ..url = videoUrl
          ..quality = "Default (${_capitalize(parts[1])})"
          ..headers = _headers
      ];
    } catch (e) {
      print("Error in getVideoList: $e");
      return [];
    }
  }

  String _capitalize(String s) => s.isNotEmpty 
    ? "${s[0].toUpperCase()}${s.substring(1)}" 
    : "";
}

NineAnime main(MSource source) => NineAnime(source: source);
