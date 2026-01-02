/**
 * Boardgame List Page - Search, Filter, and Sort functionality
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
    'Light',
    'Medium',
    'Heavy',
    'Solo',
    '2 players',
    '2-4 players',
    '2-6 players',
    '4+ players',
    '6+ players',
    'Quick (<30 min)',
    'Medium (30-60 min)',
    'Long (60-120 min)',
    'Epic (120+ min)',
    'K3',
    'K7',
    'K12',
    'K16',
    'K18'
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

    checkWelcomeMessage();
    await loadGames();
    extractTags();
    renderTagFilters();
    applyFiltersAndSort();
    bindEvents();
  }

  // Check and show welcome message
  function checkWelcomeMessage() {
    const WELCOME_KEY = 'kaptam_boardgames_welcome_dismissed';
    const welcomeMessage = document.getElementById('welcome-message');
    const closeBtn = document.getElementById('welcome-message-close');

    if (!welcomeMessage || !closeBtn) return;

    // Check if user has dismissed the message before
    const isDismissed = localStorage.getItem(WELCOME_KEY);

    if (!isDismissed) {
      welcomeMessage.style.display = 'block';
    }

    // Handle close button
    closeBtn.addEventListener('click', () => {
      welcomeMessage.style.display = 'none';
      localStorage.setItem(WELCOME_KEY, 'true');
    });
  }

  // Load games from JSON
  async function loadGames() {
    try {
      const response = await fetch('../assets/list/boardgames.json');
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

    // Separate age rating tags from other tags
    const ageRatingTags = ['K3', 'K7', 'K12', 'K16', 'K18'];
    const regularTags = [];
    const ageRatings = [];

    allTags.forEach((count, tag) => {
      if (ageRatingTags.includes(tag)) {
        ageRatings.push({ tag, count });
      } else {
        regularTags.push({ tag, count });
      }
    });

    // Render regular tags
    regularTags.forEach(({ tag, count }) => {
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

    // Render age rating section if there are any age ratings
    if (ageRatings.length > 0) {
      const ageRatingContainer = document.createElement('div');
      ageRatingContainer.className = 'age-rating-filters';

      ageRatings.forEach(({ tag, count }) => {
        const filterState = tagFilters.get(tag) || null;

        const itemEl = document.createElement('div');
        itemEl.className = 'age-rating-item';
        itemEl.dataset.tag = tag;

        const checkboxEl = document.createElement('div');
        checkboxEl.className = 'age-rating-checkbox';
        if (filterState === 'include') checkboxEl.classList.add('checked');

        const nameEl = document.createElement('span');
        nameEl.className = 'age-rating-name';
        nameEl.textContent = tag;

        itemEl.appendChild(checkboxEl);
        itemEl.appendChild(nameEl);
        ageRatingContainer.appendChild(itemEl);
      });

      tagFiltersEl.appendChild(ageRatingContainer);
    }
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
        const nameFinMatch = game.name_fin && game.name_fin.toLowerCase().includes(searchTerm);
        const tagMatch = game.tags && game.tags.toLowerCase().includes(searchTerm);
        if (!nameMatch && !nameFinMatch && !tagMatch) return false;
      }

      // Tag filters
      const gameTags = game.tags ? game.tags.split(',').map(t => t.trim().toLowerCase()) : [];

      // Separate age rating tags from other tags
      const ageRatingTags = ['k3', 'k7', 'k12', 'k16', 'k18'];
      
      const includeTags = [...tagFilters.entries()]
        .filter(([, state]) => state === 'include')
        .map(([tag]) => tag.toLowerCase());

      const ageRatingFilters = includeTags.filter(tag => ageRatingTags.includes(tag));
      const otherFilters = includeTags.filter(tag => !ageRatingTags.includes(tag));

      // Check other filters (must have ALL selected tags)
      if (otherFilters.length > 0) {
        const hasAllOtherTags = otherFilters.every(tag => gameTags.includes(tag));
        if (!hasAllOtherTags) return false;
      }

      // Check age rating filters (must have AT LEAST ONE if any are selected)
      if (ageRatingFilters.length > 0) {
        const hasAnyAgeRating = ageRatingFilters.some(tag => gameTags.includes(tag));
        if (!hasAnyAgeRating) return false;
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
      case 'playtime-short':
        filteredGames.sort((a, b) => a.playtime - b.playtime);
        break;
      case 'playtime-long':
        filteredGames.sort((a, b) => b.playtime - a.playtime);
        break;
      case 'copies':
        filteredGames.sort((a, b) => b.copies - a.copies);
        break;
    }

    renderGameList();
    updateResultsCount();
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

      // Format playtime
      const playtimeDisplay = game.playtime ? `⏱ ${game.playtime} min` : '';
      const copiesDisplay = game.copies ? `📦 ${game.copies} ${game.copies === 1 ? 'copy' : 'copies'}` : '';

      // Check if game is in cart
      const inCart = window.KaptamCart && window.KaptamCart.isInCart(game.id);

      itemEl.innerHTML = `
        <img src="${game.image}" alt="${game.name}" class="game-item-image" loading="lazy">
        <div class="game-item-info">
          <div class="game-item-name">
            <p>${game.name}</p>
          </div>
          <div class="game-item-platforms">
            <span class="boardgame-info">👥 ${game.players}</span>
            ${playtimeDisplay ? `<span class="boardgame-info">${playtimeDisplay}</span>` : ''}
          </div>
        </div>
        ${game.tutorial ? `
          <div class="game-item-tutorial">
            ${game.tutorial_length ? `<span class="tutorial-length"> ${game.tutorial_length} min</span>` : ''}
            <a href="${game.tutorial}" target="_blank" rel="noopener noreferrer" class="tutorial-btn" title="View tutorial">
              <ion-icon name="help-outline"></ion-icon>
            </a>
          </div>
        ` : ''}
        <div class="game-item-cart-actions" data-game-id="${game.id}" data-game-name="${game.name}" data-game-image="${game.image}" data-game-type="boardgame">
          <button class="cart-btn cart-remove-btn ${inCart ? 'visible' : ''}" title="Remove from cart">
            <ion-icon name="trash-outline"></ion-icon>
          </button>
          <button class="cart-btn cart-add-btn ${inCart ? 'in-cart' : ''}" title="${inCart ? 'In cart' : 'Add to cart'}">
            <ion-icon name="${inCart ? 'checkmark-outline' : 'add-outline'}"></ion-icon>
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

  // Show cart limit modal
  function showCartLimitModal() {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-content">
        <h3>Cart Limit Reached</h3>
        <p>Maximum of 20 games per 1 reservation</p>
        <div class="modal-actions">
          <button class="checkout-btn primary modal-ok-btn">
            OK
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Handle OK button
    const okBtn = overlay.querySelector('.modal-ok-btn');
    okBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    // Handle clicking outside modal
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });
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
      // Handle regular tag filters
      const filterItem = e.target.closest('.tag-filter-item');
      if (filterItem) {
        const tag = filterItem.dataset.tag;
        const isExcludeBtn = e.target.closest('.tag-exclude-btn');
        const isCheckbox = e.target.closest('.tag-checkbox');
        const isTagName = e.target.closest('.tag-name');

        if (isExcludeBtn) {
          toggleTagExclude(tag);
        } else if (isCheckbox || isTagName) {
          toggleTagInclude(tag);
        }
        return;
      }

      // Handle age rating filters
      const ageRatingItem = e.target.closest('.age-rating-item');
      if (ageRatingItem) {
        const tag = ageRatingItem.dataset.tag;
        toggleTagInclude(tag);
        return;
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
      const gameType = cartActions.dataset.gameType;

      if (addBtn) {
        if (window.KaptamCart.isInCart(gameId)) {
          // Remove from cart (same as trash button)
          window.KaptamCart.removeItem(gameId);
          updateCartButtons(cartActions, false);
        } else {
          // Add to cart
          const result = window.KaptamCart.addItem(gameId, gameName, gameImage, gameType);
          if (result === 'limit_reached') {
            showCartLimitModal();
          } else if (result) {
            updateCartButtons(cartActions, true);
          }
        }
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
      addBtn.innerHTML = '<ion-icon name="checkmark-outline"></ion-icon>';
      removeBtn.classList.add('visible');
    } else {
      addBtn.classList.remove('in-cart');
      addBtn.title = 'Add to cart';
      addBtn.innerHTML = '<ion-icon name="add-outline"></ion-icon>';
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