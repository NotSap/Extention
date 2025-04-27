import 'package:anymex/main.dart';
import 'package:anymex/models/source.dart';
import 'package:html/parser.dart' show parse;
import 'dart:convert';
import 'package:http/http.dart' as http;

const baseUrl = "https://9animetv.to";

class NineAnimeTV extends AnimeSource {
  @override
  String get name => "NineAnimeTV";

  @override
  String get lang => "en";

  @override
  Future<List<AnimeItem>> search(String query) async {
    try {
      final response = await http.get(Uri.parse("$baseUrl/search?keyword=$query"));
      final doc = parse(response.body);
      final animeItems = <AnimeItem>[];

      for (var element in doc.querySelectorAll('.film-list .film-item, .anime-list .anime-item')) {
        final title = element.querySelector('.film-name, .anime-title')?.text?.trim() ?? '';
        final href = element.querySelector('a')?.attributes['href']?.trim() ?? '';
        final thumbnail = element.querySelector('img')?.attributes['src']?.trim() ?? '';

        if (title.isNotEmpty && href.isNotEmpty) {
          animeItems.add(AnimeItem(
            href,
            name: title,
            thumbnail: thumbnail.startsWith('http') ? thumbnail : '$baseUrl$thumbnail',
          ));
        }
      }
      return animeItems;
    } catch (e) {
      print('Search error: $e');
      return [];
    }
  }

  @override
  Future<List<AnimeItem>> getHomePage() async {
    try {
      final response = await http.get(Uri.parse(baseUrl));
      final doc = parse(response.body);
      final animeItems = <AnimeItem>[];

      for (var element in doc.querySelectorAll('.trending-list .film-item, .popular-list .film-item')) {
        final title = element.querySelector('.film-name')?.text?.trim() ?? '';
        final href = element.querySelector('a')?.attributes['href']?.trim() ?? '';
        final thumbnail = element.querySelector('img')?.attributes['src']?.trim() ?? '';

        if (title.isNotEmpty && href.isNotEmpty) {
          animeItems.add(AnimeItem(
            href,
            name: title,
            thumbnail: thumbnail.startsWith('http') ? thumbnail : '$baseUrl$thumbnail',
          ));
        }
      }
      return animeItems;
    } catch (e) {
      print('Home page error: $e');
      return [];
    }
  }

  @override
  Future<List<Episode>> getEpisodeList(String url) async {
    try {
      final response = await http.get(Uri.parse('$baseUrl$url'));
      final doc = parse(response.body);
      final episodes = <Episode>[];

      for (var element in doc.querySelectorAll('.episode-list .ep-item, [data-episode-id]')) {
        final id = element.attributes['data-id'] ?? 
                  element.attributes['data-episode-id'] ?? 
                  element.attributes['href']?.split('/').lastWhere((e) => e.isNotEmpty) ?? 
                  '';
        final title = element.querySelector('.episode-title')?.text?.trim() ?? '';
        final number = element.querySelector('.episode-number')?.text?.trim() ?? 
                      element.attributes['data-number']?.trim() ?? 
                      '${episodes.length + 1}';

        if (id.isNotEmpty) {
          episodes.add(Episode(
            '/watch/$id',
            name: title.isNotEmpty ? title : 'Episode $number',
            episodeNumber: number,
          ));
        }
      }

      // Sort episodes by number (ascending)
      episodes.sort((a, b) => a.episodeNumber.compareTo(b.episodeNumber));

      return episodes;
    } catch (e) {
      print('Episode list error: $e');
      return [];
    }
  }

  @override
  Future<List<Video>> getVideoList(String url) async {
    try {
      final response = await http.get(Uri.parse('$baseUrl$url'));
      final html = response.body;
      final doc = parse(html);
      final videos = <Video>[];

      // Method 1: Extract from script JSON
      final scriptContent = doc.querySelector('script:contains("sources")')?.text;
      if (scriptContent != null) {
        final match = RegExp(r'sources:\s*(\[[^\]]+\])').firstMatch(scriptContent);
        if (match != null) {
          try {
            final sources = json.decode(match.group(1)!) as List;
            for (final source in sources) {
              final url = source['file']?.toString();
              final quality = source['label']?.toString() ?? 'Unknown';
              if (url != null && url.isNotEmpty) {
                videos.add(Video(url, '$quality', url));
              }
            }
            if (videos.isNotEmpty) return videos;
          } catch (e) {
            print('JSON parse error: $e');
          }
        }
      }

      // Method 2: Check for iframes
      final iframe = doc.querySelector('iframe');
      if (iframe != null) {
        final src = iframe.attributes['src'] ?? '';
        if (src.isNotEmpty) {
          videos.add(Video(
            src.startsWith('http') ? src : 'https:$src',
            'Default',
            src,
          ));
          return videos;
        }
      }

      // Method 3: NineAnime-specific data attributes
      final playerData = doc.querySelector('[data-player]')?.attributes['data-player'];
      if (playerData != null) {
        try {
          final playerJson = json.decode(playerData);
          final videoUrl = playerJson['file']?.toString();
          if (videoUrl != null) {
            videos.add(Video(videoUrl, 'HD', videoUrl));
            return videos;
          }
        } catch (e) {
          print('Player data error: $e');
        }
      }

      // Method 4: Server items fallback
      for (var element in doc.querySelectorAll('.server-item')) {
        final videoUrl = element.attributes['data-video'];
        if (videoUrl != null && videoUrl.isNotEmpty) {
          videos.add(Video(videoUrl, 'Server', videoUrl));
        }
      }

      if (videos.isEmpty) {
        print('No videos found. Page content:');
        print(html.substring(0, 1000)); // Print first 1000 chars for debugging
      }

      return videos;
    } catch (e) {
      print('Video list error: $e');
      return [];
    }
  }
}

void main() {
  runApp(AnimeExtension(
    source: NineAnimeTV(),
  ));
}
