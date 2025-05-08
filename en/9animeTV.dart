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
      final res = (await client.get(
        Uri.parse("${source.baseUrl}/ajax/episode/servers?episodeId=$url"),
      )).body;

      final html = json.decode(res)["html"];
      final serverElements = parseHtml(html).select("div.server-item");

      List<MVideo> videos = [];
      final hosterSelection = (getPreferenceValue(source.id, "hoster_selection") as List?)?.map((e) => e.toString().toLowerCase()).toList() ?? [];
      final typeSelection = (getPreferenceValue(source.id, "type_selection") as List?)?.map((e) => e.toString().toLowerCase()).toList() ?? [];

      for (var serverElement in serverElements) {
        final name = serverElement.text;
        final id = serverElement.attr("data-id");
        final subDub = serverElement.attr("data-type");

        final serverName = name.toString().toLowerCase();
        final serverType = subDub.toString().toLowerCase();

        if (!hosterSelection.contains(serverName)) continue;
        if (!typeSelection.contains(serverType)) continue;

        final sourceRes = (await client.get(
          Uri.parse("${source.baseUrl}/ajax/episode/sources?id=$id"),
        )).body;
        
        final videoUrl = json.decode(sourceRes)["link"];
        if (videoUrl == null || videoUrl.toString().isEmpty) continue;

        if (serverName.contains("vidstreaming") || serverName.contains("vidcloud")) {
          try {
            final extracted = await rapidCloudExtractor(videoUrl.toString(), "$name - $subDub");
            videos.addAll(extracted);
          } catch (e) {
            print("Error extracting from $name: $e");
          }
        } else {
          videos.add(MVideo()
            ..url = videoUrl.toString()
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
      final isMegacloud = url.toLowerCase().contains("megacloud");
      final baseUrl = isMegacloud ? "https://megacloud.tv" : "https://rapid-cloud.co";
      final apiPath = isMegacloud ? "/embed-2/ajax/e-1/getSources?id=" 
                                 : "/ajax/embed-6-v2/getSources?id=";
      
      final id = url.split("/").last.split("?").first;
      
      final response = await client.get(
        Uri.parse("$baseUrl$apiPath$id"),
        headers: {"X-Requested-With": "XMLHttpRequest"},
      );
      
      final jsonData = json.decode(response.body);
      final encrypted = jsonData["encrypted"] ?? false;
      String sourcesJson;

      if (encrypted) {
        final ciphertext = jsonData["sources"]?.toString() ?? "";
        sourcesJson = ciphertext; // In production, add decryption logic here
      } else {
        sourcesJson = json.encode(jsonData["sources"]);
      }

      final sources = (json.decode(sourcesJson) as List?) ?? [];
      if (sources.isEmpty) return [];

      final masterUrl = sources.first["file"]?.toString() ?? "";
      final type = sources.first["type"]?.toString()?.toLowerCase() ?? "mp4";

      if (type == "hls") {
        return await processHlsPlaylist(masterUrl, name);
      } else {
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
    final quality = getPreferenceValue(sourceId, "preferred_quality")?.toString() ?? "";
    final server = getPreferenceValue(sourceId, "preferred_server")?.toString() ?? "";
    final type = getPreferenceValue(sourceId, "preferred_type")?.toString() ?? "";
    
    videos.sort((a, b) {
      final aMatches = a.quality.toLowerCase().contains(quality.toLowerCase()) &&
          a.quality.toLowerCase().contains(type.toLowerCase()) &&
          a.quality.toLowerCase().contains(server.toLowerCase());
      
      final bMatches = b.quality.toLowerCase().contains(quality.toLowerCase()) &&
          b.quality.toLowerCase().contains(type.toLowerCase()) &&
          b.quality.toLowerCase().contains(server.toLowerCase());

      if (aMatches && !bMatches) return -1;
      if (!aMatches && bMatches) return 1;

      final aQuality = int.tryParse(RegExp(r'(\d+)p').firstMatch(a.quality)?.group(1) ?? '0') ?? 0;
      final bQuality = int.tryParse(RegExp(r'(\d+)p').firstMatch(b.quality)?.group(1) ?? '0') ?? 0;
      return bQuality.compareTo(aQuality);
    });
    return videos;
  }

  @override
  List<dynamic> getFilterList() {
    return [
      GroupFilter("GenreFilter", "Genre", [
        CheckBoxFilter("Action", "1"),
        CheckBoxFilter("Adventure", "2"),
        CheckBoxFilter("Cars", "3"),
        CheckBoxFilter("Comedy", "4"),
        CheckBoxFilter("Dementia", "5"),
        CheckBoxFilter("Demons", "6"),
        CheckBoxFilter("Drama", "8"),
        CheckBoxFilter("Ecchi", "9"),
        CheckBoxFilter("Fantasy", "10"),
        CheckBoxFilter("Game", "11"),
        CheckBoxFilter("Harem", "35"),
        CheckBoxFilter("Historical", "13"),
        CheckBoxFilter("Horror", "14"),
        CheckBoxFilter("Isekai", "44"),
        CheckBoxFilter("Josei", "43"),
        CheckBoxFilter("Kids", "15"),
        CheckBoxFilter("Magic", "16"),
        CheckBoxFilter("Martial Arts", "17"),
        CheckBoxFilter("Mecha", "18"),
        CheckBoxFilter("Military", "38"),
        CheckBoxFilter("Music", "19"),
        CheckBoxFilter("Mystery", "7"),
        CheckBoxFilter("Parody", "20"),
        CheckBoxFilter("Police", "39"),
        CheckBoxFilter("Psychological", "40"),
        CheckBoxFilter("Romance", "22"),
        CheckBoxFilter("Samurai", "21"),
        CheckBoxFilter("School", "23"),
        CheckBoxFilter("Sci-Fi", "24"),
        CheckBoxFilter("Seinen", "42"),
        CheckBoxFilter("Shoujo", "25"),
        CheckBoxFilter("Shoujo Ai", "26"),
        CheckBoxFilter("Shounen", "27"),
        CheckBoxFilter("Shounen Ai", "28"),
        CheckBoxFilter("Slice of Life", "36"),
        CheckBoxFilter("Space", "29"),
        CheckBoxFilter("Sports", "30"),
        CheckBoxFilter("Super Power", "31"),
        CheckBoxFilter("Supernatural", "37"),
        CheckBoxFilter("Thriller", "41"),
        CheckBoxFilter("Vampire", "32"),
      ]),
      GroupFilter("SeasonFilter", "Season", [
        CheckBoxFilter("Fall", "3"),
        CheckBoxFilter("Summer", "2"),
        CheckBoxFilter("Spring", "1"),
        CheckBoxFilter("Winter", "4"),
      ]),
      GroupFilter("YearFilter", "Year", [
        CheckBoxFilter("2024", "2024"),
        CheckBoxFilter("2023", "2023"),
        CheckBoxFilter("2022", "2022"),
        CheckBoxFilter("2021", "2021"),
        CheckBoxFilter("2020", "2020"),
        CheckBoxFilter("2019", "2019"),
        CheckBoxFilter("2018", "2018"),
        CheckBoxFilter("2017", "2017"),
        CheckBoxFilter("2016", "2016"),
        CheckBoxFilter("2015", "2015"),
        CheckBoxFilter("2014", "2014"),
        CheckBoxFilter("2013", "2013"),
        CheckBoxFilter("2012", "2012"),
        CheckBoxFilter("2011", "2011"),
        CheckBoxFilter("2010", "2010"),
        CheckBoxFilter("2009", "2009"),
        CheckBoxFilter("2008", "2008"),
        CheckBoxFilter("2007", "2007"),
        CheckBoxFilter("2006", "2006"),
        CheckBoxFilter("2005", "2005"),
        CheckBoxFilter("2004", "2004"),
        CheckBoxFilter("2003", "2003"),
        CheckBoxFilter("2002", "2002"),
        CheckBoxFilter("2001", "2001"),
      ]),
      SelectFilter("SortFilter", "Sort by", 0, [
        SelectFilterOption("All", "all"),
        SelectFilterOption("Default", "default"),
        SelectFilterOption("Recently Added", "recently_added"),
        SelectFilterOption("Recently Updated", "recently_updated"),
        SelectFilterOption("Score", "score"),
        SelectFilterOption("Name A-Z", "name_az"),
        SelectFilterOption("Released Date", "released_date"),
        SelectFilterOption("Most Watched", "most_watched"),
      ]),
      GroupFilter("TypeFilter", "Type", [
        CheckBoxFilter("Movie", "1"),
        CheckBoxFilter("TV Series", "2"),
        CheckBoxFilter("OVA", "3"),
        CheckBoxFilter("ONA", "4"),
        CheckBoxFilter("Special", "5"),
        CheckBoxFilter("Music", "6"),
      ]),
      SelectFilter("StatusFilter", "Status", 0, [
        SelectFilterOption("All", "all"),
        SelectFilterOption("Finished Airing", "1"),
        SelectFilterOption("Currently Airing", "2"),
        SelectFilterOption("Not yet aired", "3"),
      ]),
      GroupFilter("LanguageFilter", "Language", [
        CheckBoxFilter("Sub", "sub"),
        CheckBoxFilter("Dub", "dub"),
      ]),
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
      ListPreference(
        key: "preferred_server",
        title: "Preferred server",
        summary: "",
        valueIndex: 0,
        entries: ["Vidstreaming", "VidCloud"],
        entryValues: ["Vidstreaming", "VidCloud"],
      ),
      ListPreference(
        key: "preferred_type",
        title: "Preferred Type",
        summary: "",
        valueIndex: 0,
        entries: ["Sub", "Dub"],
        entryValues: ["sub", "dub"],
      ),
      MultiSelectListPreference(
        key: "hoster_selection",
        title: "Enable/Disable Hosts",
        summary: "",
        entries: ["Vidstreaming", "VidCloud"],
        entryValues: ["Vidstreaming", "Vidcloud"],
        values: ["Vidstreaming", "Vidcloud"],
      ),
      MultiSelectListPreference(
        key: "type_selection",
        title: "Enable/Disable Types",
        summary: "",
        entries: ["Sub", "Dub"],
        entryValues: ["sub", "dub"],
        values: ["sub", "dub"],
      ),
    ];
  }

  String ll(String url) {
    if (url.contains("?")) {
      return "&";
    }
    return "?";
  }
}

NineAnimeTv main(MSource source) {
  return NineAnimeTv(source: source);
}
