const logger = require('@QIHeena/logger');
const chalk = require('chalk');
const { hasChannelPerms, resolvePermissionArray } = require('./permissions');
const { commands } = require('../client');
const { MS_IN_ONE_SECOND } = require('../constants');

const { emojis } = require('../client');

// Command aliases mapping - short commands to full command names
const COMMAND_ALIASES = {
  // Music commands
  'p': 'play',
  's': 'skip',
  'stp': 'stop',
  'np': 'now-playing',
  'q': 'queue',
  'ps': 'pause',
  'res': 'resume',
  'sh': 'shuffle-queue',
  'rep': 'repeat-mode',
  'vol': 'volume',
  'lyr': 'lyrics',
  'seek': 'seek',
  'clr': 'clear-queue',
  'rm': 'remove-song',
  'sv': 'save-song',
  'srch': 'search',
  'hist': 'history',
  'ap': 'ap',
  'eq': 'equalizer',
  'flt': 'audio-filters',
  'bq': 'biquad',
  'jmp': 'jump-to',
  'mv': 'move-song',
  'pn': 'play-next',
  'pp': 'play-previous-song',
  'qp': 'queue-previous-song',
  'rpl': 'replay',
  'sk': 'skip-to',
  'swp': 'swap-songs',
  'vs': 'vote-skip',
  
  // System commands
  'h': 'help',
  'bst': 'stats',
  'ping': 'stats',
  'inv': 'invite',
  'sup': 'support',
  'perm': 'permlevel'
};

const ThrottleMap = new Map();

const getThrottleId = (cooldown, cmdName, message) => {
  const { member, channel, guild } = message;
  
  let identifierStr;
  
  switch (cooldown.type) {
    case 'member': identifierStr = `${member.id}${guild.id}`;
      break;
    case 'guild': identifierStr = guild.id;
      break;
    case 'channel': identifierStr = channel.id;
      break;
    case 'global': identifierStr = '';
      break;
    case 'user':
    default: {
      identifierStr = member.id;
      break;
    }
  }
  
  identifierStr += `-${cmdName}`;
  return identifierStr;
};

const throttlePrefixCommand = (clientCmd, message, prefix) => {
  const { cooldown, data } = clientCmd;
  const activeCommandName = clientCmd.isAlias ? clientCmd.aliasFor : data.name;
  
  if (cooldown === false) return false;
  
  const cooldownInMS = parseInt(cooldown.duration * MS_IN_ONE_SECOND, 10);
  
  if (!cooldownInMS || cooldownInMS < 0) return false;
  
  const identifierStr = getThrottleId(cooldown, activeCommandName, message);
  
  if (!ThrottleMap.has(identifierStr)) {
    ThrottleMap.set(identifierStr, [Date.now()]);
    setTimeout(() => {
      ThrottleMap.delete(identifierStr);
    }, cooldownInMS);
    return false;
  }
  
  const throttleData = ThrottleMap.get(identifierStr);
  const nonExpired = throttleData.filter((timestamp) => Date.now() < (timestamp + cooldownInMS));
  
  if (nonExpired.length >= cooldown.usages) {
    const timeLeft = Number.parseFloat(((nonExpired[0] + cooldownInMS) - Date.now()) / MS_IN_ONE_SECOND).toFixed(2);
    return `${emojis.error} ${message.member}, you can use **\`${prefix}${data.name}\`** again in ${timeLeft} seconds`;
  }
  
  throttleData.push(Date.now());
  return false;
};

