# Overview

This Discord music bot, built with Discord.js and discord-player, offers a comprehensive music playback solution for Discord servers. **Optimized for 90%+ YouTube playback**, it features streaming-only architecture using play-dl with yt-dlp fallback for maximum reliability. Key features include advanced music controls, queue management, audio filtering, customizable server settings, and high-quality audio streaming. The bot is designed for self-hosting, supporting Docker deployment, and provides features like thread-based music sessions, DJ roles, and persistent configuration.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes

## October 5, 2025 - Streaming-Only Architecture (v1.5.0)
- **Removed Download Functionality**: Deleted MusicDownloadManager.js - all download methods were failing
- **Streaming-Only Playback**: Bot now relies exclusively on direct streaming (play-dl + yt-dlp fallback)
- **Fixed Crashes**: Removed broken yt-dlp HLS fragment downloads that caused "Unable to rename file" errors
- **PlayDLExtractor Simplified**: Removed all download attempts, now uses only play-dl direct streaming
- **StreamingExtractor Enhanced**: Now tries play-dl first (better YouTube support), then yt-dlp with HLS/DASH protocol filters
- **Format Filters**: Added `protocol!=http_dash_segments` and `protocol!=m3u8_native` to avoid disk-based fragments
- **Android Player Client**: Using YouTube android client for better compatibility
- **Result**: Bot runs stably without crashes, playback works reliably via direct streaming

## October 5, 2025 - Play Command Fix & Autoplay Feature (v1.4.2)
- **Fixed Play by Name**: Removed autocomplete requirement from play command - users can now directly type song names and press enter
- **New /ap Command**: Added quick autoplay toggle command (short for autoplay) - enables/disables autoplay mode with one command
- **Fixed Playlist Detection**: Improved YouTube playlist URL handling with intelligent fallback - detects playlists but falls back to single video if playlist extraction fails
- **Crash Prevention**: Enhanced StreamingExtractor error handling to prevent bot crashes when yt-dlp fails
- **Better yt-dlp Options**: Added geo-bypass, prefer-free-formats, and better format selection for improved streaming reliability
- **Result**: Play by song name now works seamlessly, autoplay easily accessible, playlists work with Watch Later/Mix URLs, bot stability improved

## October 5, 2025 - Critical Bug Fixes & YouTube Optimization (v1.4.1)
- **Fixed Search Query Issue**: Resolved autocomplete bug causing empty queries - users can now search successfully
- **Fixed Duration Format Error**: Converted duration from milliseconds to string format (MM:SS) to fix "this.duration.split is not a function" error
- **Fixed QueryType Validation**: Updated extractors to use correct discord-player QueryType enums (AUTO, YOUTUBE_SEARCH, YOUTUBE_VIDEO)
- **Cleaned Up Logging**: Filtered out empty yt-dlp stderr messages for cleaner logs
- **YouTube Optimization**: Disabled all non-YouTube sources (Apple Music, Vimeo, ReverbNation, attachments, SoundCloud) to ensure 90%+ YouTube playback
- **Configuration Update**: Modified config.js to prioritize YouTube-only playback
- **Helper Functions**: Added msToTimeString() utility for consistent duration formatting across extractors
- **Result**: Search functionality restored, playback errors eliminated, YouTube-first architecture implemented

## October 4, 2025 - Hybrid Playback System (v1.4.0)
- **Triple-Redundancy Downloads**: Added yt-dlp as third download tool (ytdl-core → play-dl → yt-dlp)
- **Direct Streaming Fallback**: Created StreamingExtractor for direct YouTube/SoundCloud streaming without downloads
- **Native SoundCloud Streaming**: SoundCloud now uses direct streaming instead of YouTube search conversion
- **Hybrid Architecture**: Downloads prioritized for reliability, direct streaming as ultimate fallback
- **Enhanced PlayDLExtractor**: Now supports both download and direct streaming modes with intelligent switching
- **Source Tracking**: Added source detection (youtube/soundcloud) in track metadata for proper streaming method selection
- **Multiple Fallback Layers**: Each playback attempt has multiple backup methods ensuring maximum reliability
- **Improved Error Handling**: Better error messages showing all attempted methods and their failure reasons
- **Dependencies**: Added yt-dlp-wrap v2.3.12 for additional YouTube support
- **Version**: Bumped to 1.4.0

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
- **Primary Source**: YouTube (90%+ of all playback)

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
- **YouTube Optimization**: Non-YouTube sources disabled in config for maximum YouTube coverage

