import 'package:mangayomi/bridge_lib.dart';
import 'dart:convert';

class KissKh extends MProvider {
  KissKh({required this.source});

  MSource source;
  final Client client = Client();

  @override
  Future<MPages> getPopular(int page) async {
    try {
      final response = await client.get(
        Uri.parse(
          "${source.baseUrl}/api/DramaList/List?page=$page&type=0&sub=0&country=0&status=0&order=1&pageSize=40",
        ),
      );
      
      if (response.body.isEmpty) return MPages([], false);
      
      final jsonRes = json.decode(response.body);
      final datas = jsonRes["data"] as List? ?? [];
      
      List<MManga> animeList = [];
      for (var data in datas) {
        try {
          var anime = MManga();
          anime.name = data["title"]?.toString() ?? "Unknown";
          anime.imageUrl = data["thumbnail"]?.toString() ?? "";
          anime.link = "${source.baseUrl}/api/DramaList/Drama/${data["id"]}?isq=false";
          animeList.add(anime);
        } catch (e) {
          print("Error processing anime item: $e");
        }
      }

      return MPages(animeList, (jsonRes["page"] ?? 1) < (jsonRes["totalCount"] ?? 1));
    } catch (e) {
      print("Error in getPopular: $e");
      return MPages([], false);
    }
  }

  @override
  Future<MPages> getLatestUpdates(int page) async {
    try {
      final response = await client.get(
        Uri.parse(
          "${source.baseUrl}/api/DramaList/List?page=$page&type=0&sub=0&country=0&status=0&order=12&pageSize=40",
        ),
      );
      
      if (response.body.isEmpty) return MPages([], false);
      
      final jsonRes = json.decode(response.body);
      final datas = jsonRes["data"] as List? ?? [];
      
      List<MManga> animeList = [];
      for (var data in datas) {
        try {
          var anime = MManga();
          anime.name = data["title"]?.toString() ?? "Unknown";
          anime.imageUrl = data["thumbnail"]?.toString() ?? "";
          anime.link = "${source.baseUrl}/api/DramaList/Drama/${data["id"]}?isq=false";
          animeList.add(anime);
        } catch (e) {
          print("Error processing anime item: $e");
        }
      }

      return MPages(animeList, (jsonRes["page"] ?? 1) < (jsonRes["totalCount"] ?? 1));
    } catch (e) {
      print("Error in getLatestUpdates: $e");
      return MPages([], false);
    }
  }

  @override
  Future<MPages> search(String query, int page, FilterList filterList) async {
    try {
      final response = await client.get(
        Uri.parse("${source.baseUrl}/api/DramaList/Search?q=$query&type=0"),
      );
      
      if (response.body.isEmpty) return MPages([], false);
      
      // Fix for search JSON parsing
      final jsonRes = json.decode(response.body);
      final items = jsonRes is List ? jsonRes : (jsonRes["data"] as List? ?? []);
      
      List<MManga> animeList = [];
      for (var data in items) {
        try {
          var anime = MManga();
          anime.name = data["title"]?.toString() ?? "Unknown";
          anime.imageUrl = data["thumbnail"]?.toString() ?? "";
          anime.link = "${source.baseUrl}/api/DramaList/Drama/${data["id"]}?isq=false";
          animeList.add(anime);
        } catch (e) {
          print("Error processing search result: $e");
        }
      }
      return MPages(animeList, false);
    } catch (e) {
      print("Error in search: $e");
      return MPages([], false);
    }
  }

