const logger = require('@QIHeena/logger');
const {
  colorResolver, msToHumanReadableTime, clientConfig
} = require('./util');
const { EmbedBuilder, escapeMarkdown } = require('discord.js');
const { getGuildSettings } = require('./modules/db');
const { MS_IN_ONE_SECOND, EMBED_DESCRIPTION_MAX_LENGTH } = require('./constants');
const downloadManager = require('./services/MusicDownloadManager');

module.exports = (player) => {
  // this event is emitted whenever discord-player starts to play a track
  player.events.on('playerStart', (queue, track) => {
    const previousTrack = queue.history.previousTrack;
    if (previousTrack && previousTrack.raw?.trackId && previousTrack.raw?.guildId) {
      downloadManager.cleanup(previousTrack.raw.guildId, previousTrack.raw.trackId).catch(err => 
        logger.debug('[MusicPlayer] Previous track cleanup failed:', err.message)
      );
    }
    
    queue.metadata.channel.send({ embeds: [
      new EmbedBuilder({
        color: colorResolver(),
        title: 'Started Playing',
        description: `[${ escapeMarkdown(track.title) }](${ track.url })`,
        thumbnail: { url: track.thumbnail },
        footer: { text: `${ track.duration } - by ${ track.author }\nRequested by: ${
          queue.metadata.member?.user?.username
        }` }
      }).setTimestamp(queue.metadata.timestamp)
    ] });
  });

  player.events.on('error', (queue, error) => {
    // Emitted when the player encounters an error
    queue.metadata.channel.send({ embeds: [
      {
        color: colorResolver(),
        title: 'Player Error',
        description: error.message.slice(0, EMBED_DESCRIPTION_MAX_LENGTH)
      }
    ] });
  });

  player.events.on('playerError', (queue, error) => {
    logger.syserr('Music Player encountered unexpected error:');
    logger.printErr(error);
    
    const currentTrack = queue?.currentTrack;
    const errorMsg = error?.message || error?.cause?.message || error?.data?.message || 'Unknown error';
    const errorData = error?.data || error?.cause?.data || {};
    const errorResource = error?.resource || error?.cause?.resource || '';
    
    logger.debug(`playerError full context:`, {
      message: errorMsg,
      track: currentTrack?.url,
      trackTitle: currentTrack?.title,
      data: errorData,
      resource: errorResource,
      stack: error?.stack?.split('\n').slice(0, 3)
    });
    
    if (queue?.metadata?.channel) {
      const maxLength = Math.max(EMBED_DESCRIPTION_MAX_LENGTH - 350, 500);
      let description = `Failed to play: **${currentTrack?.title || 'current track'}**\n\n`;
      
      const errorLower = errorMsg.toLowerCase();
      if (errorLower.includes('stream') || errorLower.includes('extract')) {
        description += '🔧 **Stream extraction failed** - The audio source may be unavailable, region-restricted, or private.\n\n';
        if (errorData.statusCode) description += `Status: ${errorData.statusCode}\n`;
        description += '💡 **Try:** Search for the song again or use a different platform';
      } else if (errorLower.includes('network') || errorLower.includes('timeout') || errorLower.includes('econnrefused')) {
        description += '🌐 **Network issue** - Connection to the audio source failed.\n\n';
        description += '💡 **Try:** Wait a moment and try playing the song again';
      } else {
        const safeErrorMsg = errorMsg.slice(0, maxLength);
        description += `⚠️ **Error:** ${safeErrorMsg}\n\n`;
        description += '💡 **Tip:** This track may not be available. Try a different song or source';
      }
      
      queue.metadata.channel.send({ embeds: [
        {
          color: colorResolver(),
          title: '❌ Playback Error',
          description: description.slice(0, EMBED_DESCRIPTION_MAX_LENGTH)
        }
      ] }).catch(() => {});
    }
  });

  player.events.on('audioTrackAdd', (queue, track) => {
    // Emitted when the player adds a single song to its queue
    queue.metadata.channel.send({ embeds: [
      {
        color: colorResolver(),
        title: 'Track Enqueued',
        description: `[${ escapeMarkdown(track.title) }](${ track.url })`
      }
    ] });
  });

  player.events.on('audioTracksAdd', (queue, tracks) => {
    // Emitted when the player adds multiple songs to its queue
    queue.metadata.channel.send({ embeds: [
      {
        color: colorResolver(),
        title: 'Multiple Tracks Enqueued',
        description: `**${ tracks.length }** Tracks\nFirst entry: [${ escapeMarkdown(tracks[0].title) }](${ tracks[0].url })`
      }
    ] });
  });

  player.events.on('audioTrackRemove', (queue, track) => {
    // Emitted when the player adds multiple songs to its queue
    queue.metadata.channel.send({ embeds: [
      {
        color: colorResolver(),
        title: 'Track Removed',
        description: `[${ escapeMarkdown(track.title) }](${ track.url })`
      }
    ] });
  });

  player.events.on('audioTracksRemove', (queue, tracks) => {
    // Emitted when the player adds multiple songs to its queue
    queue.metadata.channel.send({ embeds: [
      {
        color: colorResolver(),
        title: 'Multiple Tracks Removed',
        description: `**${ tracks.length }** Tracks\nFirst entry: [${ escapeMarkdown(tracks[0].title) }](${ tracks[0].url })`
      }
    ] });
  });

  player.events.on('playerSkip', (queue, track) => {
    // Emitted when the audio player fails to load the stream for a song
    queue.metadata.channel.send({ embeds: [
      {
        color: colorResolver(),
        title: 'Player Skip',
        description: `Track skipped because the audio stream couldn't be extracted: [${ escapeMarkdown(track.title) }](${ track.url })`
      }
    ] });
  });

  player.events.on('disconnect', (queue) => {
    downloadManager.cleanupGuild(queue.guild.id).catch(err => 
      logger.syserr('[MusicPlayer] Failed to cleanup guild downloads:', err)
    );
    
    queue.metadata.channel.send({ embeds: [
      {
        color: colorResolver(),
        title: 'Finished Playing',
        description: 'Queue is now empty, leaving the channel'
      }
    ] });
  });

  player.events.on('emptyChannel', (queue) => {
    const settings = getGuildSettings(queue.guild.id);
    if (!settings) return;
    const ctx = { embeds: [
      {
        color: colorResolver(),
        title: 'Channel Empty'
      }
    ] };
    if (!settings.leaveOnEmpty) ctx.embeds[0].description = 'Staying in channel as leaveOnEnd is disabled';
    else ctx.embeds[0].description = `Leaving empty channel in ${ msToHumanReadableTime(
      (settings.leaveOnEmptyCooldown ?? clientConfig.defaultLeaveOnEndCooldown) * MS_IN_ONE_SECOND
    ) }`;
    // Emitted when the voice channel has been empty for the set threshold
    // Bot will automatically leave the voice channel with this event
    queue.metadata.channel.send(ctx);
  });

  player.events.on('emptyQueue', (queue) => {
    const settings = getGuildSettings(queue.guild.id);
    // Emitted when the player queue has finished
    queue.metadata.channel.send({ embeds: [
      {
        color: colorResolver(),
        title: 'Queue Empty',
        description: `Queue is now empty, use **\`/play\`** to add something\nLeaving channel in ${ msToHumanReadableTime((settings.leaveOnEndCooldown ?? clientConfig.defaultLeaveOnEndCooldown) * MS_IN_ONE_SECOND) } if no songs are added/enqueued`
      }
    ] });
  });

  if (process.env.DEBUG_ENABLED === 'true') {
    player.events.on('debug', async (queue, message) => {
      // Emitted when the player queue sends debug info
      // Useful for seeing what state the current queue is at
      console.log(`Player debug event: ${ message }`);
    });
  }
};