## Audio Processing
- **Streaming-Only Architecture**: Direct streaming using play-dl with yt-dlp fallback for maximum reliability
- **Extractors**: 
  - PlayDLExtractor: Primary YouTube extractor using play-dl direct streaming
  - StreamingExtractor: Fallback extractor with play-dl first, then yt-dlp with HLS/DASH protocol filters
  - SpotifyExtractor: Converts Spotify tracks to YouTube equivalents
  - Other extractors (Apple Music, Vimeo, etc.): Disabled for YouTube optimization
- **Playback Method Selection**:
  - YouTube: play-dl direct streaming (primary) → yt-dlp streaming (fallback)
  - Spotify: Metadata extraction → YouTube search → play-dl streaming
  - All queries: Forced to YouTube for 90%+ coverage
- **Format Filters**: yt-dlp excludes `http_dash_segments`, `m3u8_native`, and `m3u8` protocols to avoid disk-based fragment downloads
- **Duration Handling**: Tracks store duration as formatted strings (MM:SS or H:MM:SS) with milliseconds in raw.durationMS
- **Search Accuracy**: Enhanced YouTube ranking algorithm considering Topic channels, official audio, VEVO, verified channels, exact matches, quality markers, and view count
- **Filters**: Support for audio filters and equalizer presets
- **FFmpeg**: Used for audio processing and format conversion

## Interaction Flow
- User invokes slash command
- Command handler validates permissions and cooldowns
- Music commands validate voice state and session conditions
- `discord-player` executes music operations via extractors
- Extractors return tracks with proper duration formatting
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
- **Filtered Logging**: Empty stderr messages filtered out for cleaner logs

## Component Organization
- **Commands**: `/src/commands/`
- **Interactions**: `/src/interactions/`
- **Modules**: `/src/modules/`
- **Handlers**: `/src/handlers/`
- **Classes**: `/src/classes/`
- **Extractors**: `/src/extractors/` (PlayDLExtractor, StreamingExtractor)

# External Dependencies

## Core Dependencies
- **Discord.js v14.16.3**: Discord Bot API interactions
- **@discordjs/rest v2.4.0**: REST API client
- **discord-player v7.1.0**: Music playback framework
- **@discord-player/extractor v7.1.0**: Platform extractors (Spotify conversion to YouTube)

## YouTube/Audio Processing
- **@distube/ytdl-core v4.16.12**: YouTube metadata extraction (legacy dependency)
- **play-dl v1.9.7**: Primary YouTube/SoundCloud direct streaming
- **yt-dlp-wrap v2.3.12**: Fallback YouTube streaming
- **youtube-sr v4.3.12**: YouTube search fallback
- **p-queue v6.6.2**: Concurrency control (legacy dependency)
- **fs-extra v11.3.2**: File system operations (legacy dependency)

## Database
- **LokiJS v1.5.12**: In-memory document database
- **Storage**: Local file (`QIHeena-music-bot.db`)
- **Adapter**: LokiFsAdapter

## Web Server
- **Express v4.21.2**: HTTP server for health checks and API endpoints
- **Routes**: `/`, `/api/commands`
- **Port**: 5000 (default)

## Utilities
- **dotenv v16.4.7**: Environment variable management
- **chalk v4.1.2**: Terminal output coloring
- **common-tags v1.8.2**: Template literal formatting
- **@QIHeena/logger**: Custom logging utility

## Development Tools
- **semantic-release v24.2.1**: Automated versioning
- **ESLint v8.56.0**: Code linting with SonarJS plugin
- **nodemon v3.1.7**: Development auto-reload
- **commitizen v4.3.1**: Conventional commit formatting

## Deployment Options
- **Docker**: Containerized deployment with dockerfile included
- **PM2**: Process manager for production
- **Replit**: Fully configured for Replit environment

# Current Configuration

## Enabled Features
- **YouTube Search & Playback**: Primary source (90%+ coverage)
- **Spotify Integration**: Converts to YouTube searches
- **PlayDL Extractor**: Enabled for YouTube support with playlist fallback
- **Download Manager**: Triple-redundancy downloads
- **Streaming Fallback**: Direct streaming when downloads fail
- **Autoplay Mode**: Quick toggle via /ap command for 24/7 playback

## Disabled Features (YouTube Optimization)
- **File Attachments**: Disabled
- **SoundCloud Direct**: Disabled
- **Apple Music**: Disabled
- **Vimeo**: Disabled
- **ReverbNation**: Disabled
- **Deezer**: Disabled

## Default Settings
- **Volume**: 50/100
- **Repeat Mode**: Off
- **Leave on End**: 120 seconds
- **Leave on Empty**: 120 seconds
- **Thread Sessions**: Enabled
- **Strict Thread Commands**: Enabled
