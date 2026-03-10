/**
 * ============================================================================
 * Advanced GitHub Intelligence Search - Application JavaScript (Premium)
 * Developed by JGS Lanka Co.
 * ============================================================================
 *
 * All icons use Remix Icon (ri-*) for premium look.
 *
 * Modules:
 *  1. State Management
 *  2. DOM References
 *  3. Utility Functions (debounce, formatting, toast)
 *  4. Theme Toggle (Dark/Light)
 *  5. GitHub API Integration
 *  6. Search Execution & URL Building
 *  7. Result Rendering (Repos, Users, Issues, Code)
 *  8. Detail Modal & README Preview
 *  9. Pagination & Infinite Scroll
 * 10. Favorites (LocalStorage)
 * 11. Search History (LocalStorage)
 * 12. Auto-Suggestions
 * 13. Export Results as JSON
 * 14. Event Listeners & Initialization
 */

// ============================================================================
// 1. STATE MANAGEMENT
// ============================================================================
const AppState = {
  query: '',
  searchType: 'repositories',
  page: 1,
  perPage: 12,
  totalCount: 0,
  results: [],
  isLoading: false,
  infiniteScroll: false,
  filters: {
    language: '',
    stars: '',
    forks: '',
    sort: '',
    order: 'desc',
    created: ''
  },
  favorites: JSON.parse(localStorage.getItem('ghSearch_favorites') || '[]'),
  history: JSON.parse(localStorage.getItem('ghSearch_history') || '[]'),
  theme: localStorage.getItem('ghSearch_theme') || 'dark',
  githubToken: localStorage.getItem('ghSearch_token') || ''
};

// Map to store favorite-able item data by ID (avoids inline JSON in HTML attributes)
const favDataMap = new Map();

// ============================================================================
// 2. DOM REFERENCES
// ============================================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const DOM = {
  searchInput: $('#search-input'),
  searchBtn: $('#search-btn'),
  clearBtn: $('#clear-btn'),
  suggestionsDropdown: $('#suggestions-dropdown'),
  tabBtns: $$('.tab-btn'),
  filterToggleBtn: $('#filter-toggle-btn'),
  filterSidebar: $('#filter-sidebar'),
  filterSidebarOverlay: $('#filter-sidebar-overlay'),
  filterSidebarToggle: $('#filter-sidebar-toggle'),
  filterStars: $('#filter-stars'),
  filterForks: $('#filter-forks'),
  filterSort: $('#filter-sort'),
  filterOrder: $('#filter-order'),
  filterCreated: $('#filter-created'),
  filterResetBtn: $('#filter-reset-btn'),
  langSearch: $('#lang-search'),
  resultsContainer: $('#results-container'),
  resultsGrid: $('#results-grid'),
  loader: $('#loader'),
  welcomeState: $('#welcome-state'),
  emptyState: $('#empty-state'),
  errorState: $('#error-state'),
  errorMessage: $('#error-message'),
  resultCount: $('#result-count'),
  infiniteToggle: $('#infinite-toggle'),
  exportBtn: $('#export-btn'),
  pagination: $('#pagination'),
  prevBtn: $('#prev-btn'),
  nextBtn: $('#next-btn'),
  pageInfo: $('#page-info'),
  modalOverlay: $('#modal-overlay'),
  modalTitle: $('#modal-title'),
  modalBody: $('#modal-body'),
  modalCloseBtn: $('#modal-close'),
  favSidebar: $('#favorites-sidebar'),
  favToggleBtn: $('#fav-toggle-btn'),
  favList: $('#fav-list'),
  favCount: $('#fav-count'),
  sidebarOverlay: $('#sidebar-overlay'),
  sidebarCloseBtn: $('#sidebar-close'),
  themeToggleBtn: $('#theme-toggle'),
  settingsToggleBtn: $('#settings-toggle-btn'),
  settingsOverlay: $('#settings-overlay'),
  settingsCloseBtn: $('#settings-close'),
  githubTokenInput: $('#github-token'),
  saveSettingsBtn: $('#save-settings-btn'),
  toastContainer: $('#toast-container'),
  footerYear: $('#footer-year')
};

// ============================================================================
// 3. UTILITY FUNCTIONS
// ============================================================================

