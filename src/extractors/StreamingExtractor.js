const { BaseExtractor, Track } = require('discord-player');
const play = require('play-dl');
const youtubeSr = require('youtube-sr').default;
const logger = require('@QIHeena/logger');

function msToTimeString(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

class StreamingExtractor extends BaseExtractor {
  static identifier = 'com.playernix.streaming';

  async activate() {
    this.protocols = ['streaming'];
  }

  async validate(query, type) {
    if (typeof query !== 'string') return false;
    
    if (query.includes('youtube.com') || query.includes('youtu.be')) {
      return true;
    }
    
    if (query.includes('soundcloud.com')) {
      return true;
    }
    
    if (type === this.context.QueryType.AUTO || 
        type === this.context.QueryType.YOUTUBE_SEARCH ||
        type === this.context.QueryType.YOUTUBE_VIDEO) {
      return true;
    }
    
    return false;
  }

  async handle(query, context) {
    try {
      let searchQuery = query;
      
      if (typeof query !== 'string' || !query) {
        logger.debug('[StreamingExtractor] Query is not a string, extracting from context/track');
        searchQuery = context?.track?.title || context?.title || '';
        if (!searchQuery) {
          logger.syserr('[StreamingExtractor] Could not extract query from context');
          return { playlist: null, tracks: [] };
        }
      }
      
      logger.debug('[StreamingExtractor] Handling query:', searchQuery);
      
      if (searchQuery.includes('youtube.com') || searchQuery.includes('youtu.be')) {
        logger.debug('[StreamingExtractor] YouTube URL detected');
        return await this.handleYouTubeUrl(searchQuery, context);
      }
      else if (searchQuery.includes('soundcloud.com')) {
        logger.debug('[StreamingExtractor] SoundCloud URL detected');
        return await this.handleSoundCloudUrl(searchQuery, context);
      }
      else {
        logger.debug('[StreamingExtractor] Search query detected, searching YouTube');
        return await this.handleSearch(searchQuery, context);
      }
    } catch (error) {
      logger.syserr('[StreamingExtractor] Error handling query:', error);
      return { playlist: null, tracks: [] };
    }
  }

  async handleYouTubeUrl(url, context) {
    try {
      const info = await play.video_basic_info(url);
      const durationMs = info.video_details.durationInSec * 1000;
      const track = this.createTrack({
        title: info.video_details.title,
        url: info.video_details.url,
        duration: msToTimeString(durationMs),
        durationMs: durationMs,
        thumbnail: info.video_details.thumbnails[0]?.url || '',
        author: info.video_details.channel.name,
        views: info.video_details.views,
        source: 'youtube',
        streamingMode: 'direct',
        requestedBy: context.requestedBy,
        queryType: context.type
      });
      
      logger.debug('[StreamingExtractor] YouTube track created for streaming:', info.video_details.title);
      return { playlist: null, tracks: [track] };
    } catch (error) {
      logger.syserr('[StreamingExtractor] Failed to fetch YouTube info:', error.message);
      return { playlist: null, tracks: [] };
    }
  }

  async handleSoundCloudUrl(url, context) {
    try {
      const scInfo = await play.soundcloud(url);
      const durationMs = scInfo.durationInMs;
      
      const track = this.createTrack({
        title: scInfo.name,
        url: scInfo.url,
        duration: msToTimeString(durationMs),
        durationMs: durationMs,
        thumbnail: scInfo.thumbnail,
        author: scInfo.user?.name || scInfo.publisher?.[0]?.name || 'Unknown',
        views: scInfo.playCount || 0,
        source: 'soundcloud',
        streamingMode: 'direct',
        requestedBy: context.requestedBy,
        queryType: context.type
      });
      
      logger.debug('[StreamingExtractor] SoundCloud track created for direct streaming:', scInfo.name);
      return { playlist: null, tracks: [track] };
    } catch (error) {
      logger.syserr('[StreamingExtractor] Failed to handle SoundCloud URL, trying YouTube fallback:', error.message);
      
      try {
        const searchTerm = `${error.message?.includes('title') ? url.split('/').pop().replace(/-/g, ' ') : 'soundcloud ' + url.split('/').pop().replace(/-/g, ' ')}`;
        logger.debug('[StreamingExtractor] SoundCloud→YouTube fallback search:', searchTerm);
        return await this.handleSearch(searchTerm, context);
      } catch (fallbackError) {
        logger.syserr('[StreamingExtractor] SoundCloud→YouTube fallback also failed:', fallbackError.message);
        return { playlist: null, tracks: [] };
      }
    }
  }

  async handleSearch(searchQuery, context) {
    try {
      let searched = null;
      
      try {
        searched = await play.search(searchQuery, { limit: 10, source: { youtube: 'video' } });
        logger.debug('[StreamingExtractor] PlayDL search found', searched?.length || 0, 'results');
      } catch (err) {
        logger.debug('[StreamingExtractor] PlayDL search failed, trying youtube-sr:', err.message);
        
        try {
          const ytSrResults = await youtubeSr.search(searchQuery, { limit: 10, type: 'video' });
          if (ytSrResults && ytSrResults.length > 0) {
            searched = ytSrResults.map(video => {
              let durationSec = 0;
              if (video.duration) {
                if (typeof video.duration === 'number') {
                  durationSec = video.duration;
                } else if (video.duration.seconds) {
                  durationSec = video.duration.seconds;
                } else if (typeof video.duration === 'string') {
                  const parts = video.duration.split(':').map(Number);
                  if (parts.length === 3) {
                    durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
                  } else if (parts.length === 2) {
                    durationSec = parts[0] * 60 + parts[1];
                  }
                }
              }
              
              return {
                title: video.title,
                url: video.url,
                durationInSec: durationSec,
                thumbnails: [{ url: video.thumbnail?.url || '' }],
                channel: { name: video.channel?.name || 'Unknown', verified: video.channel?.verified || false },
                views: video.views || 0
              };
            });
            logger.debug('[StreamingExtractor] youtube-sr fallback found', searched.length, 'results');
          }
        } catch (srErr) {
          logger.syserr('[StreamingExtractor] youtube-sr also failed:', srErr.message);
        }
      }
      
      if (!searched || searched.length === 0) {
        logger.syserr('[StreamingExtractor] No search results found for:', searchQuery);
        return { playlist: null, tracks: [] };
      }

      const topResult = searched[0];
      const durationMs = (topResult.durationInSec || 0) * 1000;
      
      const track = this.createTrack({
        title: topResult.title,
        url: topResult.url,
        duration: msToTimeString(durationMs),
        durationMs: durationMs,
        thumbnail: topResult.thumbnails?.[0]?.url || '',
        author: topResult.channel?.name || 'Unknown',
        views: topResult.views || 0,
        source: 'youtube',
        streamingMode: 'direct',
        requestedBy: context.requestedBy,
        queryType: context.type
      });
      
      logger.debug('[StreamingExtractor] Created track from search for streaming:', topResult.title);
      return { playlist: null, tracks: [track] };
    } catch (error) {
      logger.syserr('[StreamingExtractor] Search failed:', error.message);
      return { playlist: null, tracks: [] };
    }
  }

  createTrack(data) {
    const track = new Track(this.context.player, {
      title: data.title,
      url: data.url,
      duration: data.duration,
      thumbnail: data.thumbnail,
      author: data.author,
      views: data.views,
      requestedBy: data.requestedBy,
      source: data.source,
      queryType: data.queryType
    });
    track.extractor = this;
    track.raw = { 
      originalUrl: data.url, 
      streamingMode: data.streamingMode,
      source: data.source,
      durationMS: data.durationMs
    };
    return track;
  }

  async stream(info) {
    try {
      const url = info.url || info.raw?.originalUrl;
      const source = info.raw?.source || 'youtube';
      
      if (!url) {
        throw new Error('No URL provided for streaming');
      }
      
      logger.info('[StreamingExtractor] Starting direct stream for:', { url, source });
      
      try {
        logger.debug('[StreamingExtractor] Trying play-dl streaming first');
        const stream = await play.stream(url, { discordPlayerCompatibility: true });
        logger.debug('[StreamingExtractor] play-dl stream created successfully');
        return {
          stream: stream.stream,
          type: stream.type
        };
      } catch (playDlError) {
        logger.debug('[StreamingExtractor] play-dl failed, trying yt-dlp fallback:', playDlError.message);
      }
      
      logger.debug('[StreamingExtractor] Using yt-dlp for streaming');
      const { spawn } = require('child_process');
      const { PassThrough } = require('stream');
      
      const ytdlpProcess = spawn('yt-dlp', [
        '-f', 'bestaudio/best',
        '--no-warnings',
        '--no-check-certificates',
        '--geo-bypass',
        '--no-playlist',
        '--extractor-args', 'youtube:player_client=android',
        '--hls-use-mpegts',
        '-o', '-',
        url
      ]);
      
      const stream = new PassThrough();
      ytdlpProcess.stdout.pipe(stream);
      
      stream.on('error', (err) => {
        logger.debug('[StreamingExtractor] Stream error caught:', err.message);
      });
      
      let stderrOutput = '';
      
      ytdlpProcess.stderr.on('data', (data) => {
        const message = data.toString().trim();
        stderrOutput += message + '\n';
        if (message) {
          logger.debug('[StreamingExtractor] yt-dlp:', message);
        }
      });
      
      ytdlpProcess.on('error', (error) => {
        logger.syserr('[StreamingExtractor] yt-dlp process error:', error.message);
        const err = new Error(`yt-dlp process error: ${error.message}`);
        stream.destroy(err);
      });
      
      ytdlpProcess.on('close', (code) => {
        if (code !== 0 && code !== null) {
          const errorMessage = stderrOutput.includes('ERROR') 
            ? stderrOutput.split('ERROR:').pop().split('\n')[0].trim()
            : `yt-dlp exited with code ${code}`;
          logger.syserr('[StreamingExtractor] yt-dlp failed:', errorMessage);
          const err = new Error(`YouTube streaming failed: ${errorMessage}`);
          if (!stream.destroyed) {
            stream.destroy(err);
          }
        }
      });
      
      logger.debug('[StreamingExtractor] yt-dlp stream created successfully');
      return {
        stream: stream,
        type: 'arbitrary'
      };
    } catch (error) {
      logger.syserr('[StreamingExtractor] Direct streaming failed:', error.message);
      throw error;
    }
  }
}

module.exports = StreamingExtractor;
