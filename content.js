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

  // Extract video URL if present
  let mediaUrl = '';
  let mediaType = 'image'; // default to image

  // More comprehensive video detection for X.com
  // Look for video elements and video-specific containers
  const videoElement = tweet.querySelector('video');
  if (videoElement) {
    // Video element exists, try to get the source
    const sourceElements = videoElement.querySelectorAll('source');
    if (sourceElements.length > 0) {
      // Get the last source element (usually highest quality)
      mediaUrl = sourceElements[sourceElements.length - 1].src;
      mediaType = 'video';
    } else if (videoElement.src) {
      mediaUrl = videoElement.src;
      mediaType = 'video';
    } else {
      // Video source might be loaded after interaction, try to find in data attributes
      const parentContainer = videoElement.closest('[data-testid*="video"], [data-testid="cellInnerDiv"]');
      if (parentContainer) {
        // Check for video URLs in parent containers
        const videoLink = parentContainer.querySelector('a[href*="/video/"]');
        if (videoLink) {
          mediaUrl = videoLink.href;
          mediaType = 'video';
        }
      }
    }
  }

  // If no direct video element found, look for X.com video patterns
  if (!mediaUrl && mediaType === 'image') {
    // Try to identify video content by looking for video player containers
    const videoContainers = [
      tweet.querySelector('[data-testid="videoPlayer"]'),
      tweet.querySelector('[data-testid*="player"]'),
      tweet.querySelector('div[data-testid*="video"]')
    ].filter(Boolean);

    if (videoContainers.length > 0) {
      const videoContainer = videoContainers[0];

      // Look for video sources in container or related elements
      const sources = videoContainer.querySelectorAll('source');
      if (sources.length > 0) {
        mediaUrl = sources[sources.length - 1].src;  // Use highest quality
        mediaType = 'video';
      } else {
        // Look for a video element nested inside
        const nestedVideo = videoContainer.querySelector('video');
        if (nestedVideo && nestedVideo.src) {
          mediaUrl = nestedVideo.src;
          mediaType = 'video';
        } else {
          // Try to find video in related links or data attributes
          const possibleVideoUrl = videoContainer.querySelector('a')?.href;
          if (possibleVideoUrl && (possibleVideoUrl.includes('/video/') ||
                                   possibleVideoUrl.includes('video.twimg.com'))) {
            mediaUrl = possibleVideoUrl;
            mediaType = 'video';
          }
        }
      }
    }
  }

  // If still no video found, check for play buttons which often indicate video content
  if (!mediaUrl && mediaType === 'image') {
    const playButton = tweet.querySelector('[data-testid="playButton"]');
    if (playButton) {
      // A play button usually means there's a video, try to find its URL
      const parentElement = playButton.closest('[data-testid*="video"], [data-testid="cellInnerDiv"]');
      if (parentElement) {
        // Look for video URL in the parent element or its children
        const videoElement = parentElement.querySelector('video');
        if (videoElement && videoElement.src) {
          mediaUrl = videoElement.src;
          mediaType = 'video';
        } else {
          // Look for any URLs in the parent that might be video-related
          const links = parentElement.querySelectorAll('a');
          for (const link of links) {
            if (link.href.includes('video.twimg.com') ||
                link.href.includes('/video/') ||
                link.href.includes('.mp4') ||
                link.href.includes('.mov')) {
              mediaUrl = link.href;
              mediaType = 'video';
              break;
            }
          }
        }
      }
    }
  }

  // If no video found, look for images
  if (!mediaUrl && mediaType === 'image') {
    const img = tweet.querySelector('[data-testid="tweetPhoto"] img');
    if (img) {
      mediaUrl = img.src.replace(/&name=\w+/, '&name=orig');
      mediaType = 'image';
    } else {
      // Fallback for OG image
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

  let content = `<blockquote class="x-tweet"><p>${data.text.replace(/\n/g, '</p><p>')}</p><cite>— <a href="${data.url}">@${data.author}</a></cite></blockquote>`;

  let featuredMedia = null;
  if (data.mediaUrl) {
    try {
      const mediaId = await uploadMediaToWP(data.mediaUrl, auth, settings.wpUrl, data.mediaType);
      if (mediaId) {
        featuredMedia = mediaId;
        if (data.mediaType === 'video') {
          content += `<figure><video controls src="${data.mediaUrl}" alt="Tweet video"><a href="${data.mediaUrl}">View Video</a></video></figure>`;
        } else {
          content += `<figure><img src="${data.mediaUrl}" alt="Tweet media"></figure>`;
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
