# Overview

This Discord music bot, built with Discord.js and discord-player, offers a comprehensive music playback solution for Discord servers. It supports streaming from multiple platforms including YouTube, SoundCloud, Apple Music, Vimeo, ReverbNation, Deezer, and direct audio file attachments. Key features include advanced music controls, queue management, audio filtering, customizable server settings, and high-quality audio streaming. The bot is designed for self-hosting, supporting Docker deployment, and provides features like thread-based music sessions, DJ roles, and persistent configuration.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Application Framework
- **Runtime**: Node.js (v20.0.0 - v22.0.0)
- **Bot Framework**: Discord.js v14
- **Music Engine**: discord-player v7
- **Database**: LokiJS (in-memory with filesystem persistence)

## Command Architecture
- **Pattern**: Class-based command system
- **Command Types**: Chat Input Commands (slash commands), Context Menus, Component Interactions
- **Structure**: Commands categorized by function (e.g., `music/`, `developer/`)
- **Loading**: Dynamic file-based command loader

## Permission System
- **Levels**: User, Moderator, Administrator, Server Owner, Developer, Bot Owner (hierarchical)
- **Implementation**: `permLevel` property on commands
- **Enforcement**: Pre-execution validation

## Music Session Management
- **State Management**: Guild-based queue system
- **Session Isolation**: Per-guild independent queues and settings
- **Thread Sessions**: Optional dedicated thread channels for music events
- **Voice State**: Validation ensures users are in voice channels

## Configuration System
- **Static Config**: `config.js` for default settings
- **Dynamic Config**: Guild-specific settings stored in LokiJS
- **Priority**: Database settings override static defaults
- **Persistence**: Settings persist across bot restarts

## Audio Processing
- **Extractors**: Platform-specific (SoundCloud, Apple Music, Vimeo, ReverbNation, attachments, Deezer, YouTube via PlayDL)
- **Multi-Platform Racing**: Parallel streaming from YouTube and SoundCloud with intelligent priority-based selection
- **Stream Priority**: YouTube (100+ priority) heavily favored over SoundCloud (50+ priority)
- **Fast Playback**: Plays first available stream with 500ms grace period for higher priority sources
- **Timeout**: 10-second timeout per platform for faster response
- **Search Accuracy**: Enhanced YouTube ranking algorithm considering Topic channels, official audio, VEVO, verified channels, exact matches, quality markers, and view count
- **Filters**: Support for audio filters and equalizer presets
- **FFmpeg**: Used for audio processing and format conversion

## Interaction Flow
- User invokes slash command
- Command handler validates permissions and cooldowns
- Music commands validate voice state and session conditions
- `discord-player` executes music operations
- Responses sent via Discord interaction replies/embeds

## Data Persistence
- **Database File**: `QIHeena-music-bot.db` (LokiJS)
- **Collections**: `guilds` collection for per-guild settings
- **Auto-save**: Database saves every 3600 seconds
- **Schema**: Guild documents include volume, repeat mode, DJ roles, etc.

## Error Handling
- **Mechanism**: Try-catch blocks around critical operations
- **User Feedback**: Descriptive error messages via Discord
- **Logging**: Errors logged to console via custom logger

## Component Organization
- **Commands**: `/src/commands/`
- **Interactions**: `/src/interactions/`
- **Modules**: `/src/modules/`
- **Handlers**: `/src/handlers/`
- **Classes**: `/src/classes/`

# External Dependencies

## Discord APIs
- **Discord.js v14**: For Discord Bot API interactions
- **@discordjs/rest**: REST API client
- **Gateway Intents**: Guilds, GuildVoiceStates, GuildMessages

## Music Services
- **discord-player v7.1.0**: Music playback framework
- **@discord-player/extractor v7.1.0**: Platform extractors (SoundCloud, Apple Music, Vimeo, ReverbNation, Discord Attachments)
- **discord-player-deezer**: Deezer music source extractor
- **PlayDL**: YouTube support with parallel search
- **mediaplex**: Audio streaming utility

## Database
- **LokiJS**: In-memory document database
- **Storage**: Local file (`QIHeena-music-bot.db`)
- **Adapter**: LokiFsAdapter

## Web Server
- **Express v4.18.2**: HTTP server for health checks and API endpoints
- **Routes**: `/`, `/api/commands`
- **Port**: 5000 (default)

## Utilities
- **dotenv**: Environment variable management
- **chalk v4**: Terminal output coloring
- **common-tags**: Template literal formatting
- **@QIHeena/logger**: Custom logging utility

## Development Tools
- **semantic-release**: Automated versioning
- **ESLint**: Code linting
- **nodemon**: Development auto-reload

## Deployment Options
- **Docker**: Containerized deployment
- **PM2**: Process manager
- **Replit**: Configured for Replit environment