// CORRECT IMPORTS FOR ANYMEX EXTENSIONS
import 'package:anymex_extension/anymex_extension.dart';
import 'package:html/parser.dart' show parse;
import 'dart:convert';
import 'package:http/http.dart';

class NineAnimeTV extends AnimeSource {
  @override
  final String name = "NineAnimeTV";
  @override 
  final String lang = "en";
  final String baseUrl = "https://9animetv.to";

  // 1. Your existing working search() method
  @override
  Future<List<AnimeItem>> search(String query) async {
    // ... paste your working search implementation here ...
    // Keep it exactly as is since you said it works
  }

  // 2. Fixed episode loader
  @override
  Future<List<Episode>> getEpisodeList(String url) async {
    try {
      final response = await get(Uri.parse('$baseUrl$url'));
      final doc = parse(response.body);
      final episodes = <Episode>[];
      
      // Modern NineAnime selectors with fallbacks
      for (var element in doc.querySelectorAll('[data-id], .episode-item')) {
        try {
          final id = element.attributes['data-id'] ?? 
                   element.id ??
                   '';
          final title = element.querySelector('.ep-title')?.text ?? 'Episode';
          final number = element.querySelector('.episode-number')?.text ?? 
                        element.attributes['data-number'] ?? 
                        '${episodes.length + 1}';
          
          if (id.isNotEmpty) {
            episodes.add(Episode(
              '/ajax/server/$id', // NineAnime API pattern
              name: title,
              episodeNumber: number,
            ));
          }
        } catch (e) {
          print('Error parsing episode: $e');
        }
      }
      
      // Sort episodes naturally
      episodes.sort((a, b) => int.parse(a.episodeNumber).compareTo(int.parse(b.episodeNumber)));
      
      return episodes;
    } catch (e) {
      print('Episode load failed: $e');
      return [];
    }
  }

  // 3. Fixed video loader
  @override
  Future<List<Video>> getVideoList(String url) async {
    try {
      // Handle both direct and API URLs
      final isApiCall = url.contains('/ajax/server');
      final requestUrl = isApiCall ? '$baseUrl$url' : '$baseUrl/ajax/server$url';
      
      final response = await get(Uri.parse(requestUrl));
      final doc = parse(response.body);
      final videos = <Video>[];
      
      // Primary method: iframe extraction
      final iframe = doc.querySelector('iframe');
      if (iframe != null) {
        final src = iframe.attributes['src'] ?? '';
        if (src.isNotEmpty) {
          videos.add(Video(
            src.startsWith('http') ? src : 'https:$src',
            'Default',
            src
          ));
          return videos;
        }
      }
      
      // Fallback: direct video
      final videoSrc = doc.querySelector('video source')?.attributes['src'];
      if (videoSrc != null) {
        videos.add(Video(videoSrc, 'Direct', videoSrc));
      }
      
      return videos;
    } catch (e) {
      print('Video load failed: $e');
      return [];
    }
  }
}

void main() => runAnymexExtension(NineAnimeTV());
