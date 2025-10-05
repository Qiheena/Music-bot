# Overview

This Discord music bot, built with Discord.js and discord-player, provides a comprehensive music playback solution for Discord servers. It is optimized for over 90% YouTube playback, utilizing a streaming-only architecture with `play-dl` and `yt-dlp` for maximum reliability. Key features include advanced music controls, queue management, audio filtering, customizable server settings, DJ roles, and persistent configuration. The bot is designed for self-hosting, supporting Docker deployment, and offers thread-based music sessions.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Application Framework
- **Runtime**: Node.js (v20.0.0 - v22.0.0)
- **Bot Framework**: Discord.js v14
- **Music Engine**: discord-player v7
- **Database**: LokiJS (in-memory with filesystem persistence)
- **Primary Source**: YouTube (90%+ of all playback)

## Command Architecture
- **Pattern**: Class-based, prefix-only command system with guild-specific prefixes.
- **Loading**: Dynamic file-based command loader.

## Permission System
- **Levels**: User, Moderator, Administrator, Server Owner, Developer, Bot Owner (hierarchical).
- **Enforcement**: Pre-execution validation based on `permLevel` property. Bot owner bypasses all restrictions.

## Music Session Management
- **State Management**: Guild-based queue system for independent sessions.
- **Features**: Optional dedicated thread channels for music events, voice channel validation.

## Configuration System
- **Static Config**: `config.js` for defaults.
- **Dynamic Config**: Guild-specific settings stored in LokiJS, persisting across restarts.
- **YouTube Optimization**: Non-YouTube sources are disabled in the configuration.

## Audio Processing
- **Streaming-Only Architecture**: Direct streaming using `play-dl` with `yt-dlp` fallback.
- **Extractors**: `PlayDLExtractor` (primary YouTube), `StreamingExtractor` (fallback with `play-dl` then `yt-dlp`), `SpotifyExtractor` (converts to YouTube). Other extractors are disabled.
- **Playback Method Selection**: Prioritizes `play-dl` direct streaming for YouTube, falls back to `yt-dlp`. Spotify tracks are converted to YouTube searches. All queries are forced to YouTube.
- **Format Filters**: `yt-dlp` excludes specific protocols (`http_dash_segments`, `m3u8_native`, `m3u8`) to avoid disk-based fragment downloads.
- **Search Accuracy**: Enhanced YouTube ranking algorithm.
- **Filters**: Support for audio filters and equalizer presets using FFmpeg.

## Interaction Flow
- User invokes prefix command.
- Command handler validates permissions and cooldowns.
- Music commands validate voice state.
- `discord-player` executes music operations via extractors.
- Responses sent via Discord messages/embeds.

## Data Persistence
- **Database File**: `QIHeena-music-bot.db` (LokiJS)
- **Collections**: `guilds` for per-guild settings.
- **Auto-save**: Database saves every 3600 seconds.

## Error Handling
- **Mechanism**: Try-catch blocks.
- **User Feedback**: Descriptive error messages.
- **Logging**: Errors logged via custom logger, with filtered stderr messages.

## Component Organization
- **Modular Structure**: Commands, Interactions, Modules, Handlers, Classes, and Extractors are organized into dedicated directories.

# External Dependencies

## Core Dependencies
- **Discord.js v14.16.3**: Discord Bot API interactions.
- **@discordjs/rest v2.4.0**: REST API client.
- **discord-player v7.1.0**: Music playback framework.
- **@discord-player/extractor v7.1.0**: Platform extractors.

## YouTube/Audio Processing
- **play-dl v1.9.7**: Primary YouTube/SoundCloud direct streaming.
- **yt-dlp-wrap v2.3.12**: Fallback YouTube streaming.
- **youtube-sr v4.3.12**: YouTube search fallback.

## Database
- **LokiJS v1.5.12**: In-memory document database with `LokiFsAdapter` for local file storage.

## Web Server
- **Express v4.21.2**: HTTP server for health checks and API endpoints (e.g., `/api/commands`).
- **Port**: 5000 (default).

## Utilities
- **dotenv v16.4.7**: Environment variable management.
- **chalk v4.1.2**: Terminal output coloring.
- **common-tags v1.8.2**: Template literal formatting.
- **@QIHeena/logger**: Custom logging utility.

## Deployment Options
- **Docker**: Containerized deployment.
- **PM2**: Process manager for production.
- **Replit**: Fully configured for the Replit environment.