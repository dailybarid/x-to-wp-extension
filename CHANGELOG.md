# Changelog

All notable changes to the X-to-WordPress Chrome extension.

## [1.4.6] - 2025-12-18
### Added
- **Screenshots to README**: Added two-column screenshot display showing extension in action and toolbar view

### Changed
- Updated README with visual documentation of the extension

## [1.4.5] - 2025-12-18
### Fixed
- **Clickable images**: Tweet images now properly link to the original X.com post
- **Image link wrapping**: Corrected HTML structure to ensure images are wrapped in clickable links

### Changed
- Enhanced image HTML generation to maintain proper link structure

## [1.4.4] - 2025-12-18
### Added
- **Clickable links in tweets**: URLs in tweet text are now clickable links in WordPress posts
- **Clickable hashtags**: Hashtags in tweet text link to X.com hashtag searches
- **Clickable mentions**: User mentions (@username) link to X.com profiles
- **Linked images**: Tweet images now link back to the original X.com post

### Changed
- Improved tweet text formatting to preserve links, hashtags, and mentions
- Enhanced content generation to make posts more interactive

## [1.4.3] - 2025-12-18
### Fixed
- **X.com blob URL limitation**: Improved video detection to properly identify video content even when X.com uses inaccessible blob: URLs
- **Video type detection**: Enhanced detection of [data-testid="videoPlayer"] containers to properly identify video content
- **Poster-based video ID extraction**: Added logic to extract video IDs from poster URLs when direct video URLs are not available

### Changed
- Updated video detection to handle X.com's dynamic video loading patterns
- Better mediaType classification based on container detection rather than just URL availability
- Note: Direct video uploading may still fail for blob: URLs due to browser security restrictions

## [1.4.2] - 2025-12-18
### Fixed
- **Complete video detection rewrite**: Implemented multi-strategy approach for detecting videos in X.com DOM
- **Better selector patterns**: Updated selectors to match X.com's current DOM structure for videos
- **Play button detection**: Added specific path data patterns for X.com's play icons
- **Video URL pattern matching**: Improved regex and string matching for video file types

### Changed
- Simplified and focused video detection logic with 3 clear strategies
- Removed complex attribute checking in favor of more reliable selectors
- Better fallback handling for different video content types

## [1.4.1] - 2025-12-18
### Fixed
- **Video detection improvement**: Enhanced video detection by looking for multiple visual indicators (play icons, video containers)
- **Regex syntax fix**: Corrected JavaScript regex syntax error in video URL pattern matching
- **Comprehensive video attribute scanning**: Added scanning for video URLs in various data attributes and element properties
- **Video vs Image detection**: Further refined logic to properly distinguish between videos and images

### Changed
- Improved video detection using visual indicators and path data patterns
- Enhanced scanning for video URLs in data attributes (data-src, data-url, etc.)

## [1.4.0] - 2025-12-18
### Added
- **Enhanced video detection**: Improved algorithms to detect various video patterns in X.com DOM
- **Video URL extraction**: Better methods to extract video URLs from X.com's dynamic content
- **Content-Type header handling**: Use actual content-type headers to determine file extensions when URL doesn't have one

### Fixed
- **Video vs Image detection**: Resolved issue where videos were being detected as images by improving selector logic
- **Proper video embedding**: Ensure videos are embedded with correct `<video>` tags instead of image tags

### Changed
- Improved video detection with multiple selector fallbacks
- Enhanced upload function to determine correct video formats from content-type headers
- More robust video detection that accounts for X.com's dynamic loading patterns

## [1.3.0] - 2025-12-18
### Added
- **Video support**: Properly detect and upload videos from tweets to WordPress media library
- **Quoted tweet support**: Extract text and media from quoted tweets and include in WordPress post
- **Auto-generated tags from tweet hashtags**: Automatically extracts hashtags (#hashtag) from tweets and creates WordPress tags
- **Toggle for auto-tagging**: Option to enable/disable hashtag extraction in popup settings
- **Smart tag handling**: Checks for existing tags before creating new ones, prevents duplicates

### Changed
- Enhanced media detection to distinguish between images and videos
- Updated content generation to properly embed videos in WordPress posts
- Improved upload function to handle different media types with correct MIME types
- Merged auto-generated tags with manually selected default tags
- Enhanced tag processing logic in content script

## [1.2.0] - 2025-12-18
### Added
- **Auto-generated tags from tweet hashtags**: Automatically extracts hashtags (#hashtag) from tweets and creates WordPress tags
- **Toggle for auto-tagging**: Option to enable/disable hashtag extraction in popup settings
- **Smart tag handling**: Checks for existing tags before creating new ones, prevents duplicates

### Changed
- Merged auto-generated tags with manually selected default tags
- Enhanced tag processing logic in content script

## [1.1.0] - 2025-12-18
### Added
- Full **image/media support**: uploads tweet images and OG images from links
- **Category & tag selection** in popup (fetched from WordPress)
- **Draft vs publish toggle**
- **Error logging** in popup UI
- Better DOM selectors for X.com reliability

### Changed
- Replaced placeholder credentials with secure `chrome.storage.sync`
- Improved media upload using WordPress `/media` endpoint
- Button now shows success/failure state

## [1.0.0] - 2025-12-17
### Added
- Initial release
- Injects “Post to WP” button on X.com
- Sends tweet text + author + link to WordPress
- Auto-publishes using Application Passwords