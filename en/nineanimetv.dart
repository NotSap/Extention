import 'package:mangayomi/main.dart';  // Keep original imports
import 'package:mangayomi/models/source.dart';
import 'package:html/parser.dart' show parse;
import 'dart:convert';
import 'package:http/http.dart' as http;

const baseUrl = "https://9animetv.to";

class NineAnimeTV extends AnimeSource {
  // Keep all original properties/methods unchanged
  @override
  String get name => "NineAnimeTV";
  
  @override 
  String get lang => "en";
  
  // Keep original search() and getHomePage() methods exactly as they were
  
  // ONLY MODIFY THESE TWO METHODS FOR EPISODE LOADING:

  @override
  Future<List<Episode>> getEpisodeList(String url) async {
    try {
      final response = await http.get(Uri.parse('$baseUrl$url'));
      final doc = parse(response.body);
      final episodes = <Episode>[];
      
      // Modern NineAnime episode selector
      for (var element in doc.querySelectorAll('.ep-item, [data-episode-id]')) {
        final id = element.attributes['data-id'] ?? 
                 element.attributes['data-episode-id'] ??
                 element.attributes['href']?.split('/').lastWhere((e) => e.isNotEmpty) ?? '';
        final title = element.querySelector('.ep-title')?.text?.trim() ?? 'Episode';
        final number = element.querySelector('.ep-no')?.text?.trim() ?? 
                      element.attributes['data-number'] ?? 
                      '${episodes.length + 1}';
        
        if (id.isNotEmpty) {
          episodes.add(Episode(
            '/watch/$id',  // Match NineAnime's URL pattern
            name: title,
            episodeNumber: number,
          ));
        }
      }
      
      // Sort episodes naturally (S01E01, S01E02, etc.)
      episodes.sort((a, b) => a.episodeNumber.compareTo(b.episodeNumber));
      
      return episodes;
    } catch (e) {
      print('Episode Load Error: $e');
      return [];
    }
  }

  @override
  Future<List<Video>> getVideoList(String url) async {
    try {
      final response = await http.get(Uri.parse('$baseUrl$url'));
      final doc = parse(response.body);
      final videos = <Video>[];
      
      // 1. Check for NineAnime's new JS player
      final scriptContent = doc.querySelector('script:contains("sources")')?.text;
      if (scriptContent != null) {
        final match = RegExp(r'sources:\s*(\[[^\]]+\])').firstMatch(scriptContent);
        if (match != null) {
          try {
            final sources = json.decode(match.group(1)!) as List;
            for (final source in sources) {
              final url = source['file']?.toString();
              final quality = source['label']?.toString() ?? 'HD';
              if (url != null && url.isNotEmpty) {
                videos.add(Video(url, quality, url));
              }
            }
            if (videos.isNotEmpty) return videos;
          } catch (e) {
            print('JSON Parse Error: $e');
          }
        }
      }
      
      // 2. Fallback to iframe
      final iframeSrc = doc.querySelector('iframe')?.attributes['src'];
      if (iframeSrc != null && iframeSrc.isNotEmpty) {
        videos.add(Video(
          iframeSrc.startsWith('http') ? iframeSrc : 'https:$iframeSrc',
          'Default',
          iframeSrc
        ));
      }
      
      return videos;
    } catch (e) {
      print('Video Load Error: $e');
      return [];
    }
  }
}
