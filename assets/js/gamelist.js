/**
 * Game List Page - Search, Filter, and Sort functionality
 */

(function() {
  'use strict';

  // State
  let allGames = [];
  let filteredGames = [];
  let allTags = new Map(); // tag -> count
  let tagFilters = new Map(); // tag -> 'include' | 'exclude' | null

  // Predetermined tag order
  const tagOrder = [
    'Very popular',
    'Popular',
    'Not popular',
    'Singleplayer',
    'Online multiplayer',
    'Local 2 players co-op',
    'Local 2 players vs',
    'Local 4 players co-op',
    'Local 4 players vs',
    'Fighting',
    'Console',
    'K3',
    'K12',
    'K16'
  ];

  // DOM Elements
  const gameListEl = document.getElementById('game-list');
  const searchInput = document.getElementById('game-search');
  const searchBtn = document.getElementById('search-btn');
  const sortSelect = document.getElementById('sort-select');
  const resultsCountEl = document.getElementById('results-count');
  const tagFiltersEl = document.getElementById('tag-filters');
  const filterSidebar = document.getElementById('filter-sidebar');
  const filterToggleBtn = document.getElementById('filter-toggle-btn');
  const filterCloseBtn = document.getElementById('filter-close-btn');
  const filterOverlay = document.getElementById('filter-overlay');

  // Initialize
  async function init() {
    if (!gameListEl) return; // Not on game list page

    await loadGames();
    extractTags();
    renderTagFilters();
    applyFiltersAndSort();
    bindEvents();
  }

  // Load games from JSON
  async function loadGames() {
    try {
      const response = await fetch('../assets/list/games.json');
      if (!response.ok) throw new Error('Failed to load games');
      allGames = await response.json();
    } catch (error) {
      console.error('Error loading games:', error);
      gameListEl.innerHTML = '<p style="color: #fff; padding: 20px;">Error loading games. Please try again later.</p>';
    }
  }

  // Extract all unique tags and count occurrences
  function extractTags() {
    allTags.clear();

    allGames.forEach(game => {
      if (game.tags) {
        const tags = game.tags.split(',').map(t => t.trim());
        tags.forEach(tag => {
          if (tag) {
            allTags.set(tag, (allTags.get(tag) || 0) + 1);
          }
        });
      }
    });

    // Sort tags using predetermined order, then other tags
    allTags = new Map([...allTags.entries()].sort((a, b) => {
      const aIndex = tagOrder.indexOf(a[0]);
      const bIndex = tagOrder.indexOf(b[0]);

      // If both are in the predetermined order, sort by order
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      // Predetermined tags come first
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      // Other tags sorted alphabetically
      return a[0].localeCompare(b[0]);
    }));
  }

  // Render tag filter checkboxes
  function renderTagFilters() {
    tagFiltersEl.innerHTML = '';

    allTags.forEach((count, tag) => {
      const filterState = tagFilters.get(tag) || null;

      const itemEl = document.createElement('div');
      itemEl.className = 'tag-filter-item';
      itemEl.dataset.tag = tag;

      const checkboxEl = document.createElement('div');
      checkboxEl.className = 'tag-checkbox';
      if (filterState === 'include') checkboxEl.classList.add('checked');
      if (filterState === 'exclude') checkboxEl.classList.add('excluded');

      const nameEl = document.createElement('span');
      nameEl.className = 'tag-name';
      nameEl.textContent = tag;

      const excludeBtn = document.createElement('button');
      excludeBtn.className = 'tag-exclude-btn';
      excludeBtn.title = 'Exclude results with this tag';
      excludeBtn.innerHTML = '−';

      itemEl.appendChild(checkboxEl);
      itemEl.appendChild(nameEl);
      itemEl.appendChild(excludeBtn);
      tagFiltersEl.appendChild(itemEl);
    });
  }

  // Apply filters and sort, then render
  function applyFiltersAndSort() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const sortValue = sortSelect.value;

    // Filter games
    filteredGames = allGames.filter(game => {
      // Search filter
      if (searchTerm) {
        const nameMatch = game.name.toLowerCase().includes(searchTerm);
        const tagMatch = game.tags && game.tags.toLowerCase().includes(searchTerm);
        if (!nameMatch && !tagMatch) return false;
      }

      // Tag filters
      const gameTags = game.tags ? game.tags.split(',').map(t => t.trim().toLowerCase()) : [];

      // Check include filters (must have ALL selected tags)
      const includeTags = [...tagFilters.entries()]
        .filter(([, state]) => state === 'include')
        .map(([tag]) => tag.toLowerCase());

      if (includeTags.length > 0) {
        const hasAllIncludeTags = includeTags.every(tag => gameTags.includes(tag));
        if (!hasAllIncludeTags) return false;
      }

      // Check exclude filters (must not have any)
      const excludeTags = [...tagFilters.entries()]
        .filter(([, state]) => state === 'exclude')
        .map(([tag]) => tag.toLowerCase());

      if (excludeTags.length > 0) {
        const hasExcludeTag = excludeTags.some(tag => gameTags.includes(tag));
        if (hasExcludeTag) return false;
      }

      return true;
    });

    // Sort games
    switch (sortValue) {
      case 'name-asc':
        filteredGames.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        filteredGames.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'date-new':
        filteredGames.sort((a, b) => new Date(b.Date) - new Date(a.Date));
        break;
      case 'date-old':
        filteredGames.sort((a, b) => new Date(a.Date) - new Date(b.Date));
        break;
      case 'installed': // sort by installed status first, then by popularity
        filteredGames.sort((a, b) => {
          // Get install status from the 'installed' property
          const aIsInstalled = a.installed;
          const bIsInstalled = b.installed;

          // Sort installed games first
          if (aIsInstalled !== bIsInstalled) {
            return bIsInstalled - aIsInstalled; // true (1) comes before false (0)
          }

          // Within same install status, sort by popularity
          const aPopularity = getPopularity(a.tags);
          const bPopularity = getPopularity(b.tags);
          const popularityOrder = { 'Very popular': 0, 'Popular': 1, 'Not popular': 2 };
          return (popularityOrder[aPopularity] || 3) - (popularityOrder[bPopularity] || 3);
        });
    }

    renderGameList();
    updateResultsCount();
  }

  // Get popularity level from tags
  function getPopularity(tags) {
    if (!tags) return null;
    if (tags.includes('Very popular')) return 'Very popular';
    if (tags.includes('Popular')) return 'Popular';
    if (tags.includes('Not popular')) return 'Not popular';
    return null;
  }

  // Render game list
  function renderGameList() {
    gameListEl.innerHTML = '';

    if (filteredGames.length === 0) {
      gameListEl.innerHTML = '<p style="color: #fff; padding: 20px; text-align: center;">No games found matching your criteria.</p>';
      return;
    }

    filteredGames.forEach(game => {
      const itemEl = document.createElement('a');
      itemEl.className = 'game-item';
      itemEl.href = game.url;
      itemEl.target = '_blank';
      itemEl.rel = 'noopener noreferrer';

      // Get install status from the game object
      const isInstalled = game.installed;

      // Determine platform icon
      let platformIcon = '<ion-icon name="desktop-outline"></ion-icon>';
      if (game.platform) {
        if (game.platform === 'ps3') {
          platformIcon = '<img src="../assets/images/list_images/Other/ps3.png" alt="PS3" class="platform-icon">';
        } else if (game.platform === 'ps4') {
          platformIcon = '<img src="../assets/images/list_images/Other/ps4.png" alt="PS4" class="platform-icon">';
        }
      }

      // Add copies count if available
      const copiesDisplay = game.copies ? `<span class="game-copies"> | ${game.copies} pcs</span>` : '';

      // Check if game is in cart
      const inCart = window.KaptamCart && window.KaptamCart.isInCart(game.id);

      itemEl.innerHTML = `
        <img src="${game.image}" alt="${game.name}" class="game-item-image" loading="lazy">
        <div class="game-item-info">
          <div class="game-item-name">
            ${game.name}
          </div>
          <div class="game-item-platforms">
            ${platformIcon}${copiesDisplay}
          </div>
        </div>
        <span class="game-item-status ${isInstalled ? 'installed' : 'not-installed'}">
          ${isInstalled ? 'Installed' : 'Not installed'}
        </span>
        <div class="game-item-cart-actions" data-game-id="${game.id}" data-game-name="${game.name}" data-game-image="${game.image}">
          <button class="cart-btn cart-remove-btn ${inCart ? 'visible' : ''}" title="Remove from cart">
            <ion-icon name="trash-outline"></ion-icon>
          </button>
          <button class="cart-btn cart-add-btn ${inCart ? 'in-cart' : ''}" title="${inCart ? 'In cart' : 'Add to cart'}">
            <ion-icon name="${inCart ? 'bag-check-outline' : 'bag-add-outline'}"></ion-icon>
          </button>
        </div>
      `;

      gameListEl.appendChild(itemEl);
    });
  }

  // Update results count
  function updateResultsCount() {
    resultsCountEl.textContent = `${filteredGames.length} result${filteredGames.length !== 1 ? 's' : ''}`;
  }

  // Toggle tag include state: null <-> include
  function toggleTagInclude(tag) {
    const currentState = tagFilters.get(tag) || null;

    if (currentState === 'include') {
      tagFilters.delete(tag);
    } else {
      tagFilters.set(tag, 'include');
    }

    renderTagFilters();
    applyFiltersAndSort();
  }

  // Toggle tag exclude state: null <-> exclude
  function toggleTagExclude(tag) {
    const currentState = tagFilters.get(tag) || null;

    if (currentState === 'exclude') {
      tagFilters.delete(tag);
    } else {
      tagFilters.set(tag, 'exclude');
    }

    renderTagFilters();
    applyFiltersAndSort();
  }

  // Toggle mobile filter sidebar
  function toggleFilterSidebar(show) {
    if (show) {
      filterSidebar.classList.add('active');
      filterOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    } else {
      filterSidebar.classList.remove('active');
      filterOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // Bind events
  function bindEvents() {
    // Search
    searchBtn.addEventListener('click', applyFiltersAndSort);
    searchInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') applyFiltersAndSort();
    });

    // Sort
    sortSelect.addEventListener('change', applyFiltersAndSort);

    // Tag filters (event delegation)
    tagFiltersEl.addEventListener('click', (e) => {
      const filterItem = e.target.closest('.tag-filter-item');
      if (!filterItem) return;

      const tag = filterItem.dataset.tag;
      const isExcludeBtn = e.target.closest('.tag-exclude-btn');
      const isCheckbox = e.target.closest('.tag-checkbox');

      if (isExcludeBtn) {
        toggleTagExclude(tag);
      } else if (isCheckbox) {
        toggleTagInclude(tag);
      }
    });

    // Mobile filter toggle
    filterToggleBtn.addEventListener('click', () => toggleFilterSidebar(true));
    filterCloseBtn.addEventListener('click', () => toggleFilterSidebar(false));
    filterOverlay.addEventListener('click', () => toggleFilterSidebar(false));

    // Cart button handlers (event delegation)
    gameListEl.addEventListener('click', (e) => {
      const addBtn = e.target.closest('.cart-add-btn');
      const removeBtn = e.target.closest('.cart-remove-btn');

      if (!addBtn && !removeBtn) return;

      e.preventDefault();
      e.stopPropagation();

      const cartActions = e.target.closest('.game-item-cart-actions');
      if (!cartActions) return;

      const gameId = parseInt(cartActions.dataset.gameId);
      const gameName = cartActions.dataset.gameName;
      const gameImage = cartActions.dataset.gameImage;

      if (addBtn && !window.KaptamCart.isInCart(gameId)) {
        // Add to cart
        window.KaptamCart.addItem(gameId, gameName, gameImage);
        updateCartButtons(cartActions, true);
      } else if (removeBtn) {
        // Remove from cart
        window.KaptamCart.removeItem(gameId);
        updateCartButtons(cartActions, false);
      }
    });
  }

  // Update cart button appearance
  function updateCartButtons(cartActions, inCart) {
    const addBtn = cartActions.querySelector('.cart-add-btn');
    const removeBtn = cartActions.querySelector('.cart-remove-btn');

    if (inCart) {
      addBtn.classList.add('in-cart');
      addBtn.title = 'In cart';
      addBtn.innerHTML = '<ion-icon name="bag-check-outline"></ion-icon>';
      removeBtn.classList.add('visible');
    } else {
      addBtn.classList.remove('in-cart');
      addBtn.title = 'Add to cart';
      addBtn.innerHTML = '<ion-icon name="bag-add-outline"></ion-icon>';
      removeBtn.classList.remove('visible');
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
