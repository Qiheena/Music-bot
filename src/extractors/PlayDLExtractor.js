const { BaseExtractor, Track } = require('discord-player');
const play = require('play-dl');
const logger = require('@QIHeena/logger');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
    
    if (query.includes('soundcloud.com') || 
        query.includes('spotify.com')) {
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
        track.raw = { youtubeUrl: info.video_details.url };
        logger.debug('[PlayDLExtractor] YouTube info fetched:', info.video_details.title);
        return { playlist: null, tracks: [track] };
      }
      else if (searchQuery.includes('spotify.com')) {
        logger.debug('[PlayDLExtractor] Spotify URL detected, extracting metadata...');
        try {
          const spotifyData = await play.spotify(searchQuery);
          const searchTerm = `${spotifyData.name} ${spotifyData.artists?.[0]?.name || ''}`.trim();
          logger.debug('[PlayDLExtractor] Spotify metadata extracted, searching YouTube for:', searchTerm);
          
          const searched = await play.search(searchTerm, { limit: 15, source: { youtube: 'video' } });
          if (!searched || searched.length === 0) {
            logger.syserr('[PlayDLExtractor] No YouTube results found for Spotify track:', searchTerm);
            return { playlist: null, tracks: [] };
          }
          
          searchResult = searched.map(video => {
            const titleLower = (video.title || '').toLowerCase();
            const searchTermLower = searchTerm.toLowerCase();
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
            
            return {
              url: video.url,
              title: video.title,
              duration: video.durationInSec * 1000,
              thumbnail: video.thumbnails[0]?.url,
              author: video.channel ? video.channel.name : 'Unknown',
              views: video.views,
              source: 'youtube',
              relevanceScore,
              originalQuery: searchTerm
            };
          }).sort((a, b) => b.relevanceScore - a.relevanceScore);
          
          logger.debug('[PlayDLExtractor] Found', searchResult.length, 'YouTube results for Spotify track');
        } catch (err) {
          logger.syserr('[PlayDLExtractor] Failed to extract Spotify metadata:', err.message);
          return { playlist: null, tracks: [] };
        }
      }
      else if (searchQuery.includes('soundcloud.com')) {
        logger.debug('[PlayDLExtractor] SoundCloud URL detected, extracting metadata and searching YouTube...');
        try {
          const scInfo = await play.soundcloud(searchQuery);
          const searchTerm = `${scInfo.name} ${scInfo.user?.name || ''}`.trim();
          logger.debug('[PlayDLExtractor] SoundCloud metadata extracted, searching YouTube for:', searchTerm);
          
          const searched = await play.search(searchTerm, { limit: 15, source: { youtube: 'video' } });
          if (!searched || searched.length === 0) {
            logger.syserr('[PlayDLExtractor] No YouTube results found for SoundCloud track:', searchTerm);
            return { playlist: null, tracks: [] };
          }
          
          searchResult = searched.map(video => {
            const titleLower = (video.title || '').toLowerCase();
            const searchTermLower = searchTerm.toLowerCase();
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
            
            return {
              url: video.url,
              title: video.title,
              duration: video.durationInSec * 1000,
              thumbnail: video.thumbnails[0]?.url,
              author: video.channel ? video.channel.name : 'Unknown',
              views: video.views,
              source: 'youtube',
              relevanceScore,
              originalQuery: searchTerm,
              soundcloudFallback: searchQuery
            };
          }).sort((a, b) => b.relevanceScore - a.relevanceScore);
          
          logger.debug('[PlayDLExtractor] Found', searchResult.length, 'YouTube results for SoundCloud track');
        } catch (err) {
          logger.syserr('[PlayDLExtractor] Failed to extract SoundCloud metadata:', err.message);
          return { playlist: null, tracks: [] };
        }
      }
      else {
        logger.debug('[PlayDLExtractor] Searching YouTube for:', searchQuery);
        const searched = await play.search(searchQuery, { limit: 15, source: { youtube: 'video' } });
        
        if (!searched || searched.length === 0) {
          logger.syserr('[PlayDLExtractor] No search results found for:', searchQuery);
          return { playlist: null, tracks: [] };
        }
        
        searchResult = searched.map(video => {
          const titleLower = (video.title || '').toLowerCase();
          const searchQueryLower = searchQuery.toLowerCase();
          
          const isOfficialAudio = titleLower.includes('official audio') || titleLower.includes('official lyric');
          const isOfficialVideo = titleLower.includes('official video') || titleLower.includes('official music video');
          const isTopic = video.channel && video.channel.name && video.channel.name.includes('- Topic');
          const isVEVO = video.channel && video.channel.name && video.channel.name.includes('VEVO');
          const isExactMatch = titleLower.includes(searchQueryLower);
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
        
        logger.debug('[PlayDLExtractor] Found', searchResult.length, 'results, top result:', searchResult[0]?.title, 'with score:', searchResult[0]?.relevanceScore);
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
        track.raw = { 
          youtubeUrl: trackData.url,
          searchQuery: trackData.originalQuery || trackData.title,
          soundcloudFallback: trackData.soundcloudFallback
        };
        return track;
      });

      logger.debug('[PlayDLExtractor] Created', tracks.length, 'track(s) with multi-platform support');
      return { playlist: null, tracks };
    } 
    catch (error) {
      logger.syserr('[PlayDLExtractor] Error in handle():', error.message);
      logger.printErr(error);
      return { playlist: null, tracks: [] };
    }
  }

  async downloadAndCache(url, title) {
    const cacheDir = '/tmp/music_cache';
    
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
      logger.debug(`[PlayDLExtractor] Created cache directory:`, cacheDir);
    }
    
    const hash = crypto.createHash('md5').update(url).digest('hex');
    const fileName = `${hash}.opus`;
    const filePath = path.join(cacheDir, fileName);
    
    if (fs.existsSync(filePath)) {
      logger.debug(`[PlayDLExtractor] ✓ Cache hit for:`, title);
      return filePath;
    }
    
    logger.debug(`[PlayDLExtractor] Downloading from YouTube:`, title);
    
    return new Promise((resolve, reject) => {
      const stream = ytdl(url, {
        filter: 'audioonly',
        quality: 'highestaudio',
        highWaterMark: 1 << 25
      });
      
      const writeStream = fs.createWriteStream(filePath);
      
      stream.pipe(writeStream);
      
      stream.on('error', (err) => {
        logger.debug(`[PlayDLExtractor] ✗ Download failed:`, err.message);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        reject(err);
      });
      
      writeStream.on('finish', () => {
        logger.debug(`[PlayDLExtractor] ✓ Download complete:`, title);
        this.cleanupOldCache(cacheDir);
        resolve(filePath);
      });
      
      writeStream.on('error', (err) => {
        logger.debug(`[PlayDLExtractor] ✗ Write failed:`, err.message);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        reject(err);
      });
    });
  }
  
  cleanupOldCache(cacheDir) {
    try {
      const files = fs.readdirSync(cacheDir);
      if (files.length > 50) {
        const fileStats = files.map(file => ({
          file,
          path: path.join(cacheDir, file),
          time: fs.statSync(path.join(cacheDir, file)).mtime.getTime()
        })).sort((a, b) => a.time - b.time);
        
        const filesToDelete = fileStats.slice(0, 20);
        filesToDelete.forEach(({ path }) => {
          fs.unlinkSync(path);
          logger.debug(`[PlayDLExtractor] Cleaned up cache file:`, path);
        });
      }
    } catch (err) {
      logger.debug(`[PlayDLExtractor] Cache cleanup error:`, err.message);
    }
  }
  
  async streamFromPlatform(url, platform) {
    const timeout = 10000;
    let timeoutHandle;
    
    const streamPromise = play.stream(url, {
      quality: 2,
      discordPlayerCompatibility: true
    });
    
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error(`${platform} stream timeout after ${timeout}ms`)), timeout);
    });
    
    try {
      const streamData = await Promise.race([streamPromise, timeoutPromise]);
      clearTimeout(timeoutHandle);
      
      if (!streamData || !streamData.stream) {
        throw new Error(`Failed to get stream data from ${platform}`);
      }
      
      logger.debug(`[PlayDLExtractor] ✓ ${platform} stream created successfully`);
      return { streamData, platform };
    } catch (error) {
      clearTimeout(timeoutHandle);
      logger.debug(`[PlayDLExtractor] ✗ ${platform} stream failed:`, error.message);
      throw error;
    }
  }

  async searchMultiplePlatforms(searchQuery) {
    logger.debug('[PlayDLExtractor] Searching multiple platforms in parallel:', searchQuery);
    
    const platformSearches = [];
    
    platformSearches.push(
      play.search(searchQuery, { limit: 3, source: { youtube: 'video' } })
        .then(results => ({ platform: 'youtube', results: results || [] }))
        .catch(err => {
          logger.debug('[PlayDLExtractor] YouTube search failed:', err.message);
          return { platform: 'youtube', results: [] };
        })
    );
    
    platformSearches.push(
      play.search(searchQuery, { limit: 2, source: { soundcloud: 'tracks' } })
        .then(results => ({ platform: 'soundcloud', results: results || [] }))
        .catch(err => {
          logger.debug('[PlayDLExtractor] SoundCloud search failed:', err.message);
          return { platform: 'soundcloud', results: [] };
        })
    );
    
    const allResults = await Promise.all(platformSearches);
    return allResults;
  }

  async raceMultiplePlatformStreams(urls) {
    logger.debug('[PlayDLExtractor] Racing streams from multiple platforms...');
    
    const sortedUrls = urls.sort((a, b) => b.priority - a.priority);
    const highestPriority = sortedUrls[0]?.priority || 0;
    
    return new Promise((resolve, reject) => {
      let pendingCount = sortedUrls.length;
      let resolved = false;
      const failures = [];
      let firstSuccess = null;
      let graceTimer = null;
      
      const resolveWithStream = (streamResult) => {
        if (!resolved) {
          resolved = true;
          if (graceTimer) clearTimeout(graceTimer);
          logger.debug(`[PlayDLExtractor] ✓ Winner: ${streamResult.platform} (priority: ${streamResult.priority})`);
          resolve(streamResult);
        }
      };
      
      sortedUrls.forEach(({ url, platform, priority }) => {
        this.streamFromPlatform(url, platform)
          .then(result => {
            const streamResult = { ...result, priority, url };
            
            if (resolved) return;
            
            if (priority === highestPriority) {
              logger.debug(`[PlayDLExtractor] ✓ Highest priority stream (${platform}) ready - using immediately`);
              resolveWithStream(streamResult);
              return;
            }
            
            if (!firstSuccess) {
              firstSuccess = streamResult;
              logger.debug(`[PlayDLExtractor] ✓ First stream ready: ${platform} (priority: ${priority})`);
              logger.debug(`[PlayDLExtractor] Waiting 500ms for higher priority streams...`);
              
              graceTimer = setTimeout(() => {
                if (!resolved && firstSuccess) {
                  logger.debug(`[PlayDLExtractor] No higher priority stream ready, using first success`);
                  resolveWithStream(firstSuccess);
                }
              }, 500);
            } else if (priority > firstSuccess.priority) {
              logger.debug(`[PlayDLExtractor] ✓ Higher priority stream ready: ${platform}, replacing first success`);
              firstSuccess = streamResult;
            }
            
            pendingCount--;
            if (pendingCount === 0 && !resolved && firstSuccess) {
              logger.debug(`[PlayDLExtractor] All attempts complete, using best available`);
              resolveWithStream(firstSuccess);
            }
          })
          .catch(err => {
            if (resolved) return;
            
            logger.debug(`[PlayDLExtractor] ✗ ${platform} failed in race:`, err.message);
            failures.push(`${platform}: ${err.message}`);
            pendingCount--;
            
            if (pendingCount === 0 && !resolved) {
              if (firstSuccess) {
                logger.debug(`[PlayDLExtractor] All attempts complete, using first success despite failures`);
                resolveWithStream(firstSuccess);
              } else {
                reject(new Error(`All platform streams failed: ${failures.join(', ')}`));
              }
            }
          });
      });
    });
  }

  async stream(info) {
    try {
      logger.debug('[PlayDLExtractor] Attempting to stream:', info.url);
      logger.debug('[PlayDLExtractor] Track title:', info.title);
      
      let youtubeUrl = null;
      const urlsToRace = [];
      
      if (info.url.includes('youtube.com') || info.url.includes('youtu.be')) {
        youtubeUrl = info.url;
      } else if (info.raw?.youtubeUrl) {
        youtubeUrl = info.raw.youtubeUrl;
      }
      
      if (youtubeUrl) {
        logger.debug('[PlayDLExtractor] YouTube URL:', youtubeUrl);
        logger.debug('[PlayDLExtractor] Trying download-first approach with high priority...');
        
        try {
          const cachedFile = await this.downloadAndCache(youtubeUrl, info.title);
          logger.debug('[PlayDLExtractor] ✓ Streaming from cached file:', cachedFile);
          
          if (!fs.existsSync(cachedFile)) {
            throw new Error('Downloaded file not found');
          }
          
          const fileStream = fs.createReadStream(cachedFile);
          
          fileStream.on('error', (err) => {
            logger.syserr('[PlayDLExtractor] Read stream error:', err.message);
          });
          
          return this.createStream(fileStream, { type: 'opus' });
        } catch (err) {
          logger.debug('[PlayDLExtractor] Download-first approach failed, will add to race:', err.message);
          urlsToRace.push({ url: youtubeUrl, platform: 'YouTube', priority: 100 });
        }
      }
      
      let searchQuery = info.raw?.searchQuery || info.title || info.author || '';
      
      if (!searchQuery || !searchQuery.trim()) {
        logger.syserr('[PlayDLExtractor] Empty search query! Attempting to extract from all metadata...');
        searchQuery = info.description || '';
        
        if (!searchQuery || !searchQuery.trim()) {
          throw new Error('Cannot search with empty query - no title, author, or description available');
        }
      }
      
      searchQuery = searchQuery.trim();
      
      if (!youtubeUrl) {
        logger.debug('[PlayDLExtractor] No direct YouTube URL, searching multiple platforms in parallel...');
        const platformResults = await this.searchMultiplePlatforms(searchQuery);
        
        for (const { platform, results } of platformResults) {
          if (platform === 'youtube' && results.length > 0) {
            logger.debug(`[PlayDLExtractor] Found ${results.length} YouTube results`);
            results.slice(0, 3).forEach((video, index) => {
              const priority = 100 - (index * 10);
              urlsToRace.push({ url: video.url, platform: 'YouTube', priority });
            });
          } else if (platform === 'soundcloud' && results.length > 0) {
            logger.debug(`[PlayDLExtractor] Found ${results.length} SoundCloud results`);
            results.slice(0, 2).forEach((track, index) => {
              const priority = 50 - (index * 5);
              urlsToRace.push({ url: track.url, platform: 'SoundCloud', priority });
            });
          }
        }
      }
      
      if (info.raw?.soundcloudFallback) {
        logger.debug('[PlayDLExtractor] Adding SoundCloud fallback URL to race');
        urlsToRace.push({ url: info.raw.soundcloudFallback, platform: 'SoundCloud', priority: 60 });
      }
      
      if (urlsToRace.length > 0) {
        logger.debug(`[PlayDLExtractor] Racing ${urlsToRace.length} streams from multiple platforms...`);
        logger.debug('[PlayDLExtractor] Platform priorities: YouTube (100+), SoundCloud (50+)');
        
        try {
          const winner = await this.raceMultiplePlatformStreams(urlsToRace);
          logger.debug(`[PlayDLExtractor] ✓ Stream winner: ${winner.platform}`);
          return this.createStream(winner.streamData.stream, { type: winner.streamData.type });
        } catch (err) {
          logger.debug('[PlayDLExtractor] Multi-platform race failed:', err.message);
        }
      }
      
      logger.debug('[PlayDLExtractor] All streaming attempts failed, trying final fallback search...');
      try {
        const searched = await play.search(searchQuery, { limit: 1, source: { soundcloud: 'tracks' } });
        if (searched && searched.length > 0) {
          logger.debug('[PlayDLExtractor] Final fallback - SoundCloud found:', searched[0].title);
          const streamData = await this.streamFromPlatform(searched[0].url, 'SoundCloud');
          return this.createStream(streamData.streamData.stream, { type: streamData.streamData.type });
        }
      } catch (err) {
        logger.debug('[PlayDLExtractor] Final fallback failed:', err.message);
      }
      
      throw new Error('⚠️ Could not stream from any platform. All sources failed or timed out.');
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
