let globalCategories = [];
let globalTags = [];

async function fetchWPTaxonomies() {
  const settings = await chrome.storage.sync.get(['wpUrl', 'wpUsername', 'wpAppPassword']);
  if (!settings.wpUrl) return;

  try {
    const auth = btoa(settings.wpUsername + ':' + settings.wpAppPassword);
    const catRes = await fetch(`${settings.wpUrl}/wp-json/wp/v2/categories?per_page=100`, {
      headers: { 'Authorization': 'Basic ' + auth }
    });
    const tagRes = await fetch(`${settings.wpUrl}/wp-json/wp/v2/tags?per_page=100`, {
      headers: { 'Authorization': 'Basic ' + auth }
    });

    globalCategories = catRes.ok ? await catRes.json() : [];
    globalTags = tagRes.ok ? await tagRes.json() : [];
  } catch (e) {
    console.warn('Could not fetch WP taxonomies:', e);
  }
}

fetchWPTaxonomies();

const observer = new MutationObserver(() => addPostButton());
observer.observe(document.body, { childList: true, subtree: true });
setTimeout(addPostButton, 1000);

function addPostButton() {
  document.querySelectorAll('[data-testid="tweet"]').forEach(tweet => {
    if (tweet.querySelector('.post-to-wp-btn')) return;

    const actionBar = tweet.querySelector('[role="group"]');
    if (!actionBar) return;

    const btn = document.createElement('button');
    btn.className = 'post-to-wp-btn';
    btn.innerHTML = '📝 Post to WP';
    btn.style = `
      background: #1da1f2; color: white; border: none; border-radius: 4px;
      padding: 4px 8px; font-size: 12px; cursor: pointer; margin-left: 8px;
    `;
    
    btn.onclick = async () => {
      const data = await extractTweetDataWithMedia(tweet);
      if (!data) return;

      const success = await sendToWordPress(data);
      btn.textContent = success ? '✅ Posted!' : '❌ Failed';
      btn.style.background = success ? '#4CAF50' : '#f44336';
    };

    actionBar.appendChild(btn);
  });
}

