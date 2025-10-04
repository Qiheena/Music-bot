const { BaseExtractor, Track } = require('discord-player');
const play = require('play-dl');
const logger = require('@QIHeena/logger');

class PlayDLExtractor extends BaseExtractor {
  static identifier = 'com.playernix.playdl';

  async activate() {
    this.protocols = ['playdl'];
  }

  async validate(query, type) {
    if (typeof query !== 'string') return false;
    
    if (query.includes('soundcloud.com') || 
        query.includes('spotify.com') ||
        query.includes('apple.com') ||
        query.includes('vimeo.com')) {
      return false;
    }
    
    if (query.includes('youtube.com') || query.includes('youtu.be')) {
      return true;
    }
    
    if (type === this.context.QueryType.AUTO_SEARCH || 
        type === this.context.QueryType.SEARCH ||
        type === this.context.QueryType.YOUTUBE_SEARCH) {
      return true;
    }
    
    return false;
  }

  async handle(query, context) {
    try {
      let searchQuery = query;
      
      if (typeof query !== 'string' || !query) {
        logger.debug('[PlayDLExtractor] Query is not a string, extracting from context/track');
        searchQuery = context?.track?.title || context?.title || '';
        if (!searchQuery) {
          logger.syserr('[PlayDLExtractor] Could not extract query from context');
          return { playlist: null, tracks: [] };
        }
      }
      
      logger.debug('[PlayDLExtractor] Handling query:', searchQuery);
      let searchResult;
      
      if (searchQuery.includes('youtube.com') || searchQuery.includes('youtu.be')) {
        logger.debug('[PlayDLExtractor] YouTube URL detected, fetching info...');
        const info = await play.video_basic_info(searchQuery);
        const track = new Track(this.context.player, {
          title: info.video_details.title,
          url: info.video_details.url,
          duration: info.video_details.durationInSec * 1000,
          thumbnail: info.video_details.thumbnails[0]?.url || '',
          author: info.video_details.channel.name,
          views: info.video_details.views,
          requestedBy: context.requestedBy,
          source: 'youtube',
          queryType: context.type
        });
        track.extractor = this;
        logger.debug('[PlayDLExtractor] YouTube info fetched:', info.video_details.title);
        return { playlist: null, tracks: [track] };
      } 
      else {
        logger.debug('[PlayDLExtractor] Searching YouTube for:', searchQuery);
        const searched = await play.search(searchQuery, { limit: 10, source: { youtube: 'video' } });
        
        if (!searched || searched.length === 0) {
          logger.syserr('[PlayDLExtractor] No search results found for:', searchQuery);
          return { playlist: null, tracks: [] };
        }
        
        searchResult = searched.map(video => {
          const titleLower = (video.title || '').toLowerCase();
          const isOfficialAudio = titleLower.includes('official audio') || titleLower.includes('official lyric');
          const isOfficialVideo = titleLower.includes('official video') || titleLower.includes('official music video');
          const isTopic = video.channel && video.channel.name && video.channel.name.includes('- Topic');
          
          let relevanceScore = 0;
          if (isTopic) relevanceScore += 100;
          if (isOfficialAudio) relevanceScore += 80;
          if (isOfficialVideo) relevanceScore += 60;
          if (video.channel && video.channel.verified) relevanceScore += 40;
          
          return {
            url: video.url,
            title: video.title,
            duration: video.durationInSec * 1000,
            thumbnail: video.thumbnails[0]?.url,
            author: video.channel ? video.channel.name : 'Unknown',
            views: video.views,
            source: 'youtube',
            relevanceScore
          };
        }).sort((a, b) => b.relevanceScore - a.relevanceScore);
        
        logger.debug('[PlayDLExtractor] Found', searchResult.length, 'results, top result:', searchResult[0]?.title);
      }

      if (!searchResult || searchResult.length === 0) {
        logger.syserr('[PlayDLExtractor] No results to process');
        return { playlist: null, tracks: [] };
      }

      const tracks = searchResult.map(trackData => {
        const track = new Track(this.context.player, {
          title: trackData.title,
          url: trackData.url,
          duration: trackData.duration,
          thumbnail: trackData.thumbnail || '',
          author: trackData.author,
          views: trackData.views,
          requestedBy: context.requestedBy,
          source: 'youtube',
          queryType: context.type
        });
        track.extractor = this;
        return track;
      });

      logger.debug('[PlayDLExtractor] Created', tracks.length, 'track(s)');
      return { playlist: null, tracks };
    } 
    catch (error) {
      logger.syserr('[PlayDLExtractor] Error in handle():', error.message);
      logger.printErr(error);
      return { playlist: null, tracks: [] };
    }
  }

