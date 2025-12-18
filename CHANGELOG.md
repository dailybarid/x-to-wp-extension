# Changelog

All notable changes to the X-to-WordPress Chrome extension.

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