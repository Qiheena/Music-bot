const logger = require('@QIHeena/logger');
const chalk = require('chalk');
const { getPermissionLevel } = require('../../handlers/permissions');
const { 
  checkPrefixCommandCanExecute,
  throttlePrefixCommand,
  executePrefixCommand
} = require('../../handlers/prefix-commands');
const { getGuildSettings } = require('../../modules/db');
const { clientConfig } = require('../../util');
const { emojis } = require('../../client');

const { DEBUG_ENABLED } = process.env;

module.exports = (client, message) => {
  const { member, guild, channel, content, author } = message;
  
  // Ignore bot messages
  if (author.bot) return;
  
  // Ignore DMs
  if (!guild) return;
  
  // Get guild prefix
  const settings = getGuildSettings(guild.id);
  const prefix = settings.prefix || ';';
  
  // Check if message starts with prefix
  if (!content.startsWith(prefix)) return;
  
  // Parse command and args
  const args = content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift()?.toLowerCase();
  
  if (!commandName) return;
  
  // Set permission level on member
  const permLevel = getPermissionLevel(clientConfig, member, channel);
  member.permLevel = permLevel;
  
  // Debug logging
  if (DEBUG_ENABLED === 'true') {
    logger.debug(`Prefix Command: ${chalk.white(commandName)} by ${member.user.username} in ${guild.name}`);
  }
  
  // Execute the prefix command
  executePrefixCommand(client, message, commandName, args, prefix);
};
