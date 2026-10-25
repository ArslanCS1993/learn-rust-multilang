let allData = null;
let bgPort = null;

async function loadData() {
  try {
    const res = await fetch(chrome.runtime.getURL('data/characters.json'));
    const json = await res.json();
    allData = json.characters;
    render();
    checkPendingLookup();
  } catch (e) {
    console.error('Failed to load data:', e);
    document.getElementById('singles-grid').innerHTML = '<div style="grid-column:span 2;text-align:center;color:#8b949e;padding:20px;">Failed to load data</div>';
  }
}

// Connect to background for real-time messages
function connectBackground() {
  bgPort = chrome.runtime.connect({ name: 'popup' });
  bgPort.onMessage.addListener((msg) => {
    if (msg.type === 'LOOKUP' && msg.text) {
      document.getElementById('search').value = msg.text;
      render(msg.text);
      // If exact match, show modal
      const match = findExactMatch(msg.text);
      if (match) showModal(match.char, match.info);
    }
  });
  bgPort.onDisconnect.addListener(() => { bgPort = null; });
}

async function checkPendingLookup() {
  try {
    const { pendingLookup } = await chrome.storage.session.get('pendingLookup');
    if (pendingLookup) {
      await chrome.storage.session.remove('pendingLookup');
      document.getElementById('search').value = pendingLookup.text;
      render(pendingLookup.text);
      const match = findExactMatch(pendingLookup.text);
      if (match) showModal(match.char, match.info);
    }
  } catch (e) {
    console.error('Pending lookup error:', e);
  }
}

function findExactMatch(text) {
  if (!allData) return null;
  // Try exact character match first
  if (text.length === 1 && allData[text]) return { char: text, info: allData[text] };
  // Try compound match
  if (allData[text]) return { char: text, info: allData[text] };
  // Try pinyin match
  for (const [char, info] of Object.entries(allData)) {
    if (info.pinyin.toLowerCase() === text.toLowerCase()) {
      return { char, info };
    }
  }
  return null;
}

function render(filter = '') {
  const singlesGrid = document.getElementById('singles-grid');
  const compoundsGrid = document.getElementById('compounds-grid');
  const singlesTitle = document.getElementById('singles-title');
  const compoundsTitle = document.getElementById('compounds-title');
  const stats = document.getElementById('stats');

  if (!allData) return;

  const entries = Object.entries(allData);
  const singles = entries.filter(([k]) => k.length === 1);
  const compounds = entries.filter(([k]) => k.length > 1);

  const f = filter.toLowerCase().trim();
  const filteredSingles = f ? singles.filter(([k, v]) =>
    k.includes(f) || v.pinyin.toLowerCase().includes(f) || v.meaning.toLowerCase().includes(f)
  ) : singles;
  const filteredCompounds = f ? compounds.filter(([k, v]) =>
    k.includes(f) || v.pinyin.toLowerCase().includes(f) || v.meaning.toLowerCase().includes(f)
  ) : compounds;

  stats.textContent = filteredSingles.length + ' chars / ' + filteredCompounds.length + ' compounds';

  singlesTitle.textContent = 'Single Characters (' + filteredSingles.length + ')';
  compoundsTitle.textContent = 'Compound Words (' + filteredCompounds.length + ')';

  singlesGrid.innerHTML = filteredSingles.map(([char, info]) => cardHTML(char, info, false)).join('');
  compoundsGrid.innerHTML = filteredCompounds.map(([word, info]) => cardHTML(word, info, true)).join('');

  document.querySelectorAll('.card').forEach(el => {
    el.addEventListener('click', () => showModal(el.dataset.char, allData[el.dataset.char]));
  });
}

function cardHTML(key, info, isCompound) {
  const safeKey = escapeHtml(key);
  const safePinyin = escapeHtml(info.pinyin);
  const safeMeaning = escapeHtml(info.meaning);
  return '<div class="card' + (isCompound ? ' compound' : '') + '" data-char="' + safeKey + '">' +
    '<div class="char">' + safeKey + '</div>' +
    '<div class="info">' +
      '<div class="pinyin">' + safePinyin + '</div>' +
      '<div class="meaning">' + safeMeaning + '</div>' +
      '<button class="story-btn" onclick="showModalFromCard(this)">Story</button>' +
    '</div>' +
  '</div>';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/\"/g, '"');
}

function showModalFromCard(btn) {
  event.stopPropagation();
  const card = btn.closest('.card');
  const char = card.dataset.char;
  showModal(char, allData[char]);
}

function showModal(char, info) {
  document.getElementById('modal-char').textContent = char;
  document.getElementById('modal-pinyin').textContent = info.pinyin;
  document.getElementById('modal-story').textContent = info.story;
  document.getElementById('modal-components').innerHTML = '<strong>Components:</strong> ' + info.components.join(', ');
  document.getElementById('modal-words').innerHTML = '<strong>Common words:</strong> ' + info.commonWords.join(', ');
  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

document.getElementById('search').addEventListener('input', (e) => render(e.target.value));
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal') closeModal();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// Init
connectBackground();
loadData();