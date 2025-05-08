import 'package:mangayomi/bridge_lib.dart';
import 'dart:convert';

class NineAnimeTv extends MProvider {
  NineAnimeTv({required this.source});

  MSource source;

  final Client client = Client(source);

  @override
  Future<MPages> getPopular(int page) async {
    final res = (await client.get(
      Uri.parse("${source.baseUrl}/filter?sort=all&page=$page"),
    )).body;
    return parseAnimeList(res);
  }

  @override
  Future<MPages> getLatestUpdates(int page) async {
    final res = (await client.get(
      Uri.parse("${source.baseUrl}/filter?sort=recently_updated&page=$page"),
    )).body;
    return parseAnimeList(res);
  }

  @override
  Future<MPages> search(String query, int page, FilterList filterList) async {
    final filters = filterList.filters;
    String url = "${source.baseUrl}/filter?keyword=$query";

    for (var filter in filters) {
      if (filter.type == "GenreFilter") {
        final genre = (filter.state as List).where((e) => e.state).toList();
        url += "${ll(url)}genre=";
        if (genre.isNotEmpty) {
          for (var st in genre) {
            url += "${st.value}";
            if (genre.length > 1) {
              url += "%2C";
            }
          }
          if (genre.length > 1) {
            url = substringBeforeLast(url, '%2C');
          }
        }
      } else if (filter.type == "SeasonFilter") {
        final season = (filter.state as List).where((e) => e.state).toList();
        url += "${ll(url)}season=";
        if (season.isNotEmpty) {
          for (var st in season) {
            url += "${st.value}";
            if (season.length > 1) {
              url += "%2C";
            }
          }
          if (season.length > 1) {
            url = substringBeforeLast(url, '%2C');
          }
        }
      } else if (filter.type == "YearFilter") {
        final year = (filter.state as List).where((e) => e.state).toList();
        url += "${ll(url)}year=";
        if (year.isNotEmpty) {
          for (var st in year) {
            url += "${st.value}";
            if (year.length > 1) {
              url += "%2C";
            }
          }
          if (year.length > 1) {
            url = substringBeforeLast(url, '%2C');
          }
        }
      } else if (filter.type == "TypeFilter") {
        final type = (filter.state as List).where((e) => e.state).toList();
        url += "${ll(url)}type=";
        if (type.isNotEmpty) {
          for (var st in type) {
            url += "${st.value}";
            if (type.length > 1) {
              url += "%2C";
            }
          }
          if (type.length > 1) {
            url = substringBeforeLast(url, '%2C');
          }
        }
      } else if (filter.type == "StatusFilter") {
        final status = filter.values[filter.state].value;
        url += "${ll(url)}status=$status";
      } else if (filter.type == "LanguageFilter") {
        final language = (filter.state as List).where((e) => e.state).toList();
        url += "${ll(url)}language=";
        if (language.isNotEmpty) {
          for (var st in language) {
            url += "${st.value}";
            if (language.length > 1) {
              url += "%2C";
            }
          }
          if (language.length > 1) {
            url = substringBeforeLast(url, '%2C');
          }
        }
      } else if (filter.type == "SortFilter") {
        final sort = filter.values[filter.state].value;
        url += "${ll(url)}sort=$sort";
      }
    }

    final res = (await client.get(Uri.parse("$url&page=$page"))).body;
    return parseAnimeList(res);
  }