async function extractTweetDataWithMedia(tweet) {
  const textEl = tweet.querySelector('[data-testid="tweetText"]');
  if (!textEl) return null;

  let text = textEl.innerText;
  const authorLink = tweet.querySelector('[data-testid="User-Name"] a')?.href;
  const tweetUrl = tweet.querySelector('a[href*="/status/"]')?.href || window.location.href;
  const author = authorLink ? authorLink.split('/')[3] : 'unknown';

  // Handle quoted tweets by extracting their content
  const quotedTweet = tweet.querySelector('[data-testid="quotedTweet"]');
  if (quotedTweet) {
    const quoteTextEl = quotedTweet.querySelector('[data-testid="tweetText"]');
    const quoteAuthorEl = quotedTweet.querySelector('[data-testid="User-Name"] a');
    const quoteUrlEl = quotedTweet.querySelector('a[href*="/status/"]');

    if (quoteTextEl) {
      const quoteText = quoteTextEl.innerText;
      const quoteAuthor = quoteAuthorEl ? quoteAuthorEl.href.split('/')[3] : 'unknown';
      const quoteUrl = quoteUrlEl ? quoteUrlEl.href : '';

      // Append quoted tweet to the main text
      text += `\n\nQuote from @${quoteAuthor}: ${quoteText}${quoteUrl ? ` (${quoteUrl})` : ''}`;
    }
  }

  // Enhanced video detection by looking for video indicators in the DOM structure
  let mediaUrl = '';
  let mediaType = 'image'; // default to image

  // Look for video player container first
  const videoPlayer = tweet.querySelector('[data-testid="videoPlayer"]');
  if (videoPlayer) {
    mediaType = 'video'; // Mark as video since we found video player

    // Check if there's a poster image that might lead to actual video URL
    const videoElement = videoPlayer.querySelector('video');
    if (videoElement) {
      // Look for the poster attribute which often contains a URL related to the video
      const poster = videoElement.getAttribute('poster');

      // Sometimes we can extract the video ID from the poster URL and construct the video URL
      if (poster) {
        // Extract video ID from poster URL
        const match = poster.match(/amplify_video_thumb\/(\d+)\//);
        if (match) {
          // Try to construct the video URL based on the video ID
          // This is a common pattern in X.com
          const videoId = match[1];
          // Try to get video URL from other sources in the tweet or from the API directly
        }
      }

      // Look for source elements with different URL patterns
      const sourceElements = videoElement.querySelectorAll('source');
      for (const source of sourceElements) {
        const src = source.getAttribute('src');
        if (src && !src.startsWith('blob:')) { // Skip blob URLs as they're not accessible
          mediaUrl = src;
          break;
        }
      }

      // If we still don't have a valid URL, try to find other video-related URLs in the tweet
      if (!mediaUrl || mediaUrl.startsWith('blob:')) {
        // Look for video.twimg.com URLs in the tweet
        const tweetTextContent = tweet.textContent || '';
        const videoUrlMatches = tweetTextContent.match(/https:\/\/.*?video\.twimg\.com\/.*?\.(mp4|mov|avi|webm)/gi);
        if (videoUrlMatches) {
          mediaUrl = videoUrlMatches[0];
        } else {
          // Look for data attributes that might contain video URLs
          const allElements = tweet.querySelectorAll('*');
          for (const el of allElements) {
            if (el !== videoElement) { // Skip the video element itself
              const attrs = ['data-url', 'data-src', 'data-source'];
              for (const attr of attrs) {
                const val = el.getAttribute(attr);
                if (val && (val.includes('video.twimg.com') || /\.(mp4|mov|avi|webm)/i.test(val))) {
                  mediaUrl = val;
                  break;
                }
              }
              if (mediaUrl) break;
            }
          }
        }
      }
    }
  }

  // Fallback to image detection if no video URL was found
  if (!mediaUrl && mediaType === 'image') {
    const img = tweet.querySelector('[data-testid="tweetPhoto"] img');
    if (img) {
      mediaUrl = img.src.replace(/&name=\w+/, '&name=orig');
      mediaType = 'image';
    } else {
      // Fallback for OG image or video
      try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(tweetUrl)}`;
        const res = await fetch(proxyUrl);
        const html = await res.json();
        const ogImageMatch = html.contents.match(/<meta property="og:image" content="([^"]+)"/);
        const ogVideoMatch = html.contents.match(/<meta property="og:video" content="([^"]+)"/);

        if (ogVideoMatch) {
          mediaUrl = ogVideoMatch[1];
          mediaType = 'video';
        } else if (ogImageMatch) {
          mediaUrl = ogImageMatch[1];
          mediaType = 'image';
        }
      } catch (e) {
        console.log('OG media fallback failed', e);
      }
    }
  }

  return { text, author, url: tweetUrl, mediaUrl, mediaType };
}

async function sendToWordPress(data) {
  const settings = await chrome.storage.sync.get([
    'wpUrl', 'wpUsername', 'wpAppPassword',
    'defaultCategory', 'defaultTags', 'postStatus', 'enableAutoTags'
  ]);

  if (!settings.wpUrl || !settings.wpUsername || !settings.wpAppPassword) {
    chrome.runtime.sendMessage({ error: 'WordPress settings missing' });
    return false;
  }

  const auth = btoa(settings.wpUsername + ':' + settings.wpAppPassword);
  const apiUrl = `${settings.wpUrl}/wp-json/wp/v2/posts`;

  // Format tweet text to make links, hashtags, and mentions clickable
  let formattedText = formatTweetText(data.text, data.url, data.author);

  let content = `<blockquote class="x-tweet">${formattedText}<cite>— <a href="${data.url}">@${data.author}</a></cite></blockquote>`;

  let featuredMedia = null;
  if (data.mediaUrl) {
    try {
      const mediaId = await uploadMediaToWP(data.mediaUrl, auth, settings.wpUrl, data.mediaType);
      if (mediaId) {
        featuredMedia = mediaId;
        if (data.mediaType === 'video') {
          content += `<figure><video controls src="${data.mediaUrl}" alt="Tweet video"><a href="${data.mediaUrl}">View Video</a></video></figure>`;
        } else {
          content += `<figure><a href="${data.url}"><img src="${data.mediaUrl}" alt="Tweet media"></a></figure>`;
        }
      }
    } catch (e) {
      console.warn('Media upload failed', e);
    }
  }

  // Prepare tags - combine default tags with auto-generated tags
  let finalTags = [...(settings.defaultTags ? settings.defaultTags.map(t => parseInt(t)) : [])];

  // If auto-tagging is enabled, extract hashtags from the tweet
  if (settings.enableAutoTags) {
    const autoTags = await extractAndCreateTags(data.text, auth, settings.wpUrl);
    finalTags = [...new Set([...finalTags, ...autoTags])]; // Merge and deduplicate
  }

  const postData = {
    title: data.text.substring(0, 60) + (data.text.length > 60 ? '...' : ''),
    content,
    status: settings.postStatus || 'draft',
    categories: settings.defaultCategory ? [parseInt(settings.defaultCategory)] : [],
    tags: finalTags,
    ...(featuredMedia ? { featured_media: featuredMedia } : {})
  };

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + auth
      },
      body: JSON.stringify(postData)
    });

    if (!res.ok) {
      const errText = await res.text();
      chrome.runtime.sendMessage({ error: `WP API error: ${res.status} ${errText}` });
      return false;
    }
    return true;
  } catch (e) {
    chrome.runtime.sendMessage({ error: 'Network error: ' + e.message });
    return false;
  }
}

// Function to extract hashtags from tweet and create WordPress tags
async function extractAndCreateTags(tweetText, auth, wpUrl) {
  const tags = [];

  // Extract hashtags from the tweet text
  const hashtagRegex = /#(\w+)/g;
  let match;
  while ((match = hashtagRegex.exec(tweetText)) !== null) {
    const tagName = match[1].toLowerCase(); // Convert to lowercase for consistency
    if (tagName.length > 0) {
      // Check if tag exists, if not create it
      let tagId = await getOrCreateTag(tagName, auth, wpUrl);
      if (tagId) {
        tags.push(tagId);
      }
    }
  }

  return tags;
}

// Function to format tweet text with clickable links, hashtags, and mentions
function formatTweetText(text, tweetUrl, author) {
  let formatted = text;

  // Convert URLs to clickable links
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  formatted = formatted.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener">$1</a>');

  // Convert hashtags to clickable links that search on X.com
  const hashtagRegex = /#(\w+)/g;
  formatted = formatted.replace(hashtagRegex, '<a href="https://x.com/hashtag/$1" target="_blank" rel="noopener">#$1</a>');

  // Convert mentions to clickable links to user profiles
  const mentionRegex = /@(\w+)/g;
  formatted = formatted.replace(mentionRegex, '<a href="https://x.com/$1" target="_blank" rel="noopener">@$1</a>');

  // Replace newlines with paragraph tags
  formatted = formatted.replace(/\n/g, '</p><p>');

  // Wrap content in paragraph tags if not already wrapped
  if (!formatted.startsWith('<p>')) {
    formatted = `<p>${formatted}</p>`;
  }

  // Clean up any double paragraph tags
  formatted = formatted.replace(/<\/p><p><\/p><p>/g, '</p><p>');

  return formatted;
}

// Function to get or create a WordPress tag
async function getOrCreateTag(tagName, auth, wpUrl) {
  try {
    // First, try to find if the tag already exists
    const searchUrl = `${wpUrl}/wp-json/wp/v2/tags?search=${encodeURIComponent(tagName)}&per_page=1`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        'Authorization': 'Basic ' + auth
      }
    });

    if (searchRes.ok) {
      const existingTags = await searchRes.json();
      if (existingTags.length > 0) {
        // Check if the exact tag name matches
        const exactMatch = existingTags.find(tag => tag.name.toLowerCase() === tagName.toLowerCase());
        if (exactMatch) {
          return exactMatch.id;
        }
      }
    }

    // If tag doesn't exist, create it
    const createRes = await fetch(`${wpUrl}/wp-json/wp/v2/tags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + auth
      },
      body: JSON.stringify({
        name: tagName
      })
    });

    if (createRes.ok) {
      const newTag = await createRes.json();
      return newTag.id;
    }

    // If creation failed due to duplicate (race condition), try to fetch again
    if (createRes.status === 400 || createRes.status === 409) {
      // Try to find the tag again after the failed creation attempt
      const retryRes = await fetch(`${wpUrl}/wp-json/wp/v2/tags?search=${encodeURIComponent(tagName)}&per_page=1`, {
        headers: {
          'Authorization': 'Basic ' + auth
        }
      });

      if (retryRes.ok) {
        const tags = await retryRes.json();
        if (tags.length > 0) {
          const exactMatch = tags.find(tag => tag.name.toLowerCase() === tagName.toLowerCase());
          if (exactMatch) {
            return exactMatch.id;
          }
        }
      }
    }

    return null;
  } catch (e) {
    console.warn(`Failed to get/create tag "${tagName}":`, e);
    return null;
  }
}

