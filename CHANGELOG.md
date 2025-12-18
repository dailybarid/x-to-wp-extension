# Changelog

All notable changes to the X-to-WordPress Chrome extension.

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