  async streamFromPlatform(url, platform) {
    const timeout = 15000;
    
    const streamPromise = play.stream(url, {
      quality: 2,
      discordPlayerCompatibility: true
    });
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`${platform} stream timeout after ${timeout}ms`)), timeout)
    );
    
    try {
      const streamData = await Promise.race([streamPromise, timeoutPromise]);
      
      if (!streamData || !streamData.stream) {
        throw new Error(`Failed to get stream data from ${platform}`);
      }
      
      logger.debug(`[PlayDLExtractor] ✓ ${platform} stream created successfully`);
      return { streamData, platform };
    } catch (error) {
      logger.debug(`[PlayDLExtractor] ✗ ${platform} stream failed:`, error.message);
      throw error;
    }
  }

  async stream(info) {
    try {
      logger.debug('[PlayDLExtractor] Attempting to stream:', info.url);
      logger.debug('[PlayDLExtractor] Track title:', info.title);
      
      const searchQuery = info.title || info.url;
      const streamAttempts = [];
      
      if (info.url.includes('youtube.com') || info.url.includes('youtu.be')) {
        logger.debug('[PlayDLExtractor] Direct YouTube URL, streaming immediately...');
        const streamData = await this.streamFromPlatform(info.url, 'YouTube');
        return this.createStream(streamData.streamData.stream, { type: streamData.streamData.type });
      }
      
      logger.debug('[PlayDLExtractor] Parallel search starting on multiple platforms...');
      
      const youtubeSearch = play.search(searchQuery, { limit: 1, source: { youtube: 'video' } })
        .then(results => {
          if (results && results.length > 0) {
            logger.debug('[PlayDLExtractor] YouTube found:', results[0].title);
            return this.streamFromPlatform(results[0].url, 'YouTube');
          }
          throw new Error('YouTube search returned no results');
        })
        .catch(err => {
          logger.debug('[PlayDLExtractor] YouTube search/stream failed:', err.message);
          throw err;
        });
      
      streamAttempts.push(youtubeSearch);
      
      const soundcloudValidate = play.so_validate(searchQuery);
      if (soundcloudValidate === 'search') {
        const soundcloudSearch = play.search(searchQuery, { limit: 1, source: { soundcloud: 'tracks' } })
          .then(results => {
            if (results && results.length > 0) {
              logger.debug('[PlayDLExtractor] SoundCloud found:', results[0].title);
              return this.streamFromPlatform(results[0].url, 'SoundCloud');
            }
            throw new Error('SoundCloud search returned no results');
          })
          .catch(err => {
            logger.debug('[PlayDLExtractor] SoundCloud search/stream failed:', err.message);
            throw err;
          });
        
        streamAttempts.push(soundcloudSearch);
      }
      
      logger.debug(`[PlayDLExtractor] Racing ${streamAttempts.length} platform(s)...`);
      
      const winner = await Promise.any(streamAttempts).catch(aggregateError => {
        logger.syserr('[PlayDLExtractor] All platforms failed!');
        aggregateError.errors.forEach((err, i) => {
          logger.syserr(`  Platform ${i + 1}:`, err.message);
        });
        throw new Error('⚠️ Could not stream from any platform. All sources failed or timed out.');
      });
      
      logger.debug(`[PlayDLExtractor] ✓ Winner: ${winner.platform} - streaming now`);
      return this.createStream(winner.streamData.stream, { type: winner.streamData.type });
    } 
    catch (error) {
      logger.syserr('[PlayDLExtractor] Stream error for:', info.title || info.url);
      logger.syserr('[PlayDLExtractor] Error details:', error.message);
      logger.printErr(error);
      throw new Error(`Failed to create audio stream: ${error.message}`);
    }
  }

  async getRelatedTracks(track) {
    return [];
  }
}

module.exports = PlayDLExtractor;
