# Overview

This Discord music bot, built with Discord.js and discord-player, offers a comprehensive music playback solution for Discord servers. It supports streaming from multiple platforms including YouTube, SoundCloud, Apple Music, Vimeo, ReverbNation, and direct audio file attachments. Key features include advanced music controls, queue management, audio filtering, customizable server settings, and high-quality audio streaming. The bot is designed for self-hosting, supporting Docker deployment, and provides features like thread-based music sessions, DJ roles, and persistent configuration.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes

## October 4, 2025 - Download-Based Playback Architecture
- **Complete architectural overhaul**: Switched from streaming to download-first approach for YouTube playback
- **New MusicDownloadManager service**: Handles audio file downloads with concurrency control (max 3 simultaneous)
- **Simplified PlayDLExtractor**: Reduced from 720 lines to 285 lines, focuses on metadata extraction only
- **Download redundancy**: Primary ytdl-core + fallback play-dl for reliable downloads
- **Guild isolation**: Per-guild download directories (./tmp/audio/<guildId>/<trackId>.webm)
- **Automatic cleanup**: Files removed after playback completes, prevents disk bloat
- **Deterministic track IDs**: Uses YouTube video IDs for consistent file naming
- **Dependencies updated**: Removed @distube/ytdl-core and mediaplex, added p-queue and fs-extra
- **Result**: More reliable playback, no premature track endings, proper resource cleanup

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
- **Download-First Architecture**: Audio files downloaded before playback for reliability
- **MusicDownloadManager**: Dedicated service for download orchestration
  - Concurrency control: Max 3 simultaneous downloads via p-queue
  - Download timeout: 45 seconds per attempt
  - Redundancy: ytdl-core (primary) + play-dl (fallback)
  - Caching: Reuses already-downloaded files
  - Storage: ./tmp/audio/<guildId>/<trackId>.webm
- **Extractors**: Platform-specific (SoundCloud, Apple Music, Vimeo, ReverbNation, attachments, YouTube via PlayDL)
- **Search Accuracy**: Enhanced YouTube ranking algorithm considering Topic channels, official audio, VEVO, verified channels, exact matches, quality markers, and view count
- **Cleanup System**: 
  - Per-track cleanup when next track starts
  - Per-guild cleanup on disconnect
  - Automatic temp directory cleanup on bot startup
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
- **Services**: `/src/services/` (MusicDownloadManager)
- **Extractors**: `/src/extractors/` (PlayDLExtractor)

# External Dependencies

## Discord APIs
- **Discord.js v14**: For Discord Bot API interactions
- **@discordjs/rest**: REST API client
- **Gateway Intents**: Guilds, GuildVoiceStates, GuildMessages

## Music Services
- **discord-player v7.1.0**: Music playback framework
- **@discord-player/extractor v7.1.0**: Platform extractors (SoundCloud, Apple Music, Vimeo, ReverbNation, Discord Attachments)
- **ytdl-core v4.11.5**: Primary YouTube audio downloader
- **play-dl v1.9.7**: YouTube metadata + fallback downloader
- **youtube-sr v4.3.12**: YouTube search fallback
- **p-queue v6.6.2**: Download concurrency control
- **fs-extra v11.2.0**: File system operations for downloads

## Database
- **LokiJS**: In-memory document database
- **Storage**: Local file (`QIHeena-music-bot.db`)
- **Adapter**: LokiFsAdapter

## Web Server
- **Express v4.21.2**: HTTP server for health checks and API endpoints
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