/** Debounce: delays fn execution until wait ms since last call */
function debounce(fn, wait = 400) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/** Format large numbers: 1200 → 1.2K */
function formatNumber(num) {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

/** Format ISO date to readable string */
function formatDate(isoString) {
  if (!isoString) return 'N/A';
  return new Date(isoString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Relative time (e.g., "3 days ago") */
function timeAgo(isoString) {
  if (!isoString) return '';
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 }
  ];
  for (const i of intervals) {
    const count = Math.floor(seconds / i.seconds);
    if (count >= 1) return `${count} ${i.label}${count > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

/** Get language color for dot display */
function getLanguageColor(lang) {
  const colors = {
    JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
    Java: '#b07219', 'C++': '#f34b7d', C: '#555555', 'C#': '#178600',
    Go: '#00ADD8', Rust: '#dea584', Ruby: '#701516', PHP: '#4F5D95',
    Swift: '#F05138', Kotlin: '#A97BFF', Dart: '#00B4AB', HTML: '#e34c26',
    CSS: '#563d7c', Shell: '#89e051', Vue: '#41b883', R: '#198CE7',
    Scala: '#c22d40', Lua: '#000080', Perl: '#0298c3',
    Haskell: '#5e5086', Elixir: '#6e4a7e', Clojure: '#db5855'
  };
  return colors[lang] || '#8b8b8b';
}

/** Show toast notification with Remix Icon */
function showToast(message, icon = 'ri-check-line') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i class="${icon}"></i> ${message}`;
  DOM.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

/** Escape HTML to prevent XSS */
function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** Simple Markdown → HTML for README preview */
function simpleMarkdown(text) {
  if (!text) return '';
  let html = escapeHTML(text);
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/```[\s\S]*?\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

// ============================================================================
// 4. THEME TOGGLE
// ============================================================================

function applyTheme(theme) {
  AppState.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('ghSearch_theme', theme);
  const icon = DOM.themeToggleBtn.querySelector('i');
  if (icon) icon.className = theme === 'dark' ? 'ri-sun-line' : 'ri-moon-line';
}

function toggleTheme() {
  applyTheme(AppState.theme === 'dark' ? 'light' : 'dark');
}

// ============================================================================
// 5. GITHUB API INTEGRATION
// ============================================================================

const API_BASE = 'https://api.github.com';

/** Generic fetch wrapper with rate-limit and error handling */
async function githubFetch(url) {
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (AppState.githubToken) {
    headers['Authorization'] = `token ${AppState.githubToken}`;
  }

  const response = await fetch(url, { headers });

  const remaining = response.headers.get('X-RateLimit-Remaining');
  if (remaining !== null && parseInt(remaining) === 0) {
    const resetTime = response.headers.get('X-RateLimit-Reset');
    const resetDate = new Date(parseInt(resetTime) * 1000);
    throw new Error(`API rate limit exceeded. Resets at ${resetDate.toLocaleTimeString()}.`);
  }

  if (!response.ok) {
    if (response.status === 403) throw new Error('API rate limit exceeded. Please wait a moment and try again.');
    if (response.status === 422) throw new Error('Invalid search query. Please refine your search terms.');
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/** Fetch README content for a repository */
async function fetchReadme(owner, repo) {
  try {
    const data = await githubFetch(`${API_BASE}/repos/${owner}/${repo}/readme`);
    const decoded = atob(data.content);
    try {
      return new TextDecoder('utf-8').decode(Uint8Array.from(decoded, c => c.charCodeAt(0)));
    } catch { return decoded; }
  } catch { return null; }
}

// ============================================================================
// 6. SEARCH EXECUTION & URL BUILDING
// ============================================================================

/** Build GitHub search API URL with query qualifiers and filters */
function buildSearchURL() {
  const { query, searchType, page, perPage, filters } = AppState;

  // Start with the user's query, or use a broad default if they just want to browse by filters
  let q = query.trim();
  if (!q) {
    if (searchType === 'repositories') {
      q = 'is:public'; // Broad default to match anything public
    } else if (searchType === 'users') {
      q = 'type:user'; // Users API does not support is:public
    } else if (searchType === 'issues') {
      q = 'is:public';
    } else {
      q = 'stars:>0'; // Fallback
    }
  }

  // Language(s)
  if (filters.language) {
    const langs = filters.language.split(',').map(l => l.trim()).filter(Boolean);
    langs.forEach(l => { q += ` language:${l}`; });
  }

  if (searchType === 'repositories') {
    if (filters.stars) q += ` stars:>=${filters.stars}`;
    if (filters.forks) q += ` forks:>=${filters.forks}`;
    if (filters.created) q += ` created:>=${filters.created}`;
    if (filters.visibility) q += ` is:${filters.visibility}`;
    if (filters.license) q += ` license:${filters.license}`;
    if (filters.topics && filters.topics.length > 0) {
      filters.topics.forEach(t => { q += ` topic:${t}`; });
    }
  }

  if (searchType === 'issues') {
    if (filters.visibility) q += ` is:${filters.visibility}`;
  }

  const qEncoded = encodeURIComponent(q.trim());
  let url = `${API_BASE}/search/${searchType}?q=${qEncoded}&page=${page}&per_page=${perPage}`;
  if (filters.sort) url += `&sort=${filters.sort}`;
  if (filters.order) url += `&order=${filters.order}`;
  return url;
}

/** Update Browser URL with current search state */
function updateBrowserURL() {
  const urlParams = new URLSearchParams();

  if (AppState.query) urlParams.set('q', AppState.query);
  urlParams.set('type', AppState.searchType);
  urlParams.set('page', AppState.page);

  if (AppState.filters.language) urlParams.set('lang', AppState.filters.language);
  if (AppState.filters.sort) urlParams.set('sort', AppState.filters.sort);

  const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
  window.history.pushState({ path: newUrl }, '', newUrl);
}

/** Read all filter values from the sidebar UI */
function readFilters() {
  // Languages (checkboxes – multi-select)
  const langChecked = [...$$('#language-group input[type="checkbox"]:checked')].map(el => el.value);
  AppState.filters.language = langChecked.join(',');

  // Project types (checkboxes – joined as topic: qualifiers)
  const topicChecked = [...$$('#project-type-group input[type="checkbox"]:checked')].map(el => el.value);
  AppState.filters.topics = topicChecked;

  // Radios
  const visibilityEl = $('input[name="visibility"]:checked');
  AppState.filters.visibility = visibilityEl ? visibilityEl.value : '';

  const licenseEl = $('input[name="license"]:checked');
  AppState.filters.license = licenseEl ? licenseEl.value : '';

  // Stars – radio OR custom input
  const starsRadio = $('input[name="stars"]:checked');
  const starsCustom = DOM.filterStars ? DOM.filterStars.value : '';
  AppState.filters.stars = starsCustom || (starsRadio ? starsRadio.value : '');

  // Forks – radio OR custom input
  const forksRadio = $('input[name="forks"]:checked');
  const forksCustom = DOM.filterForks ? DOM.filterForks.value : '';
  AppState.filters.forks = forksCustom || (forksRadio ? forksRadio.value : '');

  // Created date – radio OR custom date input
  const createdRadio = $('input[name="created"]:checked');
  const createdCustom = DOM.filterCreated ? DOM.filterCreated.value : '';
  AppState.filters.created = createdCustom || (createdRadio ? createdRadio.value : '');

  // Sort & Order from selects
  AppState.filters.sort = DOM.filterSort ? DOM.filterSort.value : '';
  AppState.filters.order = DOM.filterOrder ? DOM.filterOrder.value : 'desc';

  updateFilterIndicator();
}

/** Execute search query */
async function executeSearch(resetPage = true) {
  readFilters(); // Read filters first to check if any are active

  const query = DOM.searchInput.value.trim();
  const f = AppState.filters;
  const hasFilters = f.language || f.stars || f.forks || f.created ||
    f.visibility || f.license || (f.topics && f.topics.length > 0);

  // Code search completely REQUIRES a text query term by GitHub API rules
  if (AppState.searchType === 'code' && !query) {
    showToast('Code search requires a search term to work.', 'ri-error-warning-line');
    return;
  }

  // Allow search if there is a query OR if any filter is applied
  if (!query && !hasFilters) {
    showToast('Please enter a search term or apply a filter.', 'ri-error-warning-line');
    return;
  }

  AppState.query = query;
  if (resetPage) AppState.page = 1;

  if (query) addToHistory(query);
  hideSuggestions();
  showLoading(true);
  hideAllStates();
  updateBrowserURL();

  if (AppState.searchType === 'code' && !AppState.githubToken) {
    showLoading(false);
    showErrorState('The GitHub Code Search API requires authentication. Please configure a Personal Access Token in Settings (gear icon).');
    return;
  }

  try {
    const url = buildSearchURL();
    const data = await githubFetch(url);

    AppState.totalCount = data.total_count || 0;
    const newResults = data.items || [];

    if (AppState.infiniteScroll && !resetPage) {
      AppState.results = [...AppState.results, ...newResults];
    } else {
      AppState.results = newResults;
    }

    showLoading(false);

    if (AppState.results.length === 0) {
      showEmptyState();
    } else {
      renderResults(AppState.infiniteScroll && !resetPage);
    }

    updateResultCount();
    updatePagination();
    updateTabCounts();
    DOM.welcomeState.classList.add('hidden');

  } catch (err) {
    showLoading(false);
    showErrorState(err.message);
  }
}

// ============================================================================
// 7. RESULT RENDERING
// ============================================================================

function showLoading(show) {
  AppState.isLoading = show;
  DOM.loader.classList.toggle('active', show);
  if (show) {
    DOM.resultsGrid.innerHTML = '';
    DOM.pagination.classList.add('hidden');
  }
}

function hideAllStates() {
  DOM.emptyState.classList.remove('active');
  DOM.errorState.classList.remove('active');
}

function showEmptyState() { DOM.emptyState.classList.add('active'); }

function showErrorState(msg) {
  DOM.errorState.classList.add('active');
  DOM.errorMessage.textContent = msg;
}

function updateResultCount() {
  DOM.resultCount.innerHTML = `Found <strong>${formatNumber(AppState.totalCount)}</strong> results`;
}

/** Render result cards based on current search type */
function renderResults(append = false) {
  if (!append) DOM.resultsGrid.innerHTML = '';
  const startIndex = append ? DOM.resultsGrid.children.length : 0;

  AppState.results.slice(startIndex).forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.style.animationDelay = `${i * 0.05}s`;

    // Store fav data in map for this item
    storeFavData(item);

    switch (AppState.searchType) {
      case 'repositories': card.innerHTML = renderRepoCard(item); break;
      case 'users': card.innerHTML = renderUserCard(item); break;
      case 'issues': card.innerHTML = renderIssueCard(item); break;
      case 'code': card.innerHTML = renderCodeCard(item); break;
    }

    // Click card to open modal
    card.addEventListener('click', (e) => {
      if (e.target.closest('a') || e.target.closest('.card__fav-btn')) return;
      openDetailModal(item);
    });

    // Attach fav button click handler programmatically
    const favBtn = card.querySelector('.card__fav-btn');
    if (favBtn) {
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const favId = parseInt(favBtn.dataset.favId);
        const favData = favDataMap.get(favId);
        if (favData) toggleFavorite(favData);
      });
    }

    DOM.resultsGrid.appendChild(card);
  });
}

/** Store fav-able data for an item in the map */
function storeFavData(item) {
  const type = AppState.searchType;
  if (type === 'repositories') {
    favDataMap.set(item.id, { id: item.id, name: item.full_name, url: item.html_url, avatar: item.owner?.avatar_url, type: 'repo', stars: item.stargazers_count });
  } else if (type === 'users') {
    favDataMap.set(item.id, { id: item.id, name: item.login, url: item.html_url, avatar: item.avatar_url, type: 'user' });
  } else if (type === 'issues') {
    favDataMap.set(item.id, { id: item.id, name: item.title, url: item.html_url, avatar: item.user?.avatar_url, type: 'issue' });
  }
}

/** Repository card with premium Remix Icons */
function renderRepoCard(repo) {
  const isFav = isFavorite(repo.id);
  return `
    <div class="card__header">
      <img class="card__avatar" src="${repo.owner?.avatar_url || ''}" alt="" loading="lazy">
      <div class="card__title-group">
        <div class="card__title" title="${escapeHTML(repo.full_name)}">${escapeHTML(repo.full_name)}</div>
        <div class="card__subtitle"><i class="ri-time-line"></i> Updated ${timeAgo(repo.updated_at)}</div>
      </div>
    </div>
    <div class="card__desc">${escapeHTML(repo.description) || '<span style="color:var(--text-muted)">No description provided</span>'}</div>
    <div class="card__meta">
      ${repo.language ? `<span class="card__meta-item"><span class="dot" style="background:${getLanguageColor(repo.language)}"></span>${escapeHTML(repo.language)}</span>` : ''}
      <span class="card__meta-item"><i class="ri-star-fill" style="color:#f59e0b"></i> ${formatNumber(repo.stargazers_count)}</span>
      <span class="card__meta-item"><i class="ri-git-fork-line"></i> ${formatNumber(repo.forks_count)}</span>
      ${repo.license ? `<span class="card__meta-item"><i class="ri-scales-3-line"></i> ${escapeHTML(repo.license.spdx_id)}</span>` : ''}
    </div>
    <div class="card__footer">
      <a class="card__link" href="${repo.html_url}" target="_blank" rel="noopener" onclick="event.stopPropagation()"><i class="ri-github-fill"></i> View on GitHub <i class="ri-arrow-right-line"></i></a>
      <button class="card__fav-btn ${isFav ? 'is-fav' : ''}" data-fav-id="${repo.id}" title="Save to favorites">
        <i class="${isFav ? 'ri-star-fill' : 'ri-star-line'}"></i>
      </button>
    </div>
  `;
}

/** User card */
function renderUserCard(user) {
  const isFav = isFavorite(user.id);
  return `
    <div class="card__header">
      <img class="card__avatar card__avatar--round" src="${user.avatar_url || ''}" alt="" loading="lazy">
      <div class="card__title-group">
        <div class="card__title">${escapeHTML(user.login)}</div>
        <div class="card__subtitle"><i class="ri-user-3-line"></i> ${escapeHTML(user.type)}</div>
      </div>
    </div>
    <div class="card__desc"><i class="ri-bar-chart-line"></i> Score: ${user.score?.toFixed(1) || 'N/A'}</div>
    <div class="card__footer">
      <a class="card__link" href="${user.html_url}" target="_blank" rel="noopener" onclick="event.stopPropagation()"><i class="ri-user-follow-line"></i> View Profile <i class="ri-arrow-right-line"></i></a>
      <button class="card__fav-btn ${isFav ? 'is-fav' : ''}" data-fav-id="${user.id}" title="Save to favorites">
        <i class="${isFav ? 'ri-star-fill' : 'ri-star-line'}"></i>
      </button>
    </div>
  `;
}

/** Issue card */
function renderIssueCard(issue) {
  const isFav = isFavorite(issue.id);
  const isOpen = issue.state === 'open';
  return `
    <div class="card__header">
      <img class="card__avatar card__avatar--round" src="${issue.user?.avatar_url || ''}" alt="" loading="lazy">
      <div class="card__title-group">
        <div class="card__title" title="${escapeHTML(issue.title)}">${escapeHTML(issue.title)}</div>
        <div class="card__subtitle"><i class="ri-git-repository-line"></i> ${escapeHTML(issue.repository_url?.split('/').slice(-2).join('/') || '')}</div>
      </div>
    </div>
    <div class="card__desc">${escapeHTML(issue.body?.substring(0, 150)) || '<span style="color:var(--text-muted)">No description</span>'}</div>
    <div class="card__meta">
      <span class="card__meta-item" style="color:${isOpen ? 'var(--success)' : 'var(--danger)'}"><i class="${isOpen ? 'ri-checkbox-circle-fill' : 'ri-close-circle-fill'}"></i> ${issue.state}</span>
      <span class="card__meta-item"><i class="ri-chat-3-line"></i> ${issue.comments || 0}</span>
      <span class="card__meta-item"><i class="ri-time-line"></i> ${timeAgo(issue.created_at)}</span>
    </div>
    <div class="card__footer">
      <a class="card__link" href="${issue.html_url}" target="_blank" rel="noopener" onclick="event.stopPropagation()"><i class="ri-bug-line"></i> View Issue <i class="ri-arrow-right-line"></i></a>
      <button class="card__fav-btn ${isFav ? 'is-fav' : ''}" data-fav-id="${issue.id}" title="Save to favorites">
        <i class="${isFav ? 'ri-star-fill' : 'ri-star-line'}"></i>
      </button>
    </div>
  `;
}

/** Code card */
function renderCodeCard(item) {
  return `
    <div class="card__header">
      <img class="card__avatar" src="${item.repository?.owner?.avatar_url || ''}" alt="" loading="lazy">
      <div class="card__title-group">
        <div class="card__title" title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</div>
        <div class="card__subtitle"><i class="ri-git-repository-line"></i> ${escapeHTML(item.repository?.full_name || '')}</div>
      </div>
    </div>
    <div class="card__desc"><i class="ri-folder-line"></i> Path: ${escapeHTML(item.path)}</div>
    <div class="card__footer">
      <a class="card__link" href="${item.html_url}" target="_blank" rel="noopener" onclick="event.stopPropagation()"><i class="ri-code-s-slash-line"></i> View Code <i class="ri-arrow-right-line"></i></a>
    </div>
  `;
}

// ============================================================================
// 8. DETAIL MODAL & README PREVIEW
// ============================================================================

async function openDetailModal(item) {
  DOM.modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';

  switch (AppState.searchType) {
    case 'repositories': await renderRepoModal(item); break;
    case 'users': await renderUserModal(item); break;
    case 'issues': renderIssueModal(item); break;
    case 'code': renderCodeModal(item); break;
  }
}

function closeModal() {
  DOM.modalOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

/** Repository detail modal */
async function renderRepoModal(repo) {
  DOM.modalTitle.innerHTML = `<i class="ri-git-repository-fill"></i> ${escapeHTML(repo.full_name)}`;

  let topicsHTML = '';
  if (repo.topics && repo.topics.length > 0) {
    topicsHTML = `
      <div class="modal__section">
        <h3><i class="ri-hashtag"></i> Topics</h3>
        <div class="modal__topics">
          ${repo.topics.map(t => `<span class="topic-tag">${escapeHTML(t)}</span>`).join('')}
        </div>
      </div>
    `;
  }

  DOM.modalBody.innerHTML = `
    <div class="modal__meta-grid">
      <div class="modal__meta-card"><div class="value"><i class="ri-star-fill" style="color:#f59e0b"></i> ${formatNumber(repo.stargazers_count)}</div><div class="label">Stars</div></div>
      <div class="modal__meta-card"><div class="value"><i class="ri-git-fork-line" style="color:#6366f1"></i> ${formatNumber(repo.forks_count)}</div><div class="label">Forks</div></div>
      <div class="modal__meta-card"><div class="value"><i class="ri-eye-line" style="color:#06b6d4"></i> ${formatNumber(repo.watchers_count)}</div><div class="label">Watchers</div></div>
      <div class="modal__meta-card"><div class="value"><i class="ri-bug-line" style="color:#ef4444"></i> ${formatNumber(repo.open_issues_count)}</div><div class="label">Issues</div></div>
      <div class="modal__meta-card"><div class="value"><i class="ri-hard-drive-2-line" style="color:#8b5cf6"></i> ${repo.size ? formatNumber(repo.size) + ' KB' : 'N/A'}</div><div class="label">Size</div></div>
      <div class="modal__meta-card"><div class="value"><i class="ri-code-s-slash-line" style="color:#10b981"></i> ${escapeHTML(repo.language || 'N/A')}</div><div class="label">Language</div></div>
    </div>

    <div class="modal__section">
      <h3><i class="ri-file-text-line"></i> Description</h3>
      <p style="font-size:0.9rem;color:var(--text-secondary);line-height:1.7">${escapeHTML(repo.description) || 'No description available.'}</p>
    </div>

    <div class="modal__section">
      <h3><i class="ri-information-line"></i> Details</h3>
      <div style="font-size:0.85rem;color:var(--text-secondary);display:grid;gap:8px">
        <div><i class="ri-calendar-line" style="color:var(--accent-light);margin-right:6px"></i> Created: ${formatDate(repo.created_at)}</div>
        <div><i class="ri-refresh-line" style="color:var(--accent-light);margin-right:6px"></i> Updated: ${formatDate(repo.updated_at)}</div>
        ${repo.license ? `<div><i class="ri-scales-3-line" style="color:var(--accent-light);margin-right:6px"></i> License: ${escapeHTML(repo.license.name)}</div>` : ''}
        <div><i class="ri-git-branch-line" style="color:var(--accent-light);margin-right:6px"></i> Branch: ${escapeHTML(repo.default_branch || 'main')}</div>
      </div>
    </div>

    ${topicsHTML}

    <div class="modal__section" id="readme-section">
      <h3><i class="ri-book-open-line"></i> README</h3>
      <div class="readme-content" id="readme-content">
        <div class="loader active" style="padding:20px"><div class="spinner"></div><div class="loader__text"><i class="ri-loader-4-line"></i> Loading README...</div></div>
      </div>
    </div>

    <div class="modal__actions">
      <a class="modal__action-btn modal__action-btn--primary" href="${repo.html_url}" target="_blank" rel="noopener"><i class="ri-external-link-line"></i> <span>Open on GitHub</span></a>
      <button class="modal__action-btn modal__action-btn--secondary" id="modal-fav-btn" data-fav-id="${repo.id}"><i class="ri-star-line"></i> <span>Save to Favorites</span></button>
    </div>
  `;

  // Store fav data & attach modal fav button handler
  favDataMap.set(repo.id, { id: repo.id, name: repo.full_name, url: repo.html_url, avatar: repo.owner?.avatar_url, type: 'repo', stars: repo.stargazers_count });
  setTimeout(() => {
    const modalFavBtn = document.getElementById('modal-fav-btn');
    if (modalFavBtn) {
      modalFavBtn.addEventListener('click', () => {
        const favData = favDataMap.get(repo.id);
        if (favData) toggleFavorite(favData);
        closeModal();
      });
    }
  }, 0);

  // Fetch README
  const [owner, repoName] = repo.full_name.split('/');
  const readmeText = await fetchReadme(owner, repoName);
  const readmeEl = document.getElementById('readme-content');
  if (readmeText) {
    readmeEl.innerHTML = simpleMarkdown(readmeText);
    // -- අලුත් කොටස මෙතැන් සිට: Prism.js Highlighting --
    if (window.Prism) {
      const codeBlocks = readmeEl.querySelectorAll('pre code');
      codeBlocks.forEach((block) => {
        // markdown parser එකෙන් සමහරවිට language class එකක් නොඑන්න පුළුවන්, 
        // ඒ නිසා default විදියට 'language-javascript' හෝ වෙනත් එකක් දෙන්න පුළුවන්
        if (!block.className) {
          block.className = 'language-javascript';
        }
        Prism.highlightElement(block);
      });
    }
  } else {
    readmeEl.innerHTML = '<p style="color:var(--text-muted)"><i class="ri-file-unknow-line"></i> No README found.</p>';
  }
}

/** User detail modal */
async function renderUserModal(user) {
  DOM.modalTitle.innerHTML = `<i class="ri-user-3-fill"></i> ${escapeHTML(user.login)}`;

  let userData = user;
  try { userData = await githubFetch(`${API_BASE}/users/${user.login}`); } catch { }

  DOM.modalBody.innerHTML = `
    <div style="display:flex;align-items:center;gap:20px;margin-bottom:24px">
      <img src="${userData.avatar_url}" alt="" style="width:80px;height:80px;border-radius:50%;border:3px solid var(--border-color)">
      <div>
        <div style="font-size:1.2rem;font-weight:700">${escapeHTML(userData.name || userData.login)}</div>
        <div style="font-size:0.85rem;color:var(--text-muted)">@${escapeHTML(userData.login)}</div>
        ${userData.bio ? `<div style="font-size:0.88rem;color:var(--text-secondary);margin-top:6px">${escapeHTML(userData.bio)}</div>` : ''}
      </div>
    </div>

    <div class="modal__meta-grid">
      <div class="modal__meta-card"><div class="value"><i class="ri-git-repository-line" style="color:#6366f1"></i> ${formatNumber(userData.public_repos || 0)}</div><div class="label">Repos</div></div>
      <div class="modal__meta-card"><div class="value"><i class="ri-user-follow-line" style="color:#10b981"></i> ${formatNumber(userData.followers || 0)}</div><div class="label">Followers</div></div>
      <div class="modal__meta-card"><div class="value"><i class="ri-user-shared-line" style="color:#06b6d4"></i> ${formatNumber(userData.following || 0)}</div><div class="label">Following</div></div>
      <div class="modal__meta-card"><div class="value"><i class="ri-code-box-line" style="color:#f59e0b"></i> ${formatNumber(userData.public_gists || 0)}</div><div class="label">Gists</div></div>
    </div>

    <div class="modal__section">
      <h3><i class="ri-information-line"></i> Details</h3>
      <div style="font-size:0.85rem;color:var(--text-secondary);display:grid;gap:8px">
        ${userData.company ? `<div><i class="ri-building-line" style="color:var(--accent-light);margin-right:6px"></i> ${escapeHTML(userData.company)}</div>` : ''}
        ${userData.location ? `<div><i class="ri-map-pin-line" style="color:var(--accent-light);margin-right:6px"></i> ${escapeHTML(userData.location)}</div>` : ''}
        ${userData.blog ? `<div><i class="ri-link" style="color:var(--accent-light);margin-right:6px"></i> <a href="${userData.blog.startsWith('http') ? userData.blog : 'https://' + userData.blog}" target="_blank" rel="noopener">${escapeHTML(userData.blog)}</a></div>` : ''}
        ${userData.twitter_username ? `<div><i class="ri-twitter-x-line" style="color:var(--accent-light);margin-right:6px"></i> @${escapeHTML(userData.twitter_username)}</div>` : ''}
        <div><i class="ri-calendar-line" style="color:var(--accent-light);margin-right:6px"></i> Joined: ${formatDate(userData.created_at)}</div>
      </div>
    </div>

    <div class="modal__actions">
      <a class="modal__action-btn modal__action-btn--primary" href="${userData.html_url}" target="_blank" rel="noopener"><i class="ri-external-link-line"></i> <span>View Profile</span></a>
    </div>
  `;
}

/** Issue detail modal */
function renderIssueModal(issue) {
  const isOpen = issue.state === 'open';
  DOM.modalTitle.innerHTML = `<i class="${isOpen ? 'ri-checkbox-circle-fill' : 'ri-close-circle-fill'}" style="color:${isOpen ? 'var(--success)' : 'var(--danger)'}"></i> ${escapeHTML(issue.title)}`;

  const labelsHTML = issue.labels?.length
    ? issue.labels.map(l => `<span class="topic-tag" style="background:${l.color ? '#' + l.color + '18' : ''};color:${l.color ? '#' + l.color : 'var(--accent-light)'};border-color:${l.color ? '#' + l.color + '33' : ''}">${escapeHTML(l.name)}</span>`).join('')
    : '<span style="color:var(--text-muted)">None</span>';

  DOM.modalBody.innerHTML = `
    <div class="modal__meta-grid">
      <div class="modal__meta-card"><div class="value" style="text-transform:capitalize"><i class="${isOpen ? 'ri-checkbox-circle-line' : 'ri-close-circle-line'}" style="color:${isOpen ? 'var(--success)' : 'var(--danger)'}"></i> ${issue.state}</div><div class="label">State</div></div>
      <div class="modal__meta-card"><div class="value"><i class="ri-chat-3-line" style="color:#6366f1"></i> ${issue.comments}</div><div class="label">Comments</div></div>
      <div class="modal__meta-card"><div class="value"><i class="ri-calendar-line" style="color:#06b6d4"></i> ${formatDate(issue.created_at)}</div><div class="label">Created</div></div>
    </div>

    <div class="modal__section">
      <h3><i class="ri-price-tag-3-line"></i> Labels</h3>
      <div class="modal__topics">${labelsHTML}</div>
    </div>

    <div class="modal__section">
      <h3><i class="ri-article-line"></i> Body</h3>
      <div class="readme-content">${issue.body ? simpleMarkdown(issue.body) : '<p style="color:var(--text-muted)">No body content.</p>'}</div>
    </div>

    <div class="modal__section">
      <h3><i class="ri-user-3-line"></i> Author</h3>
      <div style="display:flex;align-items:center;gap:10px">
        <img src="${issue.user?.avatar_url || ''}" style="width:32px;height:32px;border-radius:50%;border:2px solid var(--border-color)">
        <a href="${issue.user?.html_url || '#'}" target="_blank" rel="noopener">${escapeHTML(issue.user?.login || '')}</a>
      </div>
    </div>

    <div class="modal__actions">
      <a class="modal__action-btn modal__action-btn--primary" href="${issue.html_url}" target="_blank" rel="noopener"><i class="ri-external-link-line"></i> <span>View Issue</span></a>
    </div>
  `;
}

/** Code detail modal */
function renderCodeModal(item) {
  DOM.modalTitle.innerHTML = `<i class="ri-file-code-line"></i> ${escapeHTML(item.name)}`;
  DOM.modalBody.innerHTML = `
    <div class="modal__section">
      <h3><i class="ri-information-line"></i> File Info</h3>
      <div style="font-size:0.85rem;color:var(--text-secondary);display:grid;gap:8px">
        <div><i class="ri-folder-line" style="color:var(--accent-light);margin-right:6px"></i> Path: ${escapeHTML(item.path)}</div>
        <div><i class="ri-git-repository-line" style="color:var(--accent-light);margin-right:6px"></i> Repository: <a href="${item.repository?.html_url || '#'}" target="_blank" rel="noopener">${escapeHTML(item.repository?.full_name || '')}</a></div>
        <div><i class="ri-git-commit-line" style="color:var(--accent-light);margin-right:6px"></i> SHA: ${escapeHTML(item.sha?.substring(0, 7) || '')}</div>
      </div>
    </div>

    ${item.text_matches?.length ? `
      <div class="modal__section">
        <h3><i class="ri-search-eye-line"></i> Matching Fragments</h3>
        ${item.text_matches.map(m => `<pre style="margin:6px 0"><code>${escapeHTML(m.fragment)}</code></pre>`).join('')}
      </div>
    ` : ''}

    <div class="modal__actions">
      <a class="modal__action-btn modal__action-btn--primary" href="${item.html_url}" target="_blank" rel="noopener"><i class="ri-external-link-line"></i> <span>View File</span></a>
    </div>
  `;
}

// ============================================================================
// 9. PAGINATION & INFINITE SCROLL
// ============================================================================

function updatePagination() {
  const totalPages = Math.ceil(AppState.totalCount / AppState.perPage);
  const maxPage = Math.min(totalPages, Math.ceil(1000 / AppState.perPage));

  if (AppState.infiniteScroll || AppState.results.length === 0) {
    DOM.pagination.classList.add('hidden');
    return;
  }

  DOM.pagination.classList.remove('hidden');
  DOM.prevBtn.disabled = AppState.page <= 1;
  DOM.nextBtn.disabled = AppState.page >= maxPage;
  DOM.pageInfo.textContent = `Page ${AppState.page} of ${maxPage}`;
}

function goNextPage() {
  AppState.page++;
  executeSearch(false);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goPrevPage() {
  if (AppState.page > 1) {
    AppState.page--;
    executeSearch(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function handleInfiniteScroll() {
  if (!AppState.infiniteScroll || AppState.isLoading) return;
  const scrollY = window.scrollY + window.innerHeight;
  const docHeight = document.documentElement.scrollHeight;
  if (scrollY >= docHeight - 300) {
    const totalPages = Math.ceil(Math.min(AppState.totalCount, 1000) / AppState.perPage);
    if (AppState.page < totalPages) {
      AppState.page++;
      executeSearch(false);
    }
  }
}

function toggleInfiniteScroll() {
  AppState.infiniteScroll = !AppState.infiniteScroll;
  DOM.infiniteToggle.classList.toggle('active', AppState.infiniteScroll);
  updatePagination();
  showToast(AppState.infiniteScroll ? 'Infinite scroll enabled' : 'Infinite scroll disabled', 'ri-infinity-line');
}

// ============================================================================

/** Show/hide active filter indicator on the filter toggle button */
function updateFilterIndicator() {
  const f = AppState.filters;
  const hasFilters = f.language || f.stars || f.forks || f.created ||
    f.visibility || f.license || (f.topics && f.topics.length > 0) || f.sort;
  DOM.filterToggleBtn.classList.toggle('has-filters', !!hasFilters);
}

// 10. FAVORITES (LocalStorage)
// ============================================================================

function isFavorite(id) {
  return AppState.favorites.some(f => f.id === id);
}

function toggleFavorite(item) {
  if (!item || !item.id) return;
  const index = AppState.favorites.findIndex(f => f.id === item.id);

  if (index >= 0) {
    AppState.favorites.splice(index, 1);
    showToast('Removed from favorites', 'ri-heart-3-line');
  } else {
    AppState.favorites.push(item);
    showToast('Added to favorites!', 'ri-star-fill');
  }

  saveFavorites();
  renderFavorites();
  updateFavCount();
  if (AppState.results.length > 0) renderResults();
}

function saveFavorites() {
  localStorage.setItem('ghSearch_favorites', JSON.stringify(AppState.favorites));
}

function updateFavCount() {
  DOM.favCount.textContent = AppState.favorites.length;
  DOM.favCount.style.display = AppState.favorites.length > 0 ? 'grid' : 'none';
}

function renderFavorites() {
  if (AppState.favorites.length === 0) {
    DOM.favList.innerHTML = `
      <div class="sidebar__empty">
        <div class="sidebar__empty-icon"><i class="ri-star-line"></i></div>
        <p>No favorites yet</p>
        <p style="font-size:0.8rem;margin-top:4px;color:var(--text-muted)">Click the star on any result to save it here.</p>
      </div>
    `;
    return;
  }

  DOM.favList.innerHTML = AppState.favorites.map(fav => `
    <div class="fav-item" data-fav-url="${escapeHTML(fav.url)}">
      <img class="fav-item__avatar" src="${fav.avatar || ''}" alt="" loading="lazy">
      <div class="fav-item__info">
        <div class="fav-item__name">${escapeHTML(fav.name)}</div>
        <div class="fav-item__meta"><i class="ri-price-tag-3-line"></i> ${fav.type}${fav.stars ? ' · <i class="ri-star-fill" style="color:#f59e0b"></i> ' + formatNumber(fav.stars) : ''}</div>
      </div>
      <button class="fav-item__remove" data-remove-id="${fav.id}" title="Remove"><i class="ri-close-line"></i></button>
    </div>
  `).join('');

  // Attach event listeners for sidebar items
  DOM.favList.querySelectorAll('.fav-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.fav-item__remove')) return;
      window.open(el.dataset.favUrl, '_blank');
    });
  });

  DOM.favList.querySelectorAll('.fav-item__remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const removeId = parseInt(btn.dataset.removeId);
      const fav = AppState.favorites.find(f => f.id === removeId);
      if (fav) toggleFavorite(fav);
    });
  });
}

function toggleFavoritesSidebar() {
  DOM.favSidebar.classList.toggle('open');
  DOM.sidebarOverlay.classList.toggle('open');
}

function closeFavoritesSidebar() {
  DOM.favSidebar.classList.remove('open');
  DOM.sidebarOverlay.classList.remove('open');
}

// ============================================================================
// 11. SEARCH HISTORY (LocalStorage)
// ============================================================================

function addToHistory(query) {
  AppState.history = AppState.history.filter(h => h !== query);
  AppState.history.unshift(query);
  AppState.history = AppState.history.slice(0, 20);
  localStorage.setItem('ghSearch_history', JSON.stringify(AppState.history));
}

function clearHistory() {
  AppState.history = [];
  localStorage.setItem('ghSearch_history', JSON.stringify([]));
  hideSuggestions();
  showToast('Search history cleared', 'ri-delete-bin-line');
}

// ============================================================================
// 12. AUTO-SUGGESTIONS
// ============================================================================

async function showSuggestions(query) {
  if (!query.trim()) {
    if (AppState.history.length > 0) renderHistorySuggestions();
    else hideSuggestions();
    return;
  }

  const matchingHistory = AppState.history.filter(h =>
    h.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 5);

  let html = '';

  if (matchingHistory.length > 0) {
    html += `<div class="suggestions-header"><span><i class="ri-history-line"></i> Recent Searches</span><button onclick="clearHistory()"><i class="ri-delete-bin-7-line"></i> Clear</button></div>`;
    html += matchingHistory.map(h => `
      <div class="suggestion-item" onclick="DOM.searchInput.value='${escapeHTML(h)}'; executeSearch();">
        <span class="suggestion-item__icon"><i class="ri-history-line"></i></span>
        <span class="suggestion-item__text">${escapeHTML(h)}</span>
      </div>
    `).join('');
  }

  try {
    const data = await githubFetch(`${API_BASE}/search/repositories?q=${encodeURIComponent(query)}&per_page=5`);
    if (data.items && data.items.length > 0) {
      html += `<div class="suggestions-header"><span><i class="ri-lightbulb-line"></i> Suggestions</span></div>`;
      html += data.items.map(repo => `
        <div class="suggestion-item" onclick="DOM.searchInput.value='${escapeHTML(repo.full_name)}'; executeSearch();">
          <span class="suggestion-item__icon"><i class="ri-git-repository-line"></i></span>
          <span class="suggestion-item__text">${escapeHTML(repo.full_name)}</span>
        </div>
      `).join('');
    }
  } catch { }

  if (html) {
    DOM.suggestionsDropdown.innerHTML = html;
    DOM.suggestionsDropdown.classList.add('active');
  } else {
    hideSuggestions();
  }
}

function renderHistorySuggestions() {
  if (AppState.history.length === 0) { hideSuggestions(); return; }
  let html = `<div class="suggestions-header"><span><i class="ri-history-line"></i> Recent Searches</span><button onclick="clearHistory()"><i class="ri-delete-bin-7-line"></i> Clear</button></div>`;
  html += AppState.history.slice(0, 10).map(h => `
    <div class="suggestion-item" onclick="DOM.searchInput.value='${escapeHTML(h)}'; executeSearch();">
      <span class="suggestion-item__icon"><i class="ri-history-line"></i></span>
      <span class="suggestion-item__text">${escapeHTML(h)}</span>
    </div>
  `).join('');
  DOM.suggestionsDropdown.innerHTML = html;
  DOM.suggestionsDropdown.classList.add('active');
}

function hideSuggestions() {
  DOM.suggestionsDropdown.classList.remove('active');
}

const debouncedSuggestions = debounce((query) => showSuggestions(query), 400);

// ============================================================================
// 13. EXPORT RESULTS AS JSON
// ============================================================================

function exportResults() {
  if (AppState.results.length === 0) {
    showToast('No results to export.', 'ri-error-warning-line');
    return;
  }
  const data = {
    query: AppState.query,
    searchType: AppState.searchType,
    totalCount: AppState.totalCount,
    exportedAt: new Date().toISOString(),
    results: AppState.results
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `github-search-${AppState.searchType}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Results exported as JSON!', 'ri-download-2-line');
}

// ============================================================================
// 14. TAB COUNTS
// ============================================================================

function updateTabCounts() {
  DOM.tabBtns.forEach(btn => {
    if (btn.dataset.type === AppState.searchType) {
      const countEl = btn.querySelector('.tab-btn__count');
      if (countEl) countEl.textContent = formatNumber(AppState.totalCount);
    }
  });
}

// ============================================================================
// 15. EVENT LISTENERS & INITIALIZATION
// ============================================================================

function init() {
  applyTheme(AppState.theme);
  updateFavCount();
  renderFavorites();
  DOM.footerYear.textContent = new Date().getFullYear();

  // Search
  DOM.searchBtn.addEventListener('click', () => executeSearch());
  DOM.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); executeSearch(); }
  });

  // Clear
  DOM.clearBtn.addEventListener('click', () => {
    DOM.searchInput.value = '';
    DOM.clearBtn.classList.remove('visible');
    hideSuggestions();
    DOM.searchInput.focus();
  });

  // Input events
  DOM.searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    DOM.clearBtn.classList.toggle('visible', val.length > 0);
    debouncedSuggestions(val);
  });

  DOM.searchInput.addEventListener('focus', () => {
    if (!DOM.searchInput.value) renderHistorySuggestions();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-bar__input-wrap')) hideSuggestions();
  });

  // Tabs
  DOM.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.searchType = btn.dataset.type;

      readFilters();
      const hasFilters = AppState.filters.language || AppState.filters.stars || AppState.filters.forks ||
        AppState.filters.created || AppState.filters.visibility || AppState.filters.license ||
        (AppState.filters.topics && AppState.filters.topics.length > 0);

      if (AppState.query || hasFilters) executeSearch();
    });
  });

  // Filter Sidebar – Mobile toggle (header button)
  DOM.filterToggleBtn.addEventListener('click', () => {
    const isOpen = DOM.filterSidebar.classList.contains('mobile-open');
    if (window.innerWidth <= 900) {
      // Mobile: slide in/out
      DOM.filterSidebar.classList.toggle('mobile-open', !isOpen);
      DOM.filterSidebarOverlay.classList.toggle('open', !isOpen);
    } else {
      // Desktop: collapse/expand
      DOM.filterSidebar.classList.toggle('collapsed');
      const icon = DOM.filterSidebarToggle.querySelector('i');
      // icon rotation handled in CSS
    }
  });

  // Filter Sidebar – Desktop collapse toggle button
  DOM.filterSidebarToggle.addEventListener('click', () => {
    DOM.filterSidebar.classList.toggle('collapsed');
  });

  // Filter Sidebar – Close on overlay click (mobile)
  DOM.filterSidebarOverlay.addEventListener('click', () => {
    DOM.filterSidebar.classList.remove('mobile-open');
    DOM.filterSidebarOverlay.classList.remove('open');
  });

  // Filter Sidebar – Accordion toggle
  $$('.filter-accordion-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.closest('.filter-group-accordion');
      const isOpen = group.classList.contains('open');
      // Close all others first for single-open behavior
      $$('.filter-group-accordion.open').forEach(g => g.classList.remove('open'));
      if (!isOpen) group.classList.add('open');
    });
  });

  // Language search filter
  if (DOM.langSearch) {
    DOM.langSearch.addEventListener('input', () => {
      const q = DOM.langSearch.value.toLowerCase();
      $$('#language-group .filter-check').forEach(el => {
        const label = el.textContent.toLowerCase();
        el.style.display = label.includes(q) ? '' : 'none';
      });
    });
  }

  // Reset All Filters
  DOM.filterResetBtn.addEventListener('click', () => {
    $$('.filter-group-accordion input[type="checkbox"]').forEach(el => el.checked = false);
    $$('.filter-group-accordion input[type="radio"]').forEach(el => el.checked = false);
    if (DOM.filterStars) DOM.filterStars.value = '';
    if (DOM.filterForks) DOM.filterForks.value = '';
    if (DOM.filterCreated) DOM.filterCreated.value = '';
    if (DOM.filterSort) DOM.filterSort.value = '';
    if (DOM.filterOrder) DOM.filterOrder.value = 'desc';
    if (DOM.langSearch) DOM.langSearch.value = '';
    $$('#language-group .filter-check').forEach(el => el.style.display = '');
    AppState.filters = { language: '', stars: '', forks: '', sort: '', order: 'desc', created: '', visibility: '', license: '', topics: [] };
    updateFilterIndicator();
    showToast('Filters reset', 'ri-refresh-line');
    if (AppState.query) executeSearch();
  });

  // Open Sort accordion by default on desktop
  if (window.innerWidth > 900) {
    const firstAccordion = $('.filter-group-accordion');
    if (firstAccordion) firstAccordion.classList.add('open');
  }

  // --- Live Search on Filter Change ---
  const triggerLiveSearch = debounce(() => {
    executeSearch();
  }, 400);

  // Checkboxes & Radios (instant trigger)
  $$('.filter-group-accordion input[type="checkbox"], .filter-group-accordion input[type="radio"]').forEach(el => {
    el.addEventListener('change', () => {
      executeSearch();
    });
  });

  // Select dropdowns
  $$('.filter-group-accordion select').forEach(el => {
    el.addEventListener('change', () => {
      executeSearch();
    });
  });

  // Number & Date inputs (debounced so typing doesn't spam)
  $$('.filter-group-accordion input[type="number"], .filter-group-accordion input[type="date"]').forEach(el => {
    el.addEventListener('input', triggerLiveSearch);
  });

  // Pagination
  DOM.prevBtn.addEventListener('click', goPrevPage);
  DOM.nextBtn.addEventListener('click', goNextPage);

  // Infinite Scroll
  DOM.infiniteToggle.addEventListener('click', toggleInfiniteScroll);
  window.addEventListener('scroll', debounce(handleInfiniteScroll, 150));

  // Export
  DOM.exportBtn.addEventListener('click', exportResults);

  // Theme
  DOM.themeToggleBtn.addEventListener('click', toggleTheme);

  // Settings modal
  DOM.settingsToggleBtn.addEventListener('click', () => {
    DOM.githubTokenInput.value = AppState.githubToken;
    DOM.settingsOverlay.style.display = 'flex';
  });

  DOM.settingsCloseBtn.addEventListener('click', () => {
    DOM.settingsOverlay.style.display = '';
  });

  DOM.saveSettingsBtn.addEventListener('click', () => {
    const token = DOM.githubTokenInput.value.trim();
    AppState.githubToken = token;
    localStorage.setItem('ghSearch_token', token);
    DOM.settingsOverlay.classList.remove('active');
    showToast('Settings saved successfully!');
    if (AppState.query) {
      executeSearch();
    }
  });

  // Modal
  DOM.modalCloseBtn.addEventListener('click', closeModal);
  DOM.modalOverlay.addEventListener('click', (e) => {
    if (e.target === DOM.modalOverlay) closeModal();
  });

  // Favorites sidebar
  DOM.favToggleBtn.addEventListener('click', toggleFavoritesSidebar);
  DOM.sidebarCloseBtn.addEventListener('click', closeFavoritesSidebar);
  DOM.sidebarOverlay.addEventListener('click', closeFavoritesSidebar);

  // ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); closeFavoritesSidebar(); }
  });

  // Welcome tags
  document.querySelectorAll('.welcome-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      DOM.searchInput.value = tag.dataset.query || tag.textContent.trim();
      DOM.clearBtn.classList.add('visible');
      executeSearch();
    });
  });
  // -- අලුත් කොටස මෙතැන් සිට: Load state from URL --
  const urlParams = new URLSearchParams(window.location.search);
  const q = urlParams.get('q');

  if (q) {
    DOM.searchInput.value = q;

    // Set search type if it exists in URL
    const type = urlParams.get('type');
    if (type && ['repositories', 'users', 'issues', 'code'].includes(type)) {
      AppState.searchType = type;
      DOM.tabBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.type === type);
      });
    }

    // Set page
    const page = urlParams.get('page');
    if (page) AppState.page = parseInt(page);

    // Set filters
    const lang = urlParams.get('lang');
    if (lang) DOM.filterLanguage.value = lang;

    const sort = urlParams.get('sort');
    if (sort) DOM.filterSort.value = sort;

    // Automatically trigger the search
    executeSearch(false); // false because we might be on a different page via URL
    DOM.clearBtn.classList.add('visible');
  }
}

document.addEventListener('DOMContentLoaded', init);
