const { useQueue } = require('discord-player');
const { ChatInputCommand } = require('../../classes/Commands');
const { requireSessionConditions } = require('../../modules/music');
const {
  getGuildSettings, db, saveDb
} = require('../../modules/db');

module.exports = new ChatInputCommand({
  global: true,
  data: {
    name: 'ap',
    description: 'Toggle autoplay mode - automatically plays similar songs when queue is empty'
  },
  run: async (client, interaction) => {
    const { emojis } = client.container;
    const { guild, member } = interaction;

    if (!requireSessionConditions(interaction, false, false, true)) return;

    try {
      const queue = useQueue(guild.id);
      
      const settings = getGuildSettings(guild.id);
      const currentRepeatMode = queue ? queue.repeatMode : (settings.repeatMode ?? 0);
      
      const isAutoplayOn = currentRepeatMode === 3;
      const newRepeatMode = isAutoplayOn ? 0 : 3;
      
      if (queue) {
        queue.setRepeatMode(newRepeatMode);
      }
      
      const guilds = db.getCollection('guilds');
      settings.repeatMode = newRepeatMode;
      guilds.update(settings);
      saveDb();
      
      const statusText = isAutoplayOn ? 'disabled' : 'enabled';
      const emoji = isAutoplayOn ? emojis.error : ':gear:';
      
      interaction.reply({ 
        content: `${emojis.success} ${member}, autoplay has been **${statusText}** ${emoji}\n${
          isAutoplayOn 
            ? 'Bot will leave when queue is empty' 
            : 'Bot will continue playing similar songs automatically'
        }`
      });
    }
    catch (e) {
      interaction.reply(`${emojis.error} ${member}, something went wrong:\n\n${e.message}`);
    }
  }
});
