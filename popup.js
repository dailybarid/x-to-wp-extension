document.addEventListener('DOMContentLoaded', async () => {
  const settings = await chrome.storage.sync.get([
    'wpUrl', 'wpUsername', 'wpAppPassword',
    'postStatus', 'defaultCategory', 'defaultTags'
  ]);

  document.getElementById('wpUrl').value = settings.wpUrl || '';
  document.getElementById('wpUsername').value = settings.wpUsername || '';
  document.getElementById('wpAppPassword').value = settings.wpAppPassword || '';
  document.getElementById('postStatus').value = settings.postStatus || 'draft';

  await loadTaxonomies(settings.wpUrl, settings.wpUsername, settings.wpAppPassword);
  if (settings.defaultCategory) {
    document.getElementById('defaultCategory').value = settings.defaultCategory;
  }
  if (settings.defaultTags) {
    const tagSelect = document.getElementById('defaultTags');
    settings.defaultTags.forEach(tagId => {
      const option = tagSelect.querySelector(`option[value="${tagId}"]`);
      if (option) option.selected = true;
    });
  }

  chrome.runtime.onMessage.addListener((request) => {
    if (request.error) {
      const log = document.getElementById('errorLog');
      log.textContent = `[${new Date().toLocaleTimeString()}] ${request.error}`;
      log.style.display = 'block';
    }
  });
});

async function loadTaxonomies(wpUrl, wpUsername, wpAppPassword) {
  if (!wpUrl || !wpUsername || !wpAppPassword) return;

  try {
    const auth = btoa(wpUsername + ':' + wpAppPassword);
    const [catRes, tagRes] = await Promise.all([
      fetch(`${wpUrl}/wp-json/wp/v2/categories?per_page=100`, {
        headers: { 'Authorization': 'Basic ' + auth }
      }),
      fetch(`${wpUrl}/wp-json/wp/v2/tags?per_page=100`, {
        headers: { 'Authorization': 'Basic ' + auth }
      })
    ]);

    const catSelect = document.getElementById('defaultCategory');
    catSelect.innerHTML = '<option value="">— None —</option>';
    if (catRes.ok) {
      const cats = await catRes.json();
      cats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        catSelect.appendChild(opt);
      });
    }

    const tagSelect = document.getElementById('defaultTags');
    tagSelect.innerHTML = '';
    if (tagRes.ok) {
      const tags = await tagRes.json();
      tags.forEach(tag => {
        const opt = document.createElement('option');
        opt.value = tag.id;
        opt.textContent = tag.name;
        tagSelect.appendChild(opt);
      });
    }
  } catch (e) {
    console.error('Failed to load taxonomies', e);
  }
}

document.getElementById('save').addEventListener('click', async () => {
  const wpUrl = document.getElementById('wpUrl').value;
  const wpUsername = document.getElementById('wpUsername').value;
  const wpAppPassword = document.getElementById('wpAppPassword').value;
  const postStatus = document.getElementById('postStatus').value;
  const defaultCategory = document.getElementById('defaultCategory').value;
  const defaultTags = Array.from(document.getElementById('defaultTags').selectedOptions).map(o => o.value);

  if (!wpUrl || !wpUsername || !wpAppPassword) {
    alert('Please fill all WordPress credentials.');
    return;
  }

  await chrome.storage.sync.set({
    wpUrl: wpUrl.replace(/\/$/, ''),
    wpUsername,
    wpAppPassword,
    postStatus,
    defaultCategory,
    defaultTags
  });

  document.getElementById('status').textContent = '✅ Settings saved!';
  setTimeout(() => document.getElementById('status').textContent = '', 3000);
});
