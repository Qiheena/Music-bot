const { BaseExtractor } = require('discord-player');
const play = require('play-dl');

class PlayDLExtractor extends BaseExtractor {
  static identifier = 'com.playernix.playdl';

  async activate() {
    this.protocols = ['playdl'];
  }

  async validate(query, type) {
    if (typeof query !== 'string') return false;
    
    if (query.includes('youtube.com') || query.includes('youtu.be')) {
      return true;
    }
    
    if (query.includes('soundcloud.com')) {
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
      console.log('[PlayDLExtractor] Handling query:', query);
      let searchResult;
      
      if (query.includes('youtube.com') || query.includes('youtu.be')) {
        console.log('[PlayDLExtractor] YouTube URL detected, fetching info...');
        const info = await play.video_basic_info(query);
        searchResult = [{
          url: info.video_details.url,
          title: info.video_details.title,
          duration: this.context.Util.buildTimeCode(this.context.Util.parseMS(info.video_details.durationInSec * 1000)),
          thumbnail: info.video_details.thumbnails[0]?.url,
          author: info.video_details.channel.name,
          views: info.video_details.views,
          source: 'youtube'
        }];
        console.log('[PlayDLExtractor] YouTube info fetched:', info.video_details.title);
      } 
      else if (query.includes('soundcloud.com')) {
        console.log('[PlayDLExtractor] SoundCloud URL detected, fetching info...');
        const info = await play.soundcloud(query);
        searchResult = [{
          url: info.url,
          title: info.name,
          duration: this.context.Util.buildTimeCode(this.context.Util.parseMS(info.durationInMs)),
          thumbnail: info.thumbnail,
          author: info.user.name,
          source: 'soundcloud'
        }];
        console.log('[PlayDLExtractor] SoundCloud info fetched:', info.name);
      }
      else {
        console.log('[PlayDLExtractor] Searching YouTube for:', query);
        const searched = await play.search(query, { limit: 10, source: { youtube: 'video' } });
        
        if (!searched || searched.length === 0) {
          console.error('[PlayDLExtractor] No search results found for:', query);
          return this.createResponse();
        }
        
        searchResult = searched.map(video => ({
          url: video.url,
          title: video.title,
          duration: this.context.Util.buildTimeCode(this.context.Util.parseMS(video.durationInSec * 1000)),
          thumbnail: video.thumbnails[0]?.url,
          author: video.channel.name,
          views: video.views,
          source: 'youtube'
        }));
        console.log('[PlayDLExtractor] Found', searchResult.length, 'results');
      }

      if (!searchResult || searchResult.length === 0) {
        console.error('[PlayDLExtractor] No results to process');
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

      console.log('[PlayDLExtractor] Created', tracks.length, 'track(s)');
      return this.createResponse(null, tracks);
    } 
    catch (error) {
      console.error('[PlayDLExtractor] Error in handle():', error.message);
      console.error('[PlayDLExtractor] Full error:', error);
      return this.createResponse();
    }
  }

  async stream(info) {
    try {
      console.log('[PlayDLExtractor] Attempting to stream:', info.url);
      
      const streamData = await play.stream(info.url, {
        quality: 1,
        discordPlayerCompatibility: true
      });
      
      if (!streamData || !streamData.stream) {
        throw new Error('Failed to get stream data from play-dl');
      }
      
      console.log('[PlayDLExtractor] Stream created successfully for:', info.title || info.url);
      return streamData.stream;
    } 
    catch (error) {
      console.error('[PlayDLExtractor] Stream error for URL:', info.url);
      console.error('[PlayDLExtractor] Error details:', error.message);
      console.error('[PlayDLExtractor] Full error:', error);
      throw new Error(`Failed to create audio stream: ${error.message}`);
    }
  }

  async getRelatedTracks(track) {
    return [];
  }
}

module.exports = PlayDLExtractor;
