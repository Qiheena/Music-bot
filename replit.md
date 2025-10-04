# Overview

This is a Discord music bot built with Discord.js and discord-player. The bot enables server members to play music from various streaming platforms including SoundCloud, Apple Music, Vimeo, ReverbNation, and direct audio file attachments. It provides comprehensive music playback controls, queue management, audio filtering, and customizable server-specific settings.

The bot is designed as a self-hosted solution, giving server administrators full control over their music bot instance. It supports Docker deployment and includes features like thread-based music sessions, DJ roles, audio filters, equalizers, and persistent configuration.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Application Framework
- **Runtime**: Node.js (v20.0.0 - v22.0.0)
- **Bot Framework**: Discord.js v14 for Discord API interactions
- **Music Engine**: discord-player v6 for audio playback management
- **Database**: LokiJS in-memory document database with filesystem persistence

**Design Rationale**: Discord.js provides robust Discord API integration, while discord-player abstracts complex audio streaming logic. LokiJS was chosen for its lightweight, file-based persistence without requiring external database services, making deployment simpler.

## Command Architecture
- **Pattern**: Class-based command system with separate command categories
- **Command Types**: Chat Input Commands (slash commands), Context Menus, and Component Interactions
- **Structure**: Commands organized in directories by category (`music/`, `music-admin/`, `music-dj/`, `developer/`, `system/`)
- **Loading**: Dynamic file-based command loader that scans directories and registers commands at runtime

**Design Rationale**: Class-based commands enable code reuse and consistent structure. Category-based organization improves maintainability. Dynamic loading allows hot-reloading of commands during development.

## Permission System
- **Levels**: User, Moderator, Administrator, Server Owner, Developer, Bot Owner (hierarchical)
- **Implementation**: Permission level checking via `permLevel` property on commands
- **Enforcement**: Pre-execution validation in command handler

**Design Rationale**: Hierarchical permission levels provide fine-grained access control beyond Discord's native permission system, enabling music-specific roles like "DJ" without granting broader server permissions.

## Music Session Management
- **State Management**: Guild-based queue system using discord-player's useQueue/usePlayer hooks
- **Session Isolation**: Per-guild music sessions with independent queues and settings
- **Thread Sessions**: Optional dedicated thread channels for music events to reduce channel clutter
- **Voice State**: Validation ensures users are in voice channels before music commands execute

**Design Rationale**: Guild-scoped sessions prevent cross-server interference. Thread sessions organize music-related messages separately from general chat.

## Configuration System
- **Static Config**: `config.js` for default settings (volume, repeat mode, timeouts)
- **Dynamic Config**: Guild-specific settings stored in LokiJS database
- **Priority**: Database settings override static defaults
- **Persistence**: Settings persist across bot restarts via database auto-save

**Design Rationale**: Two-tier configuration allows sensible defaults while enabling per-guild customization. Database persistence ensures settings survive restarts without manual configuration.

## Audio Processing
- **Extractors**: Platform-specific extractors for SoundCloud, Apple Music, Vimeo, ReverbNation, and attachments
- **Filters**: Support for audio filters (bassboost, nightcore, etc.) and equalizer presets
- **FFmpeg**: Audio processing via FFmpeg for applying filters and format conversion

**Design Rationale**: Extractor plugins isolate platform-specific logic. FFmpeg provides industry-standard audio processing capabilities.

## Interaction Flow
1. User invokes slash command
2. Command handler validates permissions and cooldowns
3. Music commands validate voice state and session conditions
4. discord-player executes music operations (search, queue, playback)
5. Responses sent via Discord interaction replies or embeds

## Data Persistence
- **Database File**: `QIHeena-music-bot.db` (LokiJS)
- **Collections**: `guilds` collection stores per-guild settings
- **Auto-save**: Database saves every 3600 seconds (1 hour)
- **Schema**: Guild documents include settings like volume, repeat mode, DJ roles, music channels, cooldowns

**Design Rationale**: File-based database eliminates external dependencies while maintaining persistent state. Hourly auto-save balances data integrity with I/O overhead.

## Error Handling
- **Try-Catch**: Wrapped around critical operations (playback, search, queue management)
- **User Feedback**: Errors displayed to users via Discord messages with descriptive text
- **Logging**: Errors logged to console via custom logger module

## Component Organization
- **Commands**: `/src/commands/` - organized by category
- **Interactions**: `/src/interactions/` - autocomplete and component handlers
- **Modules**: `/src/modules/` - core functionality (database, music utilities)
- **Handlers**: `/src/handlers/` - command registration, permission validation
- **Classes**: `/src/classes/` - base command classes

# External Dependencies

## Discord APIs
- **Discord.js v14**: Primary library for Discord Bot API interactions
- **@discordjs/rest**: REST API client for Discord endpoints
- **Gateway Intents**: Guilds, GuildVoiceStates, GuildMessages

## Music Services
- **discord-player v6**: Music playback framework with queue management
- **@discord-player/extractor**: Platform extractors for:
  - SoundCloud
  - Apple Music
  - Vimeo
  - ReverbNation
  - Discord Attachments
- **mediaplex**: Audio streaming utility

**Note**: YouTube and Spotify support were removed (as of v1.2.2)

## Database
- **LokiJS**: In-memory document database with filesystem persistence
- **Storage**: Local file (`QIHeena-music-bot.db`)
- **Adapter**: LokiFsAdapter for filesystem operations

## Web Server
- **Express v4.18.2**: HTTP server for health checks and API endpoints
- **Routes**: 
  - `/` - Health check endpoint
  - `/api/commands` - Command metadata endpoint
- **Port**: 5000 (default) or configurable via PORT environment variable
- **Host**: Binds to 0.0.0.0 for Replit compatibility

## Utilities
- **dotenv**: Environment variable management
- **chalk v4**: Terminal output coloring
- **common-tags**: Template literal formatting
- **@mirasaki/logger**: Custom logging utility (vendor package)

## Development Tools
- **semantic-release**: Automated versioning and changelog generation
- **ESLint**: Code linting with SonarJS plugin
- **nodemon**: Development auto-reload
- **commitizen**: Conventional commit formatting

## Deployment Options
- **Docker**: Containerized deployment with docker-compose support (uses Node 20-slim)
- **PM2**: Process manager for production deployments
- **Native**: Direct Node.js execution
- **Replit**: Configured for Replit environment with port 5000

# Recent Changes

## October 4, 2025
- **Bug Fix**: Changed `skipOnNoStream` from `true` to `false` in play command to prevent songs from being skipped immediately when audio stream extraction takes time
- **Port Update**: Updated default webserver port from 3000 to 5000 for Replit compatibility
- **Configuration Files**: Added `.env.example` and `config.example.js` files for easier setup
- **Docker Update**: Updated Dockerfile to use Node 20-slim (matching package.json requirements) and expose port 5000
- **Replit Compatibility**: Updated webserver to bind to 0.0.0.0 for proper operation in Replit environment