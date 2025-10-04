const { PermissionsBitField } = require('discord.js');

const config = {
  defaultVolume: 50,

  defaultRepeatMode: 0,

  defaultLeaveOnEndCooldown: 120,

  defaultLeaveOnEmpty: true,

  defaultLeaveOnEmptyCooldown: 120,

  defaultUseThreadSessions: true,

  defaultThreadSessionStrictCommandChannel: true,

  plugins: {
    fileAttachments: true,
    soundCloud: false,
    appleMusic: true,
    vimeo: true,
    reverbNation: true,
  },

  presence: {
    status: 'online',
    activities: [
      {
        name: '/play',
        type: 'Listening'
      }
    ]
  },

  permissions: {
    ownerId: '290182686365188096',

    developers: [ '' ]
  },

  supportServerInviteLink: '',

  permissionsBase: [
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.SendMessagesInThreads
  ]
};

module.exports = config;
