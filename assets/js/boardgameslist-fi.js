/**
 * Boardgame List Page - Finnish Version
 */

(function() {
  'use strict';

  // State
  let allGames = [];
  let filteredGames = [];
  let allTags = new Map(); // tag -> count
  let tagFilters = new Map(); // tag -> 'include' | 'exclude' | null

  // Date state
  const SELECTED_DATE_KEY = 'kaptam_selected_date';
  let selectedDate = null;

  // Tag translations (English to Finnish)
  const tagTranslations = {
    'Light': 'Kevyt',
    'Medium': 'Keskitaso',
    'Heavy': 'Raskas',
    'Solo': 'Yksinpeli',
    '2 players': '2 pelaajaa',
    '2-4 players': '2-4 pelaajaa',
    '2-6 players': '2-6 pelaajaa',
    '4+ players': '4+ pelaajaa',
    '6+ players': '6+ pelaajaa',
    'Quick (<30 min)': 'Nopea (<30 min)',
    'Medium (30-60 min)': 'Keskipitkä (30-60 min)',
    'Long (60-120 min)': 'Pitkä (60-120 min)',
    'Epic (120+ min)': 'Eeppinen (120+ min)'
  };

  // Predetermined tag order (in Finnish)
  const tagOrder = [
    'Kevyt',
    'Keskitaso',
    'Raskas',
    'Yksinpeli',
    '2 pelaajaa',
    '2-4 pelaajaa',
    '2-6 pelaajaa',
    '4+ pelaajaa',
    '6+ pelaajaa',
    'Nopea (<30 min)',
    'Keskipitkä (30-60 min)',
    'Pitkä (60-120 min)',
    'Eeppinen (120+ min)',
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

  // Translate a tag from English to Finnish
  function translateTag(tag) {
    return tagTranslations[tag] || tag;
  }

  // Load selected date from localStorage
  function loadSelectedDate() {
    const visitDateSelect = document.getElementById('visit-date-select');
    if (!visitDateSelect) return;

    try {
      const saved = localStorage.getItem(SELECTED_DATE_KEY);
      if (saved) {
        selectedDate = saved;
        visitDateSelect.value = saved;
        updateDateInfo();
      }
    } catch (error) {
      console.error('Virhe päivämäärän lataamisessa:', error);
    }
  }

  // Save selected date to localStorage
  function saveSelectedDate(date) {
    selectedDate = date;
    try {
      if (date) {
        localStorage.setItem(SELECTED_DATE_KEY, date);
      } else {
        localStorage.removeItem(SELECTED_DATE_KEY);
      }
    } catch (error) {
      console.error('Virhe päivämäärän tallentamisessa:', error);
    }
  }

  // Update date info text
  function updateDateInfo() {
    const dateInfo = document.getElementById('date-info');
    if (!dateInfo) return;

    if (selectedDate) {
      const cartCount = window.KaptamCart.getCount();
      if (cartCount > 0) {
        dateInfo.textContent = `Varataan ${new Date(selectedDate).toLocaleDateString('fi-FI', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
        dateInfo.style.color = 'var(--marigold)';
      } else {
        dateInfo.textContent = '';
      }
    } else {
      dateInfo.textContent = 'Valitse päivämäärä ennen pelien lisäämistä';
      dateInfo.style.color = 'var(--roman-silver)';
    }
  }

  // Check if date can be changed
  function canChangeDate() {
    const cartCount = window.KaptamCart.getCount();
    if (cartCount > 0) {
      return confirm('Päivämäärän vaihtaminen tyhjentää nykyisen korisi. Jatketaanko?');
    }
    return true;
  }

  // Initialize
  async function init() {
    if (!gameListEl) return;

    checkWelcomeMessage();
    loadSelectedDate();
    await loadGames();
    extractTags();
    renderTagFilters();
    applyFiltersAndSort();
    bindEvents();
  }

  // Check and show welcome message
  function checkWelcomeMessage() {
    const WELCOME_KEY = 'kaptam_gamelist_welcome_dismissed';
    const welcomeMessage = document.getElementById('welcome-message');
    const closeBtn = document.getElementById('welcome-message-close');

    if (!welcomeMessage || !closeBtn) return;

    const isDismissed = localStorage.getItem(WELCOME_KEY);

    if (!isDismissed) {
      welcomeMessage.style.display = 'block';
    }

    closeBtn.addEventListener('click', () => {
      welcomeMessage.style.display = 'none';
      localStorage.setItem(WELCOME_KEY, 'true');
    });
  }

  // Load games from JSON
  async function loadGames() {
    try {
      const response = await fetch('../assets/list/boardgames.json');
      if (!response.ok) throw new Error('Pelien lataus epäonnistui');
      allGames = await response.json();
    } catch (error) {
      console.error('Virhe pelien lataamisessa:', error);
      gameListEl.innerHTML = '<p style="color: #fff; padding: 20px;">Virhe pelien lataamisessa. Yritä myöhemmin uudelleen.</p>';
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
            const translatedTag = translateTag(tag);
            allTags.set(translatedTag, (allTags.get(translatedTag) || 0) + 1);
          }
        });
      }
    });

    // Sort tags using predetermined order
    allTags = new Map([...allTags.entries()].sort((a, b) => {
      const aIndex = tagOrder.indexOf(a[0]);
      const bIndex = tagOrder.indexOf(b[0]);

      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a[0].localeCompare(b[0], 'fi');
    }));
  }

  // Render tag filter checkboxes
  function renderTagFilters() {
    tagFiltersEl.innerHTML = '';

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
      excludeBtn.title = 'Sulje pois tulokset tällä tagilla';
      excludeBtn.innerHTML = '−';

      itemEl.appendChild(checkboxEl);
      itemEl.appendChild(nameEl);
      itemEl.appendChild(excludeBtn);
      tagFiltersEl.appendChild(itemEl);
    });

    // Render age rating section
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
      // Search filter - search in Finnish name
      if (searchTerm) {
        const nameMatch = game.name_fin && game.name_fin.toLowerCase().includes(searchTerm);
        const nameEngMatch = game.name.toLowerCase().includes(searchTerm);
        const tagMatch = game.tags && game.tags.toLowerCase().includes(searchTerm);
        if (!nameMatch && !nameEngMatch && !tagMatch) return false;
      }

      // Tag filters
      const gameTags = game.tags ? game.tags.split(',').map(t => translateTag(t.trim()).toLowerCase()) : [];

      const ageRatingTags = ['k3', 'k7', 'k12', 'k16', 'k18'];
      
      const includeTags = [...tagFilters.entries()]
        .filter(([, state]) => state === 'include')
        .map(([tag]) => tag.toLowerCase());

      const ageRatingFilters = includeTags.filter(tag => ageRatingTags.includes(tag));
      const otherFilters = includeTags.filter(tag => !ageRatingTags.includes(tag));

      if (otherFilters.length > 0) {
        const hasAllOtherTags = otherFilters.every(tag => gameTags.includes(tag));
        if (!hasAllOtherTags) return false;
      }

      if (ageRatingFilters.length > 0) {
        const hasAnyAgeRating = ageRatingFilters.some(tag => gameTags.includes(tag));
        if (!hasAnyAgeRating) return false;
      }

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
        filteredGames.sort((a, b) => (a.name_fin || a.name).localeCompare(b.name_fin || b.name, 'fi'));
        break;
      case 'name-desc':
        filteredGames.sort((a, b) => (b.name_fin || b.name).localeCompare(a.name_fin || a.name, 'fi'));
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
      gameListEl.innerHTML = '<p style="color: #fff; padding: 20px; text-align: center;">Ei pelejä hakuehdoillasi.</p>';
      return;
    }

    filteredGames.forEach(game => {
      const itemEl = document.createElement('a');
      itemEl.className = 'game-item';
      itemEl.href = game.url;
      itemEl.target = '_blank';
      itemEl.rel = 'noopener noreferrer';

      // Use Finnish name
      const gameName = game.name_fin || game.name;

      // Format playtime
      const playtimeDisplay = game.playtime ? `⏱ ${game.playtime} min` : '';

      // Check if game is in cart
      const inCart = window.KaptamCart && window.KaptamCart.isInCart(game.id);

      // Tutorial text translation
      let tutorialSection = '';
      if (game.tutorial) {
        const tutorialLengthText = game.tutorial_length ? ` ${game.tutorial_length} min` : 'Teksti';
        tutorialSection = `
          <div class="game-item-tutorial">
            <span class="tutorial-length">${tutorialLengthText}</span>
            <a href="${game.tutorial}" target="_blank" rel="noopener noreferrer" class="tutorial-btn" title="Katso opetus">
              <ion-icon name="help-outline"></ion-icon>
            </a>
          </div>
        `;
      }

      itemEl.innerHTML = `
        <img src="${game.image}" alt="${gameName}" class="game-item-image" loading="lazy">
        <div class="game-item-info">
          <div class="game-item-name">
            <p>${gameName}</p>
          </div>
          <div class="game-item-platforms">
            <span class="boardgame-info">👥 ${game.players}</span>
            ${playtimeDisplay ? `<span class="boardgame-info">${playtimeDisplay}</span>` : ''}
          </div>
        </div>
        ${tutorialSection}
        <div class="game-item-cart-actions" data-game-id="${game.id}" data-game-name="${gameName}" data-game-image="${game.image}" data-game-type="boardgame">
          <button class="cart-btn cart-remove-btn ${inCart ? 'visible' : ''}" title="Poista korista">
            <ion-icon name="trash-outline"></ion-icon>
          </button>
          <button class="cart-btn cart-add-btn ${inCart ? 'in-cart' : ''}" title="${inCart ? 'Korissa' : 'Lisää varaukseen'}">
            <ion-icon name="${inCart ? 'checkmark-outline' : 'add-outline'}"></ion-icon>
          </button>
        </div>
      `;

      gameListEl.appendChild(itemEl);
    });
  }

  // Update results count
  function updateResultsCount() {
    const count = filteredGames.length;
    resultsCountEl.textContent = `${count} ${count === 1 ? 'tulos' : 'tulosta'}`;
  }

  // Toggle tag include state
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

  // Toggle tag exclude state
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
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-content">
        <h3>Koriraja saavutettu</h3>
        <p>Maksimissaan 20 peliä yhtä varausta kohden</p>
        <div class="modal-actions">
          <button class="checkout-btn primary modal-ok-btn">
            OK
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const okBtn = overlay.querySelector('.modal-ok-btn');
    okBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });
  }

  // Show notification
  function showNotification(message, type) {
    const existing = document.querySelector('.game-list-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `game-list-notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background-color: ${type === 'error' ? 'var(--red)' : 'var(--marigold)'};
      color: var(--white);
      padding: 15px 25px;
      border-radius: 8px;
      font-size: var(--fs-9);
      z-index: 1000;
      animation: slideUp 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
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

    // Tag filters
    tagFiltersEl.addEventListener('click', (e) => {
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

      const ageRatingItem = e.target.closest('.age-rating-item');
      if (ageRatingItem) {
        const tag = ageRatingItem.dataset.tag;
        toggleTagInclude(tag);
        return;
      }
    });

    // Date selection
    const visitDateSelect = document.getElementById('visit-date-select');
    if (visitDateSelect) {
      visitDateSelect.addEventListener('change', (e) => {
        const newDate = e.target.value;

        if (!newDate) {
          saveSelectedDate(null);
          updateDateInfo();
          return;
        }

        if (!canChangeDate()) {
          e.target.value = selectedDate || '';
          return;
        }

        if (selectedDate && selectedDate !== newDate && window.KaptamCart.getCount() > 0) {
          window.KaptamCart.clearCart();
          resetAllCartButtons();
        }

        saveSelectedDate(newDate);
        updateDateInfo();
      });
    }

    // Mobile filter toggle
    filterToggleBtn.addEventListener('click', () => toggleFilterSidebar(true));
    filterCloseBtn.addEventListener('click', () => toggleFilterSidebar(false));
    filterOverlay.addEventListener('click', () => toggleFilterSidebar(false));

    // Cart button handlers
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
          window.KaptamCart.removeItem(gameId);
          updateCartButtons(cartActions, false);
          updateDateInfo();
        } else {
          if (!selectedDate) {
            showNotification('Valitse ensin vierailupäivä', 'error');
            return;
          }

          const result = window.KaptamCart.addItem(gameId, gameName, gameImage, gameType);
          if (result === 'limit_reached') {
            showCartLimitModal();
          } else if (result) {
            updateCartButtons(cartActions, true);
            updateDateInfo();
          }
        }
      } else if (removeBtn) {
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
      addBtn.title = 'Korissa';
      addBtn.innerHTML = '<ion-icon name="checkmark-outline"></ion-icon>';
      removeBtn.classList.add('visible');
    } else {
      addBtn.classList.remove('in-cart');
      addBtn.title = 'Lisää koriin';
      addBtn.innerHTML = '<ion-icon name="add-outline"></ion-icon>';
      removeBtn.classList.remove('visible');
    }
  }

  // Reset all cart buttons
  function resetAllCartButtons() {
    const allCartActions = document.querySelectorAll('.game-item-cart-actions');
    allCartActions.forEach(cartActions => {
      updateCartButtons(cartActions, false);
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();