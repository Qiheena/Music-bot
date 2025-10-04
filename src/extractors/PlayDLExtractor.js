const { BaseExtractor } = require('discord-player');
const play = require('play-dl');
const logger = require('@QIHeena/logger');

class PlayDLExtractor extends BaseExtractor {
  static identifier = 'com.playernix.playdl';

  async activate() {
    this.protocols = ['playdl'];
  }

  async validate(query, type) {
    if (typeof query !== 'string') return false;
    
    // Skip SoundCloud URLs - let the official SoundCloudExtractor handle them
    if (query.includes('soundcloud.com')) {
      return false;
    }
    
    if (query.includes('youtube.com') || query.includes('youtu.be')) {
      return true;
    }
    
    if (type === this.context.QueryType.AUTO_SEARCH || 
        type === this.context.QueryType.SEARCH) {
      return true;
    }
    
    return false;
  }

  async handle(query, context) {
    try {
      logger.debug('[PlayDLExtractor] Handling query:', query);
      let searchResult;
      
      if (query.includes('youtube.com') || query.includes('youtu.be')) {
        logger.debug('[PlayDLExtractor] YouTube URL detected, fetching info...');
        const info = await play.video_basic_info(query);
        searchResult = [{
          url: info.video_details.url,
          title: info.video_details.title,
          duration: info.video_details.durationInSec * 1000,
          thumbnail: info.video_details.thumbnails[0]?.url,
          author: info.video_details.channel.name,
          views: info.video_details.views,
          source: 'youtube'
        }];
        logger.debug('[PlayDLExtractor] YouTube info fetched:', info.video_details.title);
      } 
      else {
        logger.debug('[PlayDLExtractor] Searching YouTube for:', query);
        const searched = await play.search(query, { limit: 10, source: { youtube: 'video' } });
        
        if (!searched || searched.length === 0) {
          logger.syserr('[PlayDLExtractor] No search results found for:', query);
          return this.createResponse();
        }
        
        searchResult = searched.map(video => ({
          url: video.url,
          title: video.title,
          duration: video.durationInSec * 1000,
          thumbnail: video.thumbnails[0]?.url,
          author: video.channel ? video.channel.name : 'Unknown',
          views: video.views,
          source: 'youtube'
        }));
        logger.debug('[PlayDLExtractor] Found', searchResult.length, 'results');
      }

      if (!searchResult || searchResult.length === 0) {
        logger.syserr('[PlayDLExtractor] No results to process');
        return this.createResponse();
      }

      const tracks = searchResult.map(track => 
        this.createTrack({
          title: track.title,
          url: track.url,
          duration: track.duration,
          thumbnail: track.thumbnail,
          author: track.author,
          views: track.views,
          requestedBy: context.requestedBy,
          source: track.source,
          engine: track.url,
          metadata: track
        })
      );

      logger.debug('[PlayDLExtractor] Created', tracks.length, 'track(s)');
      return this.createResponse(null, tracks);
    } 
    catch (error) {
      logger.syserr('[PlayDLExtractor] Error in handle():', error.message);
      logger.printErr(error);
      return this.createResponse();
    }
  }

  async stream(info) {
    try {
      logger.debug('[PlayDLExtractor] Attempting to stream:', info.url);
      
      const streamData = await play.stream(info.url, {
        quality: 1,
        discordPlayerCompatibility: true
      });
      
      if (!streamData || !streamData.stream) {
        throw new Error('Failed to get stream data from play-dl');
      }
      
      logger.debug('[PlayDLExtractor] Stream created successfully for:', info.title || info.url);
      return this.createStream(streamData.stream, { type: streamData.type });
    } 
    catch (error) {
      logger.syserr('[PlayDLExtractor] Stream error for URL:', info.url);
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