  @override
  Future<MManga> getDetail(String url) async {
    final statusList = [
      {"Currently Airing": 0, "Finished Airing": 1},
    ];

    final res = (await client.get(Uri.parse("${source.baseUrl}$url"))).body;
    MManga anime = MManga();
    final document = parseHtml(res);
    final infoElement = document.selectFirst("div.film-infor");
    final status = infoElement.xpathFirst(
          '//div[contains(text(),"Status:")]/following-sibling::div/span/text()',
        ) ??
        "";
    anime.status = parseStatus(status, statusList);
    anime.description =
        infoElement.selectFirst("div.film-description > p")?.text ?? "";
    anime.author =
        infoElement.xpathFirst(
          '//div[contains(text(),"Studios:")]/following-sibling::div/a/text()',
        ) ??
        "";

    anime.genre = infoElement.xpath(
      '//div[contains(text(),"Genre:")]/following-sibling::div/a/text()',
    );
    final id = parseHtml(res).selectFirst("div[data-id]").attr("data-id");

    final resEp = (await client.get(
      Uri.parse("${source.baseUrl}/ajax/episode/list/$id"),
    )).body;
    final html = json.decode(resEp)["html"];

    List<MChapter>? episodesList = [];

    final epsElements = parseHtml(html).select("a");
    for (var epElement in epsElements) {
      final id = epElement.attr('data-id');
      final title = epElement.attr('title') ?? "";
      final epNum = epElement.attr('data-number');

      MChapter episode = MChapter();
      episode.name = "Episode $epNum $title";
      episode.url = id;
      episodesList.add(episode);
    }
    anime.chapters = episodesList.reversed.toList();
    return anime;
  }

  @override
  Future<List<MVideo>> getVideoList(String url) async {
    try {
      // First get server list
      final res = (await client.get(
        Uri.parse("${source.baseUrl}/ajax/episode/servers?episodeId=$url"),
      )).body;

      final html = json.decode(res)["html"];
      final serverElements = parseHtml(html).select("div.server-item");

      List<MVideo> videos = [];
      final hosterSelection = preferenceHosterSelection(source.id);
      final typeSelection = preferenceTypeSelection(source.id);

      for (var serverElement in serverElements) {
        final name = serverElement.text;
        final id = serverElement.attr("data-id");
        final subDub = serverElement.attr("data-type");

        // Skip if not in preferences
        if (!hosterSelection.any((h) => name.toLowerCase().contains(h.toLowerCase()))) continue;
        if (!typeSelection.contains(subDub)) continue;

        // Get video sources
        final sourceRes = (await client.get(
          Uri.parse("${source.baseUrl}/ajax/episode/sources?id=$id"),
        )).body;
        
        final videoUrl = json.decode(sourceRes)["link"];
        if (videoUrl == null || videoUrl.isEmpty) continue;

        // Extract based on server type
        if (name.toLowerCase().contains("vidstreaming") || name.toLowerCase().contains("vidcloud")) {
          try {
            final extracted = await rapidCloudExtractor(videoUrl, "$name - $subDub");
            videos.addAll(extracted);
          } catch (e) {
            print("Error extracting from $name: $e");
          }
        }
        // Add direct URL as fallback
        else {
          videos.add(MVideo()
            ..url = videoUrl
            ..quality = "$name - $subDub"
            ..headers = {"Referer": source.baseUrl});
        }
      }

      return sortVideos(videos, source.id);
    } catch (e) {
      print("Error in getVideoList: $e");
      return [];
    }
  }

  Future<List<MVideo>> rapidCloudExtractor(String url, String name) async {
    try {
      // Determine server type
      final isMegacloud = url.contains("megacloud");
      final baseUrl = isMegacloud ? "https://megacloud.tv" : "https://rapid-cloud.co";
      final apiPath = isMegacloud ? "/embed-2/ajax/e-1/getSources?id=" 
                                 : "/ajax/embed-6-v2/getSources?id=";
      
      // Extract video ID
      final id = url.split("/").last.split("?").first;
      
      // Fetch sources
      final response = await client.get(
        Uri.parse("$baseUrl$apiPath$id"),
        headers: {"X-Requested-With": "XMLHttpRequest"},
      );
      
      final jsonData = json.decode(response.body);
      final encrypted = jsonData["encrypted"] ?? false;
      String sourcesJson;

      if (encrypted) {
        // Simplified decryption - you may need to implement full decryption
        sourcesJson = json.encode(jsonData["sources"]);
      } else {
        sourcesJson = json.encode(jsonData["sources"]);
      }

      final sources = json.decode(sourcesJson) as List;
      if (sources.isEmpty) return [];

      // Get master URL and type
      final masterUrl = sources.first["file"];
      final type = sources.first["type"] ?? "mp4";

      // Handle HLS playlists
      if (type == "hls") {
        return await processHlsPlaylist(masterUrl, name);
      } 
      // Handle direct MP4
      else {
        return [MVideo()
          ..url = masterUrl
          ..quality = "$name - Default"
          ..headers = {"Referer": baseUrl}];
      }
    } catch (e) {
      print("Error in rapidCloudExtractor: $e");
      return [];
    }
  }

