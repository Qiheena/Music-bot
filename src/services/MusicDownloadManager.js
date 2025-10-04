const fs = require('fs-extra');
const path = require('path');
const PQueue = require('p-queue').default;
const ytdl = require('ytdl-core');
const play = require('play-dl');
const logger = require('@QIHeena/logger');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');

class MusicDownloadManager {
  constructor() {
    this.baseDir = path.join(process.cwd(), 'tmp', 'audio');
    this.queue = new PQueue({ concurrency: 3 });
    this.downloads = new Map();
    this.downloadTimeouts = 45000;
    
    fs.ensureDirSync(this.baseDir);
    logger.info('[DownloadManager] Initialized with directory:', this.baseDir);
  }

  generateTrackId(url) {
    const videoId = this.extractVideoId(url);
    if (videoId) {
      return videoId;
    }
    return `track_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  extractVideoId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  getFilePath(guildId, trackId) {
    const guildDir = path.join(this.baseDir, guildId);
    fs.ensureDirSync(guildDir);
    return path.join(guildDir, `${trackId}.webm`);
  }

  async downloadWithYtdl(url, filePath) {
    logger.debug('[DownloadManager] Attempting ytdl-core download:', url);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('ytdl-core download timeout'));
      }, this.downloadTimeouts);

      try {
        const stream = ytdl(url, {
          filter: 'audioonly',
          quality: 'highestaudio',
          highWaterMark: 1 << 25
        });

        const writeStream = createWriteStream(filePath);
        
        stream.pipe(writeStream);

        stream.on('error', (err) => {
          clearTimeout(timeout);
          writeStream.destroy();
          reject(err);
        });

        writeStream.on('error', (err) => {
          clearTimeout(timeout);
          stream.destroy();
          reject(err);
        });

        writeStream.on('finish', () => {
          clearTimeout(timeout);
          logger.debug('[DownloadManager] ytdl-core download complete:', filePath);
          resolve(filePath);
        });
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  async downloadWithPlayDl(url, filePath) {
    logger.debug('[DownloadManager] Attempting play-dl download:', url);
    
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('play-dl download timeout'));
      }, this.downloadTimeouts);

      try {
        const stream = await play.stream(url);
        const writeStream = createWriteStream(filePath);
        
        stream.stream.pipe(writeStream);

        stream.stream.on('error', (err) => {
          clearTimeout(timeout);
          writeStream.destroy();
          reject(err);
        });

        writeStream.on('error', (err) => {
          clearTimeout(timeout);
          stream.stream.destroy();
          reject(err);
        });

        writeStream.on('finish', () => {
          clearTimeout(timeout);
          logger.debug('[DownloadManager] play-dl download complete:', filePath);
          resolve(filePath);
        });
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  async download(url, guildId, trackId) {
    const downloadKey = `${guildId}_${trackId}`;
    
    if (this.downloads.has(downloadKey)) {
      const existing = this.downloads.get(downloadKey);
      if (existing.status === 'completed') {
        return existing.filePath;
      }
      if (existing.status === 'downloading') {
        return existing.promise;
      }
    }

    const filePath = this.getFilePath(guildId, trackId);
    
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size > 1000) {
        logger.debug('[DownloadManager] Using cached file:', filePath);
        this.downloads.set(downloadKey, { status: 'completed', filePath });
        return filePath;
      }
    }

    const downloadPromise = this.queue.add(async () => {
      logger.info('[DownloadManager] Starting download:', { url, guildId, trackId });
      
      const errors = [];
      
      try {
        return await this.downloadWithYtdl(url, filePath);
      } catch (ytdlError) {
        logger.debug('[DownloadManager] ytdl-core failed:', ytdlError.message);
        errors.push({ tool: 'ytdl-core', error: ytdlError.message });
        
        if (fs.existsSync(filePath)) {
          fs.removeSync(filePath);
        }
      }

      try {
        return await this.downloadWithPlayDl(url, filePath);
      } catch (playDlError) {
        logger.debug('[DownloadManager] play-dl failed:', playDlError.message);
        errors.push({ tool: 'play-dl', error: playDlError.message });
        
        if (fs.existsSync(filePath)) {
          fs.removeSync(filePath);
        }
      }

      logger.syserr('[DownloadManager] All download methods failed:', errors);
      throw new Error(`Failed to download audio: ${errors.map(e => e.tool).join(', ')} failed`);
    });

    this.downloads.set(downloadKey, {
      status: 'downloading',
      promise: downloadPromise
    });

    try {
      const result = await downloadPromise;
      this.downloads.set(downloadKey, { status: 'completed', filePath: result });
      return result;
    } catch (error) {
      this.downloads.delete(downloadKey);
      throw error;
    }
  }

  async getResource(url, guildId) {
    try {
      const trackId = this.generateTrackId(url);
      const filePath = await this.download(url, guildId, trackId);
      return filePath;
    } catch (error) {
      logger.syserr('[DownloadManager] Failed to get resource:', error);
      throw error;
    }
  }

  async cleanup(guildId, trackId) {
    const downloadKey = `${guildId}_${trackId}`;
    this.downloads.delete(downloadKey);
    
    const filePath = this.getFilePath(guildId, trackId);
    if (fs.existsSync(filePath)) {
      try {
        fs.removeSync(filePath);
        logger.debug('[DownloadManager] Cleaned up:', filePath);
      } catch (err) {
        logger.syserr('[DownloadManager] Cleanup failed:', err);
      }
    }
  }

  async cleanupGuild(guildId) {
    const guildDir = path.join(this.baseDir, guildId);
    if (fs.existsSync(guildDir)) {
      try {
        fs.removeSync(guildDir);
        logger.info('[DownloadManager] Cleaned up guild directory:', guildId);
      } catch (err) {
        logger.syserr('[DownloadManager] Guild cleanup failed:', err);
      }
    }
    
    for (const [key] of this.downloads) {
      if (key.startsWith(`${guildId}_`)) {
        this.downloads.delete(key);
      }
    }
  }

  getStatus(guildId, trackId) {
    const downloadKey = `${guildId}_${trackId}`;
    const download = this.downloads.get(downloadKey);
    return download ? download.status : 'not_started';
  }
}

module.exports = new MusicDownloadManager();
