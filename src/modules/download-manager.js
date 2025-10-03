const fs = require('fs');
const path = require('path');
const { createWriteStream, existsSync, mkdirSync, unlinkSync, readdirSync } = require('fs');
const { Readable } = require('stream');
const logger = require('@mirasaki/logger');
const playdl = require('play-dl');
const { createAudioResource } = require('@discordjs/voice');

const DOWNLOAD_DIR = path.join('/tmp', 'music-downloads');
const MAX_CACHED_FILES = 2;
const MAX_FILE_SIZE = 40 * 1024 * 1024;
const DOWNLOAD_TIMEOUT = 180000;

if (!existsSync(DOWNLOAD_DIR)) {
  mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

class DownloadManager {
  constructor() {
    this.downloadCache = new Map();
    this.activeDownloads = new Set();
    this.downloadPromises = new Map();
    
    this.cleanupOnBoot();
  }

  cleanupOnBoot() {
    try {
      if (existsSync(DOWNLOAD_DIR)) {
        const files = readdirSync(DOWNLOAD_DIR);
        for (const file of files) {
          const filePath = path.join(DOWNLOAD_DIR, file);
          try {
            unlinkSync(filePath);
          } catch (err) {
            logger.syserr(`Failed to cleanup file on boot: ${filePath}`);
          }
        }
        logger.info('Cleaned up temporary music files on boot');
      }
    } catch (err) {
      logger.syserr('Failed to cleanup downloads directory on boot');
      logger.printErr(err);
    }
  }

  generateTrackId(track) {
    return `${track.id || track.url}`.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
  }

  getFilePath(trackId) {
    return path.join(DOWNLOAD_DIR, `${trackId}.mp3`);
  }

  isDownloaded(trackId) {
    const cached = this.downloadCache.get(trackId);
    if (!cached) return false;
    
    const filePath = this.getFilePath(trackId);
    if (!existsSync(filePath)) {
      this.downloadCache.delete(trackId);
      return false;
    }
    
    return true;
  }

  async ensureDownloaded(track) {
    const trackId = this.generateTrackId(track);
    
    if (this.isDownloaded(trackId)) {
      return {
        success: true,
        filePath: this.getFilePath(trackId),
        trackId,
        fromCache: true
      };
    }

    if (this.downloadPromises.has(trackId)) {
      logger.debug(`Waiting for existing download to complete: ${track.title}`);
      return await this.downloadPromises.get(trackId);
    }

    const downloadPromise = (async () => {
      try {
        this.activeDownloads.add(trackId);
        const filePath = await this.downloadTrack(track, trackId);
        
        if (!filePath) {
          return {
            success: false,
            error: 'Download failed',
            trackId
          };
        }
        
        this.downloadCache.set(trackId, {
          trackId,
          filePath,
          downloadedAt: Date.now(),
          track
        });
        
        await this.enforceMaxCachedFiles();
        
        return {
          success: true,
          filePath,
          trackId,
          fromCache: false
        };
      } catch (err) {
        logger.syserr(`Failed to download track: ${track.title}`);
        logger.printErr(err);
        return {
          success: false,
          error: err.message,
          trackId
        };
      } finally {
        this.activeDownloads.delete(trackId);
        this.downloadPromises.delete(trackId);
      }
    })();

    this.downloadPromises.set(trackId, downloadPromise);
    return await downloadPromise;
  }

  async downloadTrack(track, trackId) {
    const filePath = this.getFilePath(trackId);
    const url = track.url;
    
    if (!url) {
      throw new Error('No URL found for track');
    }

    try {
      let stream;
      const urlLower = url.toLowerCase();
      
      if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
        stream = await playdl.stream(url);
      } else if (urlLower.includes('soundcloud.com')) {
        stream = await playdl.stream(url);
      } else {
        const attachmentUrl = track.raw?.url || url;
        const response = await fetch(attachmentUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        stream = Readable.fromWeb(response.body);
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          writeStream.destroy();
          if (existsSync(filePath)) unlinkSync(filePath);
          reject(new Error('Download timeout'));
        }, DOWNLOAD_TIMEOUT);

        const writeStream = createWriteStream(filePath);
        let downloadedSize = 0;

        if (stream.stream) {
          stream.stream.pipe(writeStream);
          
          stream.stream.on('data', (chunk) => {
            downloadedSize += chunk.length;
            if (downloadedSize > MAX_FILE_SIZE) {
              clearTimeout(timeout);
              stream.stream.destroy();
              writeStream.destroy();
              if (existsSync(filePath)) unlinkSync(filePath);
              reject(new Error('File size exceeds limit'));
            }
          });

          stream.stream.on('error', (err) => {
            clearTimeout(timeout);
            writeStream.destroy();
            if (existsSync(filePath)) unlinkSync(filePath);
            reject(err);
          });
        } else if (stream.pipe) {
          stream.pipe(writeStream);
          
          stream.on('data', (chunk) => {
            downloadedSize += chunk.length;
            if (downloadedSize > MAX_FILE_SIZE) {
              clearTimeout(timeout);
              stream.destroy();
              writeStream.destroy();
              if (existsSync(filePath)) unlinkSync(filePath);
              reject(new Error('File size exceeds limit'));
            }
          });

          stream.on('error', (err) => {
            clearTimeout(timeout);
            writeStream.destroy();
            if (existsSync(filePath)) unlinkSync(filePath);
            reject(err);
          });
        } else {
          clearTimeout(timeout);
          writeStream.destroy();
          reject(new Error('Invalid stream type'));
          return;
        }

        writeStream.on('finish', () => {
          clearTimeout(timeout);
          const stats = fs.statSync(filePath);
          if (stats.size === 0) {
            unlinkSync(filePath);
            reject(new Error('Downloaded file is empty'));
          } else {
            logger.info(`Successfully downloaded: ${track.title} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
            resolve(filePath);
          }
        });

        writeStream.on('error', (err) => {
          clearTimeout(timeout);
          if (existsSync(filePath)) unlinkSync(filePath);
          reject(err);
        });
      });
    } catch (err) {
      if (existsSync(filePath)) unlinkSync(filePath);
      throw err;
    }
  }

  async enforceMaxCachedFiles() {
    if (this.downloadCache.size <= MAX_CACHED_FILES) {
      return;
    }

    const sortedCache = Array.from(this.downloadCache.entries())
      .sort((a, b) => a[1].downloadedAt - b[1].downloadedAt);

    const toDelete = sortedCache.slice(0, sortedCache.length - MAX_CACHED_FILES);
    
    for (const [trackId, cacheEntry] of toDelete) {
      await this.cleanup(trackId);
    }
  }

  async cleanup(trackId) {
    const cached = this.downloadCache.get(trackId);
    if (!cached) return;

    try {
      const filePath = this.getFilePath(trackId);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        logger.debug(`Cleaned up downloaded file: ${trackId}`);
      }
      this.downloadCache.delete(trackId);
    } catch (err) {
      logger.syserr(`Failed to cleanup file: ${trackId}`);
      logger.printErr(err);
    }
  }

  async predownloadNextTrack(queue) {
    if (!queue || queue.isEmpty()) return;
    
    const nextTrack = queue.tracks.data[0];
    if (!nextTrack) return;

    const trackId = this.generateTrackId(nextTrack);
    
    if (this.isDownloaded(trackId)) {
      logger.debug(`Next track already downloaded: ${nextTrack.title}`);
      return;
    }

    if (this.activeDownloads.has(trackId)) {
      logger.debug(`Next track download already in progress: ${nextTrack.title}`);
      return;
    }

    logger.info(`Pre-downloading next track: ${nextTrack.title}`);
    const result = await this.ensureDownloaded(nextTrack);
    
    if (!result.success) {
      logger.syserr(`Failed to pre-download next track: ${result.error}`);
    }
  }

  getCachedFilePath(track) {
    const trackId = this.generateTrackId(track);
    if (this.isDownloaded(trackId)) {
      return this.getFilePath(trackId);
    }
    return null;
  }

  createAudioResourceFromCache(track) {
    const filePath = this.getCachedFilePath(track);
    if (!filePath) return null;
    
    try {
      const stream = fs.createReadStream(filePath);
      return createAudioResource(stream);
    } catch (err) {
      logger.syserr(`Failed to create audio resource from cache: ${err.message}`);
      return null;
    }
  }

  getStats() {
    return {
      cachedFiles: this.downloadCache.size,
      activeDownloads: this.activeDownloads.size,
      downloadDir: DOWNLOAD_DIR
    };
  }
}

module.exports = new DownloadManager();