  Future<List<MVideo>> processHlsPlaylist(String masterUrl, String name) async {
    try {
      final response = await client.get(Uri.parse(masterUrl));
      final playlist = response.body;
      
      List<MVideo> videos = [];
      final lines = playlist.split("#EXT-X-STREAM-INF:");
      
      for (var line in lines.skip(1)) {
        final resolution = RegExp(r'RESOLUTION=(\d+x\d+)').firstMatch(line)?.group(1);
        final quality = resolution?.split("x").last ?? "Unknown";
        
        final videoUrl = line.split("\n").where((l) => l.isNotEmpty && !l.startsWith("#")).first;
        final fullUrl = videoUrl.startsWith("http") ? videoUrl 
                  : "${masterUrl.substring(0, masterUrl.lastIndexOf("/"))}/$videoUrl";

        videos.add(MVideo()
          ..url = fullUrl
          ..quality = "$name - ${quality}p"
          ..headers = {"Referer": masterUrl});
      }
      
      return videos;
    } catch (e) {
      print("Error processing HLS playlist: $e");
      return [];
    }
  }

  MPages parseAnimeList(String res) {
    final elements = parseHtml(res).select("div.film_list-wrap > div");
    List<MManga> animeList = [];
    for (var element in elements) {
      MManga anime = MManga();
      anime.name = element.selectFirst("div.film-detail > h3 > a").text;
      anime.imageUrl = element.selectFirst("div.film-poster > img").getSrc;
      anime.link = element.selectFirst("div.film-detail > h3 > a").getHref;
      animeList.add(anime);
    }
    return MPages(animeList, true);
  }

  List<MVideo> sortVideos(List<MVideo> videos, int sourceId) {
    String quality = getPreferenceValue(sourceId, "preferred_quality");
    String server = getPreferenceValue(sourceId, "preferred_server");
    String type = getPreferenceValue(sourceId, "preferred_type");
    
    videos.sort((a, b) {
      int qualityMatchA = a.quality.toLowerCase().contains(quality.toLowerCase()) ? 1 : 0;
      int qualityMatchB = b.quality.toLowerCase().contains(quality.toLowerCase()) ? 1 : 0;
      if (qualityMatchA != qualityMatchB) return qualityMatchB - qualityMatchA;

      final regex = RegExp(r'(\d+)p');
      final matchA = regex.firstMatch(a.quality);
      final matchB = regex.firstMatch(b.quality);
      final qualityNumA = int.tryParse(matchA?.group(1) ?? '0') ?? 0;
      final qualityNumB = int.tryParse(matchB?.group(1) ?? '0') ?? 0;
      return qualityNumB - qualityNumA;
    });
    return videos;
  }

  List<String> preferenceHosterSelection(int sourceId) {
    return getPreferenceValue(sourceId, "hoster_selection");
  }

  List<String> preferenceTypeSelection(int sourceId) {
    return getPreferenceValue(sourceId, "type_selection");
  }

  String ll(String url) {
    return url.contains("?") ? "&" : "?";
  }

  @override
  List<dynamic> getFilterList() {
    return [
      GroupFilter("GenreFilter", "Genre", [
        CheckBoxFilter("Action", "1"),
        CheckBoxFilter("Adventure", "2"),
        // ... rest of your genre filters
      ]),
      // ... rest of your filters
    ];
  }

  @override
  List<dynamic> getSourcePreferences() {
    return [
      ListPreference(
        key: "preferred_quality",
        title: "Preferred Quality",
        summary: "",
        valueIndex: 1,
        entries: ["1080p", "720p", "480p", "360p"],
        entryValues: ["1080", "720", "480", "360"],
      ),
      // ... rest of your preferences
    ];
  }
}

NineAnimeTv main(MSource source) {
  return NineAnimeTv(source: source);
}
