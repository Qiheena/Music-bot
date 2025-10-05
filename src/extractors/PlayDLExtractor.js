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
    
    if (query.includes('soundcloud.com') || query.includes('spotify.com')) {
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
      const guildId = context?.guildId || 'default';
      
      if (typeof query !== 'string' || !query) {
        logger.debug('[PlayDLExtractor] Query is not a string, extracting from context/track');
        searchQuery = context?.track?.title || context?.title || '';
        if (!searchQuery) {
          logger.syserr('[PlayDLExtractor] Could not extract query from context');
          return { playlist: null, tracks: [] };
        }
      }
      
      logger.debug('[PlayDLExtractor] Handling query:', searchQuery.substring(0, 100));
      
      if (searchQuery.includes('youtube.com') || searchQuery.includes('youtu.be')) {
        logger.debug('[PlayDLExtractor] YouTube URL detected');
        return await this.handleYouTubeUrl(searchQuery, context, guildId);
      }
      else if (searchQuery.includes('spotify.com')) {
        logger.debug('[PlayDLExtractor] Spotify URL detected');
        return await this.handleSpotify(searchQuery, context, guildId);
      }
      else if (searchQuery.includes('soundcloud.com')) {
        logger.debug('[PlayDLExtractor] SoundCloud URL detected');
        return await this.handleSoundCloud(searchQuery, context, guildId);
      }
      else {
        logger.debug('[PlayDLExtractor] Search query detected');
        return await this.handleSearch(searchQuery, context, false, guildId);
      }
    } catch (error) {
      logger.syserr('[PlayDLExtractor] Error handling query:', error);
      return { playlist: null, tracks: [] };
    }
  }

  async handleYouTubeUrl(url, context, guildId) {
    try {
      if (url.includes('list=')) {
        logger.debug('[PlayDLExtractor] URL contains playlist parameter, attempting playlist extraction');
        const playlistResult = await this.handleYouTubePlaylist(url, context, guildId);
        
        if (playlistResult && playlistResult.tracks && playlistResult.tracks.length > 0) {
          logger.debug('[PlayDLExtractor] Successfully extracted playlist with', playlistResult.tracks.length, 'tracks');
          return playlistResult;
        }
        
        logger.debug('[PlayDLExtractor] Playlist extraction failed or empty, falling back to single video extraction');
      }
      
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
        requestedBy: context.requestedBy,
        queryType: context.type,
        guildId
      });
      
      logger.debug('[PlayDLExtractor] YouTube track created:', info.video_details.title);
      return { playlist: null, tracks: [track] };
    } catch (error) {
      logger.syserr('[PlayDLExtractor] Failed to fetch YouTube info:', error.message);
      logger.debug('[PlayDLExtractor] YouTube info error details:', { url: url?.substring(0, 80), error: error.stack?.split('\n')[0] });
      return { playlist: null, tracks: [] };
    }
  }

  async handleYouTubePlaylist(url, context, guildId) {
    try {
      logger.info('[PlayDLExtractor] Fetching playlist info from:', url.substring(0, 80));
      const playlist = await play.playlist_info(url, { incomplete: true });
      
      if (!playlist || !playlist.videos || playlist.videos.length === 0) {
        logger.syserr('[PlayDLExtractor] Playlist is empty or invalid');
        return { playlist: null, tracks: [] };
      }

      logger.info('[PlayDLExtractor] Playlist found:', playlist.title, 'with', playlist.videos.length, 'videos');
      
      const tracks = [];
      const videosToFetch = playlist.videos.slice(0, 50);
      
      for (const video of videosToFetch) {
        try {
          const durationMs = video.durationInSec * 1000;
          const track = this.createTrack({
            title: video.title,
            url: video.url,
            duration: msToTimeString(durationMs),
            durationMs: durationMs,
            thumbnail: video.thumbnails?.[0]?.url || '',
            author: video.channel?.name || 'Unknown',
            views: video.views || 0,
            source: 'youtube',
            requestedBy: context.requestedBy,
            queryType: context.type,
            guildId
          });
          tracks.push(track);
        } catch (err) {
          logger.debug('[PlayDLExtractor] Skipping invalid video in playlist:', video.title);
        }
      }

      if (tracks.length === 0) {
        logger.syserr('[PlayDLExtractor] No valid tracks found in playlist');
        return { playlist: null, tracks: [] };
      }

      logger.info('[PlayDLExtractor] Created', tracks.length, 'tracks from playlist');
      
      return {
        playlist: {
          title: playlist.title || 'YouTube Playlist',
          thumbnail: playlist.thumbnail?.url || tracks[0]?.thumbnail || '',
          type: 'playlist',
          source: 'youtube',
          author: playlist.channel?.name || 'Unknown',
          id: playlist.id,
          url: url
        },
        tracks: tracks
      };
    } catch (error) {
      logger.syserr('[PlayDLExtractor] Failed to fetch playlist:', error.message);
      logger.debug('[PlayDLExtractor] Playlist error details:', { url: url?.substring(0, 80), errorType: error.name, stack: error.stack?.split('\n')[0] });
      return { playlist: null, tracks: [] };
    }
  }

  async handleSpotify(url, context, guildId) {
    try {
      const spotifyData = await play.spotify(url);
      const searchTerm = `${spotifyData.name} ${spotifyData.artists?.[0]?.name || ''}`.trim();
      logger.debug('[PlayDLExtractor] Spotify metadata extracted, searching YouTube for:', searchTerm);
      
      return await this.handleSearch(searchTerm, context, true, guildId);
    } catch (error) {
      logger.syserr('[PlayDLExtractor] Failed to handle Spotify URL:', error.message);
      return { playlist: null, tracks: [] };
    }
  }

  async handleSoundCloud(url, context, guildId) {
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
        requestedBy: context.requestedBy,
        queryType: context.type,
        guildId,
        soundcloudUrl: url
      });
      
      logger.debug('[PlayDLExtractor] SoundCloud track created for direct streaming:', scInfo.name);
      return { playlist: null, tracks: [track] };
    } catch (error) {
      logger.syserr('[PlayDLExtractor] Failed to get SoundCloud info:', error.message);
      return { playlist: null, tracks: [] };
    }
  }

  async handleSearch(searchQuery, context, isMetadataSearch = false, guildId = 'default') {
    try {
      let searched = null;
      
      try {
        searched = await play.search(searchQuery, { limit: 15, source: { youtube: 'video' } });
        logger.debug('[PlayDLExtractor] PlayDL search found', searched?.length || 0, 'results');
      } catch (err) {
        logger.debug('[PlayDLExtractor] PlayDL search failed, trying youtube-sr:', err.message);
        
        try {
          const ytSrResults = await youtubeSr.search(searchQuery, { limit: 15, type: 'video' });
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
            logger.debug('[PlayDLExtractor] youtube-sr fallback found', searched.length, 'results');
          }
        } catch (srErr) {
          logger.syserr('[PlayDLExtractor] youtube-sr also failed:', srErr.message);
        }
      }
      
      if (!searched || searched.length === 0) {
        logger.syserr('[PlayDLExtractor] No search results found for:', searchQuery.substring(0, 60));
        return { playlist: null, tracks: [] };
      }

      const rankedResults = this.rankSearchResults(searched, searchQuery, isMetadataSearch);
      const topResult = rankedResults[0];
      
      const track = this.createTrack({
        title: topResult.title,
        url: topResult.url,
        duration: msToTimeString(topResult.durationMs),
        durationMs: topResult.durationMs,
        thumbnail: topResult.thumbnail,
        author: topResult.author,
        views: topResult.views,
        source: 'youtube',
        requestedBy: context.requestedBy,
        queryType: context.type,
        guildId
      });
      
      logger.debug('[PlayDLExtractor] Created track from search:', topResult.title);
      return { playlist: null, tracks: [track] };
    } catch (error) {
      logger.syserr('[PlayDLExtractor] Search failed:', error.message);
      return { playlist: null, tracks: [] };
    }
  }

  rankSearchResults(results, searchQuery, isMetadataSearch) {
    return results.map(video => {
      const titleLower = (video.title || '').toLowerCase();
      const searchTermLower = searchQuery.toLowerCase();
      const isOfficialAudio = titleLower.includes('official audio') || titleLower.includes('official lyric');
      const isOfficialVideo = titleLower.includes('official video') || titleLower.includes('official music video');
      const isTopic = video.channel && video.channel.name && video.channel.name.includes('- Topic');
      const isVEVO = video.channel && video.channel.name && video.channel.name.includes('VEVO');
      const isExactMatch = titleLower.includes(searchTermLower);
      const hasHDOrHQ = titleLower.includes('hd') || titleLower.includes('hq') || titleLower.includes('high quality');
      
      let relevanceScore = 0;
      if (isTopic) relevanceScore += 150;
      if (isOfficialAudio) relevanceScore += 120;
      if (isVEVO) relevanceScore += 110;
      if (isOfficialVideo) relevanceScore += 90;
      if (video.channel && video.channel.verified) relevanceScore += 60;
      if (isExactMatch) relevanceScore += 50;
      if (hasHDOrHQ) relevanceScore += 30;
      if (video.views && video.views > 1000000) relevanceScore += 20;
      if (video.durationInSec && video.durationInSec >= 30) relevanceScore += 10;
      
      if (isMetadataSearch) {
        relevanceScore *= 1.2;
      }
      
      return {
        url: video.url,
        title: video.title,
        durationMs: (video.durationInSec || 0) * 1000,
        thumbnail: video.thumbnails?.[0]?.url || '',
        author: video.channel?.name || 'Unknown',
        views: video.views || 0,
        relevanceScore
      };
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
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
      youtubeUrl: data.url, 
      soundcloudUrl: data.soundcloudUrl,
      guildId: data.guildId,
      source: data.source,
      durationMS: data.durationMs
    };
    return track;
  }

  async stream(info) {
    logger.debug('[PlayDLExtractor] Stream method called, delegating to StreamingExtractor');
    throw new Error('PlayDLExtractor does not handle streaming, use StreamingExtractor');
  }
}

module.exports = PlayDLExtractor;
