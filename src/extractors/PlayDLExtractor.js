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
      let searchResult;
      
      if (query.includes('youtube.com') || query.includes('youtu.be')) {
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
      } 
      else if (query.includes('soundcloud.com')) {
        const info = await play.soundcloud(query);
        searchResult = [{
          url: info.url,
          title: info.name,
          duration: this.context.Util.buildTimeCode(this.context.Util.parseMS(info.durationInMs)),
          thumbnail: info.thumbnail,
          author: info.user.name,
          source: 'soundcloud'
        }];
      }
      else {
        const searched = await play.search(query, { limit: 10, source: { youtube: 'video' } });
        
        searchResult = searched.map(video => ({
          url: video.url,
          title: video.title,
          duration: this.context.Util.buildTimeCode(this.context.Util.parseMS(video.durationInSec * 1000)),
          thumbnail: video.thumbnails[0]?.url,
          author: video.channel.name,
          views: video.views,
          source: 'youtube'
        }));
      }

      if (!searchResult || searchResult.length === 0) {
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

      return this.createResponse(null, tracks);
    } 
    catch (error) {
      console.error('[PlayDLExtractor] Error:', error);
      return this.createResponse();
    }
  }

  async stream(info) {
    try {
      const streamData = await play.stream(info.url, {
        quality: 2,
        discordPlayerCompatibility: true
      });
      
      return streamData.stream;
    } 
    catch (error) {
      console.error('[PlayDLExtractor] Stream error:', error);
      throw error;
    }
  }

  async getRelatedTracks(track) {
    return [];
  }
}

module.exports = PlayDLExtractor;
