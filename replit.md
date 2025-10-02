# Mirasaki Music Bot - Replit Setup

## Overview
This is a free, open-source Discord music bot created with discord.js and discord-player. It features 45+ commands including music playback, audio filters, DJ roles, thread sessions, and persistent settings.

**Version:** 1.2.2  
**Author:** Richard Hillebrand (Mirasaki)  
**License:** MIT

## Current State
The bot has been successfully configured to run on Replit with:
- ✅ FFmpeg installed for audio processing
- ✅ All npm dependencies installed (express, moment, discord.js, discord-player, etc.)
- ✅ Default environment variable configurations set
- ✅ Workflow configured to run the bot with `node .`

The bot is ready to run once you provide your Discord bot credentials.

## Recent Changes (October 2, 2025)
- Added default values for environment variables in `src/index.js` to handle Replit environment
- Added default values for Discord API configuration in `src/handlers/commands.js`
- Installed system dependency: ffmpeg-full
- Installed Node.js packages: express, moment
- Configured workflow to run the Discord bot

## Required Setup

### 1. Discord Bot Token Configuration
You need to add your Discord bot credentials as secrets in Replit:

**Required Secrets:**
- `DISCORD_BOT_TOKEN` - Your Discord bot token from the Discord Developer Portal
- `DISCORD_CLIENT_ID` - Your Discord application client ID

**To get these credentials:**
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application or select an existing one
3. Go to "Bot" section and click "Reset Token" to get your bot token
4. Copy the Application ID from the "General Information" section for the client ID

### 2. Bot Permissions
When inviting the bot to your server, make sure it has these permissions:
- View Channel
- Send Messages
- Send Messages in Threads
- Embed Links
- Connect (to voice channels)
- Speak (in voice channels)

**Invite URL Template:**
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=0&scope=bot%20applications.commands
```

### 3. Configuration (Optional)
The bot configuration can be customized in `/config.js`:
- Default volume (0-100)
- Repeat modes (off, track, queue, autoplay)
- Leave on empty/end cooldowns
- Thread session settings
- Music source plugins (SoundCloud, Apple Music, Vimeo, ReverbNation)
- Bot presence/activity
- Permission levels (owner ID, developers)

## Project Architecture

### Directory Structure
```
src/
├── commands/          # Slash commands organized by category
│   ├── developer/     # Developer-only commands
│   ├── music/         # Basic music commands
│   ├── music-admin/   # Server admin music settings
│   ├── music-dj/      # DJ role music controls
│   └── system/        # System/utility commands
├── interactions/      # Discord interactions
│   ├── autocomplete/  # Autocomplete handlers
│   ├── buttons/       # Button interaction handlers
│   ├── modals/        # Modal interaction handlers
│   └── select-menus/  # Select menu handlers
├── listeners/         # Event listeners
│   ├── client/        # Client events
│   ├── guild/         # Guild events
│   └── interaction/   # Interaction events
├── handlers/          # Command and permission handlers
├── modules/           # Core modules (database, music)
├── server/            # Optional web API (disabled by default)
└── config/            # Color and emoji configurations

config.js              # Main bot configuration
vendor/                # Local dependencies
```

### Key Features
- **45+ Commands** including play, queue, skip, volume, filters, equalizer, and more
- **Persistent Settings** using LokiJS database
- **Thread Sessions** for organized music playback
- **DJ Roles** for music control permissions
- **Vote Skip** system
- **Audio Filters** with 60+ effects
- **Lyrics** with autocomplete search
- **24/7 Autoplay** mode available

### Music Sources Supported
- SoundCloud (disabled by default in config.js)
- Apple Music
- Vimeo
- ReverbNation
- Discord file attachments

**Note:** YouTube and Spotify are not supported due to their Terms of Service.

## Technical Details

### Dependencies
**Core:**
- discord.js v14.16.3
- discord-player v6.7.1
- @discord-player/extractor v4.5.1

**Utilities:**
- express (for optional web API)
- lokijs (for persistent database)
- moment (for time formatting)
- chalk (for colored logging)

**System:**
- FFmpeg (for audio processing)
- Node.js 20.x (specified in package.json engines)

### Environment Variables
The following environment variables have default values set:
- `CHAT_INPUT_COMMAND_DIR` = 'src/commands'
- `CONTEXT_MENU_COMMAND_DIR` = 'src/context-menus'
- `AUTO_COMPLETE_INTERACTION_DIR` = 'src/interactions/autocomplete'
- `BUTTON_INTERACTION_DIR` = 'src/interactions/buttons'
- `MODAL_INTERACTION_DIR` = 'src/interactions/modals'
- `SELECT_MENU_INTERACTION_DIR` = 'src/interactions/select-menus'

Optional variables:
- `DEBUG_ENABLED` - Enable debug logging
- `USE_API` - Enable web API on port 3000
- `TEST_SERVER_GUILD_ID` - For testing commands in a specific server

### Database
The bot uses LokiJS for persistent storage of:
- Guild-specific settings
- DJ roles
- Music channels
- Volume preferences
- Repeat modes
- Thread session preferences

Database files (*.db) are automatically created and saved in the project root.

## User Preferences
- This is a Discord bot project with no special coding style preferences documented yet
- Uses JavaScript (Node.js 20.x)
- Uses discord.js v14 with slash commands and modern Discord components

## Support
- Original support server: https://discord.gg/mirasaki
- GitHub: https://github.com/Mirasaki/mirasaki-music-bot
- Issues: https://github.com/Mirasaki/mirasaki-music-bot/issues

## Notes
- The bot runs as a console application (not a web service)
- Express webserver is included but runs independently on port 3000 (disabled by default)
- The bot requires a Discord bot token to connect and will show an error until configured
- All commands use Discord's slash command system
- Permission levels are configurable in config.js