const checkPrefixCommandCanExecute = (client, message, clientCmd) => {
  const { member, channel } = message;
  const { data, permLevel, enabled, clientPerms, userPerms, nsfw } = clientCmd;
  
  if (enabled === false) {
    message.reply(`${emojis.error} ${member}, this command is currently disabled. Please try again later.`);
    return false;
  }
  
  if (isNaN(permLevel)) {
    message.reply(`${emojis.error} ${member}, something went wrong while using this command.`);
    logger.syserr(`Prefix Command returned: Calculated permission level for command ${data.name} is NaN.`);
    return false;
  }
  
  if (member.permLevel < permLevel) {
    message.reply(`${emojis.error} ${member}, you do not have the required permission level to use this command.`);
    return false;
  }
  
  if (clientPerms.length !== 0) {
    const missingPerms = hasChannelPerms(client.user.id, channel, clientPerms);
    
    if (missingPerms !== true) {
      message.reply(`${emojis.error} ${member}, this command can't be executed because I lack the following permissions in ${channel}\n${emojis.separator} ${resolvePermissionArray(missingPerms).join(', ')}`);
      return false;
    }
  }
  
  if (userPerms.length !== 0) {
    const missingPerms = hasChannelPerms(member.user.id, channel, userPerms);
    
    if (missingPerms !== true) {
      message.reply(`${emojis.error} ${member}, this command can't be executed because you lack the following permissions in ${channel}:\n${emojis.separator} ${resolvePermissionArray(missingPerms).join(', ')}`);
      return false;
    }
  }
  
  if (nsfw === true && channel.nsfw !== true) {
    message.reply(`${emojis.error} ${member}, that command is marked as **NSFW**, you can't use it in a **SFW** channel!`);
    return false;
  }
  
  return true;
};

const executePrefixCommand = async (client, message, commandName, args, prefix) => {
  const cmdRunTimeStart = process.hrtime.bigint();
  const { member, guild, channel } = message;
  
  // Resolve command name from alias if needed
  const resolvedCommandName = COMMAND_ALIASES[commandName] || commandName;
  
  // Get the command
  let clientCmd = commands.get(resolvedCommandName);
  
  if (!clientCmd) {
    message.reply(`${emojis.error} ${member}, command \`${prefix}${commandName}\` not found.`);
    return;
  }
  
  // Check if command can execute
  if (!checkPrefixCommandCanExecute(client, message, clientCmd)) {
    return;
  }
  
  // Throttle command (skip for developers)
  if (member.permLevel < 4) {
    const onCooldown = throttlePrefixCommand(clientCmd, message, prefix);
    
    if (onCooldown !== false) {
      message.reply(onCooldown);
      return;
    }
  }
  
  // Convert message to interaction-like object for command compatibility
  const fakeInteraction = {
    member,
    guild,
    channel,
    user: message.author,
    createdTimestamp: message.createdTimestamp,
    options: {
      getString: (name, required) => args[0] || (required ? '' : null),
      getAttachment: () => null,
      // Add more option getters as needed
    },
    reply: async (content) => {
      if (typeof content === 'string') {
        return message.reply(content);
      }
      return message.reply(content);
    },
    editReply: async (content) => {
      // For prefix commands, just send a new message
      if (typeof content === 'string') {
        return message.channel.send(content);
      }
      return message.channel.send(content);
    },
    deferReply: async () => {
      // For prefix commands, send a thinking message
      const thinkingMsg = await message.channel.send(`${emojis.wait} Processing...`);
      fakeInteraction._deferredMessage = thinkingMsg;
      return thinkingMsg;
    },
    // Mark as prefix interaction
    isPrefixCommand: true,
    originalMessage: message
  };
  
  // Handle play command specially to support query argument
  if (resolvedCommandName === 'play' && args.length > 0) {
    fakeInteraction.options.getString = (name, required) => {
      if (name === 'query') {
        return args.join(' ');
      }
      return null;
    };
  }
  
  try {
    await clientCmd.run(client, fakeInteraction);
    
    // Log command execution
    const aliasTag = COMMAND_ALIASES[commandName] ? `(Alias: ${commandName} -> ${resolvedCommandName})` : '';
    console.log([
      `${logger.timestamp()} ${chalk.white('[PREFIX]')}: ${chalk.bold(resolvedCommandName)} ${aliasTag}`,
      guild.name,
      `#${channel.name}`,
      member.user.username
    ].join(chalk.magentaBright(` ${emojis.separator} `)));
    
  } catch (err) {
    logger.syserr(`An error has occurred while executing the prefix command ${chalk.whiteBright(resolvedCommandName)}`);
    console.error(err);
    message.reply(`${emojis.error} ${member}, something went wrong:\n\n${err.message}`);
  }
};

module.exports = {
  checkPrefixCommandCanExecute,
  throttlePrefixCommand,
  executePrefixCommand,
  COMMAND_ALIASES
};