  @override
  Future<MManga> getDetail(String url) async {
    try {
      final response = await client.get(Uri.parse(url));
      if (response.body.isEmpty) return MManga();
      
      final jsonRes = json.decode(response.body);
      var anime = MManga();
      
      final statusList = [{"Ongoing": 0, "Completed": 1}];
      final status = jsonRes["status"]?.toString() ?? "";
      anime.description = jsonRes["description"]?.toString() ?? "";
      anime.status = parseStatus(status, statusList);
      anime.imageUrl = jsonRes["thumbnail"]?.toString() ?? "";
      
      var episodes = (jsonRes["episodes"] as List?) ?? [];
      String type = jsonRes["type"]?.toString() ?? "";
      final episodesCount = (jsonRes["episodesCount"] as int?) ?? 0;
      
      final containsAnime = type.contains("Anime");
      final containsTVSeries = type.contains("TVSeries");
      final containsHollywood = type.contains("Hollywood");
      final containsMovie = type.contains("Movie");
      
      List<MChapter> episodesList = [];
      for (var a in episodes) {
        try {
          MChapter episode = MChapter();
          String number = ((a["number"] as num?)?.toString() ?? "0").replaceAll(".0", "");
          final id = a["id"]?.toString() ?? "";
          
          if (containsAnime || containsTVSeries) {
            episode.name = "Episode $number";
          } else if ((containsHollywood && episodesCount == 1) || containsMovie) {
            episode.name = "Movie";
          } else if (containsHollywood && episodesCount > 1) {
            episode.name = "Episode $number";
          }
          
          episode.url = "${source.baseUrl}/api/DramaList/Episode/$id.png?err=false&ts=&time=";
          episodesList.add(episode);
        } catch (e) {
          print("Error processing episode: $e");
        }
      }

      anime.chapters = episodesList;
      return anime;
    } catch (e) {
      print("Error in getDetail: $e");
      return MManga();
    }
  }

  @override
  Future<List<MVideo>> getVideoList(String url) async {
    try {
      // Get video data
      final videoResponse = await client.get(Uri.parse(url));
      if (videoResponse.body.isEmpty) return [];
      
      final id = substringAfter(substringBefore(url, ".png"), "Episode/");
      final jsonRes = json.decode(videoResponse.body);
      
      // Get subtitles
      List<MTrack> subtitles = [];
      try {
        final subResponse = await client.get(Uri.parse("${source.baseUrl}/api/Sub/$id"));
        if (subResponse.body.isNotEmpty) {
          var jsonSubRes = (json.decode(subResponse.body) as List? ?? [];
          for (var sub in jsonSubRes) {
            try {
              final subUrl = sub["src"]?.toString() ?? "";
              final label = sub["label"]?.toString() ?? "Unknown";
              if (subUrl.endsWith("txt")) {
                var subtitle = await getSubtitle(subUrl, label);
                subtitles.add(subtitle);
              } else {
                var subtitle = MTrack();
                subtitle
                  ..label = label
                  ..file = subUrl;
                subtitles.add(subtitle);
              }
            } catch (e) {
              print("Error processing subtitle: $e");
            }
          }
        }
      } catch (e) {
        print("Error fetching subtitles: $e");
      }

      final videoUrl = jsonRes["Video"]?.toString() ?? "";
      if (videoUrl.isEmpty) return [];
      
      var video = MVideo();
      video
        ..url = videoUrl
        ..originalUrl = videoUrl
        ..quality = "kisskh"
        ..subtitles = subtitles
        ..headers = {
          "referer": "https://kisskh.me/",
          "origin": "https://kisskh.me",
        };
      return [video];
    } catch (e) {
      print("Error in getVideoList: $e");
      return [];
    }
  }

  Future<MTrack> getSubtitle(String subUrl, String subLang) async {
    try {
      final response = await client.get(
        Uri.parse(subUrl),
        headers: {"referer": "https://kisskh.me/", "origin": "https://kisskh.me"},
      );
      if (response.body.isEmpty) return MTrack()..label = subLang..file = "";
      
      String decrypted = "\n";
      for (String line in response.body.split('\n')) {
        decrypted += "${decrypt(line.trim())}\n";
      }
      
      var subtitle = MTrack();
      subtitle
        ..label = subLang
        ..file = decrypted;
      return subtitle;
    } catch (e) {
      print("Error in getSubtitle: $e");
      return MTrack()..label = subLang..file = "";
    }
  }

  String decrypt(String data) {
    try {
      final key = utf8.decode([56,48,53,54,52,56,51,54,52,54,51,50,56,55,54,51]);
      final iv = utf8.decode([54,56,53,50,54,49,50,51,55,48,49,56,53,50,55,51]);
      return cryptoHandler(data, iv, key, false);
    } catch (e) {
      print("Error in decrypt: $e");
      return data;
    }
  }
}

KissKh main(MSource source) {
  return KissKh(source: source);
}