async function uploadMediaToWP(mediaUrl, auth, wpUrl, mediaType = 'image') {
  const mediaRes = await fetch(mediaUrl);
  const mediaBlob = await mediaRes.blob();

  // Determine file extension and content type based on media type
  let fileName, mimeType;
  if (mediaType === 'video') {
    // Extract file extension from URL or determine from content-type header
    let ext = 'mp4'; // default video extension

    // Try to get extension from URL
    const urlExt = mediaUrl.split('.').pop().split(/[?#]/)[0].toLowerCase();
    const validVideoExts = ['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm', 'm4v'];
    if (validVideoExts.includes(urlExt)) {
      ext = urlExt;
    } else {
      // If no clear extension, try to determine from content-type
      const contentType = mediaRes.headers.get('Content-Type');
      if (contentType) {
        if (contentType.includes('video/')) {
          ext = contentType.split('/')[1].split(';')[0];
          if (ext === 'quicktime') ext = 'mov'; // map quicktime to mov
        }
      }
    }

    fileName = `tweet-media.${ext}`;
    mimeType = `video/${ext === 'mov' ? 'quicktime' : ext}`;
  } else {
    fileName = 'tweet-media.jpg';
    mimeType = 'image/jpeg';
  }

  const formData = new FormData();
  formData.append('file', mediaBlob, fileName);

  const uploadRes = await fetch(`${wpUrl}/wp-json/wp/v2/media`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + auth
    },
    body: formData
  });

  if (uploadRes.ok) {
    const media = await uploadRes.json();
    return media.id;
  }
  return null;
}
