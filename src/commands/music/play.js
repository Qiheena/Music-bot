const { ApplicationCommandOptionType } = require('discord.js');
const { ChatInputCommand } = require('../../classes/Commands');
const {
  requireSessionConditions, ALLOWED_CONTENT_TYPE, musicEventChannel
} = require('../../modules/music');
const { clientConfig, isAllowedContentType } = require('../../util');
const { getGuildSettings } = require('../../modules/db');
const {
  useMainPlayer, useQueue, EqualizerConfigurationPreset
} = require('discord-player');
const { MS_IN_ONE_SECOND } = require('../../constants');
const logger = require('@QIHeena/logger');
const player = useMainPlayer();

module.exports = new ChatInputCommand({
  global: true,
  data: {
    description: 'Play a song. Search YouTube, provide a link, or upload an audio file.',
    options: [
      {
        name: 'query',
        type: ApplicationCommandOptionType.String,
        autocomplete: false,
        description: 'The music to search/query',
        required: true
      },
      {
        name: 'file',
        type: ApplicationCommandOptionType.Attachment,
        description: 'The audio file to play',
        required: false
      }
    ]
  },
  // eslint-disable-next-line sonarjs/cognitive-complexity
  run: async (client, interaction) => {
    const { emojis } = client.container;
    const { member, guild } = interaction;
    const query = interaction.options.getString('query', true); // we need input/query to play
    const attachment = interaction.options.getAttachment('file');

    // Defer immediately to prevent interaction timeout
    await interaction.deferReply();

    // Check state
    if (!requireSessionConditions(interaction, false, true, false)) return;

    // Return if attachment content type is not allowed
    if (attachment) {
      const contentIsAllowed = isAllowedContentType(ALLOWED_CONTENT_TYPE, attachment?.contentType ?? 'unknown');
      if (!contentIsAllowed.strict) {
        interaction.editReply({ content: `${ emojis.error } ${ member }, file rejected. Content type is not **\`${ ALLOWED_CONTENT_TYPE }\`**, received **\`${ attachment.contentType ?? 'unknown' }\`** instead.` });
        return;
      }
    }

    // Ok, safe to access voice channel and initialize
    const channel = member.voice?.channel;

    try {
      // Check is valid
      const searchResult = await player
        .search(attachment?.url ?? query, { 
          requestedBy: interaction.user,
          searchEngine: 'playdl',
          guildId: guild.id
        })
        .catch((err) => {
          logger.syserr('[Play Command] Search failed:', err);
          return null;
        });
      if (!searchResult || !searchResult.hasTracks()) {
        logger.debug('[Play Command] No tracks found for query:', query);
        interaction.editReply(`${ emojis.error } ${ member }, no tracks found for query \`${ query }\` - this command has been cancelled`);
        return;
      }
      
      logger.info('[Play Command] Found tracks:', searchResult.tracks.length, 'First:', searchResult.tracks[0]?.title);

      // Resolve settings
      const settings = getGuildSettings(guild.id);

      // Use thread channels
      let eventChannel = interaction.channel;
      if (settings.useThreadSessions) {
        eventChannel = await musicEventChannel(client, interaction);
        if (eventChannel === false) return;
      }

      // Resolve volume for this session - clamp max 100
      let volume = settings.volume ?? clientConfig.defaultVolume;
      // Note: Don't increase volume for attachments as having to check
      // and adjust on every song end isn't perfect
      volume = Math.min(100, volume);

      // Resolve cooldown
      const leaveOnEndCooldown = ((settings.leaveOnEndCooldown ?? 2) * MS_IN_ONE_SECOND);
      const leaveOnEmptyCooldown = ((settings.leaveOnEmptyCooldown ?? 2) * MS_IN_ONE_SECOND);

      // nodeOptions are the options for guild node (aka your queue in simple word)
      // we can access this metadata object using queue.metadata later on
      logger.info('[Play Command] Calling player.play for:', searchResult.tracks[0]?.title);
      const { track } = await player.play(
        channel,
        searchResult,
        {
          requestedBy: interaction.user,
          nodeOptions: {
            skipOnNoStream: false,
            leaveOnEnd: true,
            leaveOnEndCooldown,
            leaveOnEmpty: settings.leaveOnEmpty,
            leaveOnEmptyCooldown,
            volume,
            metadata: {
              channel: eventChannel,
              member,
              timestamp: interaction.createdTimestamp
            }
          }
        }
      );
      
      logger.info('[Play Command] player.play succeeded, track:', track?.title);

      // Use queue
      const queue = useQueue(guild.id);

      // Now that we have a queue initialized,
      // let's check if we should set our default repeat-mode
      if (Number.isInteger(settings.repeatMode)) queue.setRepeatMode(settings.repeatMode);

      // Set persistent equalizer preset
      if (
        queue.filters.equalizer
        && settings.equalizer
        && settings.equalizer !== 'null'
      ) {
        queue.filters.equalizer.setEQ(EqualizerConfigurationPreset[settings.equalizer]);
        queue.filters.equalizer.enable();
      }
      else if (queue.filters?.equalizer) queue.filters.equalizer.disable();

      // Feedback
      await interaction.editReply(`${ emojis.success } ${ member }, enqueued **\`${ track.title }\`**!`);
    }
    catch (e) {
      logger.syserr('[Play Command] Error during play command:', e);
      logger.printErr(e);
      interaction.editReply(`${ emojis.error } ${ member }, something went wrong:\n\n${ e.message }`);
    }
  }
});
