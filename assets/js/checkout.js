/**
 * Checkout Page Functionality
 */

(function() {
  'use strict';

  // DOM Elements
  const checkoutMain = document.getElementById('checkout-main');
  const thankYouView = document.getElementById('thank-you-view');
  const cartItemsList = document.getElementById('cart-items-list');
  const emptyCartMessage = document.getElementById('empty-cart-message');
  const checkoutForm = document.getElementById('checkout-form');
  const submitBtn = document.getElementById('submit-order-btn');
  const previousCodeInput = document.getElementById('previous-code-input');
  const loadPreviousBtn = document.getElementById('load-previous-btn');
  const confirmModal = document.getElementById('confirm-modal');
  const confirmYes = document.getElementById('confirm-yes');
  const confirmNo = document.getElementById('confirm-no');
  const orderCodeEl = document.getElementById('order-code');
  const copyCodeBtn = document.getElementById('copy-code-btn');
  const inputName = document.getElementById('input-name');
  const infoNotice = document.querySelector('.info-notice');
  const inputDate = document.getElementById('input-date');
  const controllerFormGroup = document.getElementById('controller-form-group');

  // State
  let isEditingPrevious = false;
  let previousCode = null;
  let pendingLoadCode = null;
  let allGames = [];

// Storage key for saved reservations
  const SAVED_RESERVATIONS_KEY = 'kaptam_saved_reservations';

  // Check if cart has videogames and show/hide controller option
  function updateControllerVisibility() {
    const items = window.KaptamCart.getItems();
    const hasVideogames = items.some(item => item.type === 'videogame');
    
    if (controllerFormGroup) {
      if (hasVideogames) {
        controllerFormGroup.style.display = 'flex';
      } else {
        controllerFormGroup.style.display = 'none';
      }
    }
  }

  // Load saved reservations from localStorage
  function loadSavedReservations() {
    const savedReservationsSection = document.getElementById('saved-reservations-section');
    const savedReservationsSelect = document.getElementById('saved-reservations-select');
    
    if (!savedReservationsSection || !savedReservationsSelect) return;

    try {
      const saved = localStorage.getItem(SAVED_RESERVATIONS_KEY);
      const reservations = saved ? JSON.parse(saved) : [];

      // Clear existing options (except first one)
      savedReservationsSelect.innerHTML = '<option value="">Select a previous reservation...</option>';

      if (reservations.length > 0) {
        // Show the section
        savedReservationsSection.style.display = 'block';

        // Add options for each saved reservation
        reservations.forEach(res => {
          const option = document.createElement('option');
          option.value = res.code;
          
          // Format: "27.02 - John (5 items)"
          const dateDisplay = res.date ? new Date(res.date).toLocaleDateString('fi-FI', { day: '2-digit', month: '2-digit' }) : 'No date';
          option.textContent = `${dateDisplay} - ${res.name} (${res.itemCount} items)`;
          
          savedReservationsSelect.appendChild(option);
        });
      }
    } catch (error) {
      console.error('Error loading saved reservations:', error);
    }
  }

  // Save reservation to localStorage
  function saveReservationToLocalStorage(code, formData, items) {
    try {
      const saved = localStorage.getItem(SAVED_RESERVATIONS_KEY);
      let reservations = saved ? JSON.parse(saved) : [];

      // Remove any existing reservation with the same code
      reservations = reservations.filter(r => r.code !== code);

      // Add new/updated reservation
      reservations.unshift({
        code: code,
        name: formData.name,
        date: formData.date,
        itemCount: items.length,
        savedAt: new Date().toISOString()
      });

      // Keep only last 10 reservations
      if (reservations.length > 10) {
        reservations = reservations.slice(0, 10);
      }

      localStorage.setItem(SAVED_RESERVATIONS_KEY, JSON.stringify(reservations));
    } catch (error) {
      console.error('Error saving reservation to localStorage:', error);
    }
  }

  // Delete reservation from localStorage
  function deleteReservationFromLocalStorage(code) {
    try {
      const saved = localStorage.getItem(SAVED_RESERVATIONS_KEY);
      if (!saved) return;

      let reservations = JSON.parse(saved);
      reservations = reservations.filter(r => r.code !== code);

      localStorage.setItem(SAVED_RESERVATIONS_KEY, JSON.stringify(reservations));
      loadSavedReservations(); // Refresh the dropdown
    } catch (error) {
      console.error('Error deleting reservation from localStorage:', error);
    }
  }

    // Auto-fill date from localStorage (selected on game list)
  function autoFillDate() {
    const SELECTED_DATE_KEY = 'kaptam_selected_date';
    try {
      const savedDate = localStorage.getItem(SELECTED_DATE_KEY);
      if (savedDate) {
        // Store in form data (no visible field anymore)
        document.getElementById('checkout-form').dataset.selectedDate = savedDate;
      }
    } catch (error) {
      console.error('Error loading selected date:', error);
    }
  }

  // Initialize
  async function init() {
    if (!checkoutMain) return;

    // Load games data to get size and installed information
    await loadGamesData();

    autoFillDate();

    // Check date availability
    await checkDateAvailability();

    // Check for code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code');

    if (codeFromUrl) {
      previousCodeInput.value = codeFromUrl;
      loadPreviousCart(codeFromUrl);
    } else {
      renderCartItems();
    }

    bindEvents();
    updateSubmitButton();
    updateInfoNoticeVisibility();
    updateControllerVisibility();
  }

  // Load games data to get size and installed information
  async function loadGamesData() {
    try {
      const response = await fetch('../assets/list/games.json');
      if (!response.ok) throw new Error('Failed to load games');
      allGames = await response.json();
    } catch (error) {
      console.error('Error loading games data:', error);
    }
  }

  // Check date availability from server
  async function checkDateAvailability() {
    try {
      const apiUrl = window.KaptamConfig?.endpoints.dateAvailability || 'http://localhost:3000/api/dates/availability';
      const response = await fetch(apiUrl);
      if (!response.ok) return;

      const availability = await response.json();

      // Update date options
      const options = inputDate.querySelectorAll('option[value]');
      options.forEach(option => {
        if (option.value) {
          const dateCount = availability[option.value] || 0;
          if (dateCount >= 6) {
            option.disabled = true;
            option.textContent = option.textContent.replace(' (FULL)', '') + ' (FULL)';
          }
        }
      });
    } catch (error) {
      console.error('Error checking date availability:', error);
    }
  }

  // Calculate total size of NOT installed games in cart
  function calculateTotalSize() {
    const items = window.KaptamCart.getItems();
    let totalSize = 0;

    items.forEach(item => {
      // Only check videogames (boardgames don't have size/installation)
      if (item.type === 'videogame') {
        const game = allGames.find(g => g.id === item.id);
        // Only count size if game is NOT installed
        if (game && game.size && !game.installed) {
          totalSize += game.size;
        }
      }
    });

    return totalSize;
  }

  // Update info notice visibility based on total size of not installed games
  function updateInfoNoticeVisibility() {
    const totalSize = calculateTotalSize();
    
    if (totalSize > 19.9) {
      infoNotice.style.display = 'flex';
    } else {
      infoNotice.style.display = 'none';
    }
  }

  // Render cart items
  function renderCartItems() {
    const items = window.KaptamCart.getItems();

    if (items.length === 0) {
      cartItemsList.innerHTML = '';
      emptyCartMessage.style.display = 'block';
      submitBtn.disabled = true;
      updateInfoNoticeVisibility();
      updateControllerVisibility();
      return;
    }

    emptyCartMessage.style.display = 'none';
    cartItemsList.innerHTML = '';

    items.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'cart-item';
      itemEl.dataset.gameId = item.id;

      // Only show installation status for videogames
      let statusHtml = '';
      if (item.type === 'videogame') {
        const game = allGames.find(g => g.id === item.id);
        const isInstalled = game ? game.installed : false;
        statusHtml = `
          <span class="cart-item-status ${isInstalled ? 'installed' : 'not-installed'}">
            ${isInstalled ? 'Installed' : 'Will install before session'}
          </span>
        `;
      }

      itemEl.innerHTML = `
        <img src="${item.image}" alt="${item.name}" class="cart-item-image">
        <div class="cart-item-info">
          <span class="cart-item-name">${item.name}</span>
          ${statusHtml}
        </div>
        <button class="cart-item-remove" title="Remove from cart">
          <ion-icon name="trash-outline"></ion-icon>
        </button>
      `;

      cartItemsList.appendChild(itemEl);
    });

    updateSubmitButton();
    updateInfoNoticeVisibility();
    updateControllerVisibility();
  }

  // Update submit button state
  function updateSubmitButton() {
    const items = window.KaptamCart.getItems();
    const nameValue = inputName.value.trim();

    submitBtn.disabled = items.length === 0 || nameValue === '';
  }

  // Remove item from cart
  function removeCartItem(gameId) {
    window.KaptamCart.removeItem(gameId);
    renderCartItems();
  }

  // Load previous cart
  async function loadPreviousCart(code) {
    if (!code) return;

    // Check if current cart has items
    const currentItems = window.KaptamCart.getItems();
    if (currentItems.length > 0 && !pendingLoadCode) {
      pendingLoadCode = code;
      showConfirmModal();
      return;
    }

    try {
      loadPreviousBtn.disabled = true;
      loadPreviousBtn.textContent = 'Loading...';

      const data = await window.KaptamCart.loadCartByCode(code);

      // Set cart items
      window.KaptamCart.setItems(data.items);

      // Fill form with saved data
      inputName.value = data.name || '';
      document.getElementById('input-email').value = data.email || '';
      document.getElementById('input-controller').value = data.controller || 'controller';
      document.getElementById('input-additional').value = data.additionalInfo || '';
      if (data.date) {
        inputDate.value = data.date;
      }

      // Mark as editing previous
      isEditingPrevious = true;
      previousCode = code;

      // Update UI
      renderCartItems();
      updateSubmitButton();

      // Show success message
      showNotification('Previous order loaded successfully!', 'success');

    } catch (error) {
      showNotification(error.message || 'Failed to load previous order', 'error');
    } finally {
      loadPreviousBtn.disabled = false;
      loadPreviousBtn.textContent = 'Load';
      pendingLoadCode = null;
    }
  }

  // Show confirmation modal
  function showConfirmModal() {
    confirmModal.style.display = 'flex';
  }

  // Hide confirmation modal
  function hideConfirmModal() {
    confirmModal.style.display = 'none';
  }

  // Submit order
  async function submitOrder(e) {
    e.preventDefault();

    const items = window.KaptamCart.getItems();
    if (items.length === 0) {
      showNotification('Your cart is empty', 'error');
      return;
    }

    const formData = {
      name: inputName.value.trim(),
      email: document.getElementById('input-email').value.trim(),
      controller: document.getElementById('input-controller').value,
      additionalInfo: document.getElementById('input-additional').value.trim(),
      date: document.getElementById('checkout-form').dataset.selectedDate || null
    };

    if (!formData.name) {
      showNotification('Please enter your name or nickname', 'error');
      inputName.focus();
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<ion-icon name="hourglass-outline"></ion-icon> Submitting...';

      let result;
      if (isEditingPrevious && previousCode) {
        result = await window.KaptamCart.updateCart(previousCode, formData);
      } else {
        result = await window.KaptamCart.submitCart(formData);
      }

      // Save to localStorage for quick access
      saveReservationToLocalStorage(result.code, formData, items);

      // Show thank you screen
      showThankYou(result.code);

    } catch (error) {
      showNotification(error.message || 'Failed to submit order', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<ion-icon name="checkmark-circle-outline"></ion-icon> Submit Order';
    }
  }

  // Show thank you screen
  function showThankYou(code) {
    checkoutMain.style.display = 'none';
    thankYouView.style.display = 'flex';
    orderCodeEl.textContent = code;
  }

  // Copy code to clipboard
  async function copyCode() {
    const code = orderCodeEl.textContent;
    try {
      await navigator.clipboard.writeText(code);
      showNotification('Code copied to clipboard!', 'success');
      copyCodeBtn.innerHTML = '<ion-icon name="checkmark-outline"></ion-icon>';
      setTimeout(() => {
        copyCodeBtn.innerHTML = '<ion-icon name="copy-outline"></ion-icon>';
      }, 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showNotification('Code copied!', 'success');
    }
  }

  // Show notification
  function showNotification(message, type) {
    // Remove existing notification
    const existing = document.querySelector('.checkout-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `checkout-notification ${type}`;
    notification.innerHTML = `
      <ion-icon name="${type === 'success' ? 'checkmark-circle' : 'alert-circle'}"></ion-icon>
      <span>${message}</span>
    `;

    document.body.appendChild(notification);

    // Auto remove after 4 seconds
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }

  // Bind events
  function bindEvents() {
    // Form submission
    checkoutForm.addEventListener('submit', submitOrder);

    // Name and date input for validation
    inputName.addEventListener('input', updateSubmitButton);

    // Remove item from cart (event delegation)
    cartItemsList.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.cart-item-remove');
      if (removeBtn) {
        const cartItem = removeBtn.closest('.cart-item');
        const gameId = parseInt(cartItem.dataset.gameId);
        removeCartItem(gameId);
      }
    });

    // Load saved reservation from dropdown
    const loadSavedBtn = document.getElementById('load-saved-btn');
    const savedReservationsSelect = document.getElementById('saved-reservations-select');
    
    if (loadSavedBtn && savedReservationsSelect) {
      loadSavedBtn.addEventListener('click', () => {
        const code = savedReservationsSelect.value;
        if (code) {
          loadPreviousCart(code);
        }
      });

      // Also load on Enter key in select
      savedReservationsSelect.addEventListener('change', (e) => {
        if (e.target.value) {
          // Optional: auto-load on selection
          // loadPreviousCart(e.target.value);
        }
      });
    }

    // Load previous cart
    loadPreviousBtn.addEventListener('click', () => {
      const code = previousCodeInput.value.trim().toUpperCase();
      if (code) {
        loadPreviousCart(code);
      }
    });

    // Enter key on previous code input
    previousCodeInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        const code = previousCodeInput.value.trim().toUpperCase();
        if (code) {
          loadPreviousCart(code);
        }
      }
    });

    // Confirmation modal
    confirmYes.addEventListener('click', () => {
      hideConfirmModal();
      window.KaptamCart.clearCart();
      if (pendingLoadCode) {
        loadPreviousCart(pendingLoadCode);
      }
    });

    confirmNo.addEventListener('click', () => {
      hideConfirmModal();
      pendingLoadCode = null;
    });

    // Close modal on overlay click
    confirmModal.addEventListener('click', (e) => {
      if (e.target === confirmModal) {
        hideConfirmModal();
        pendingLoadCode = null;
      }
    });

    // Copy code button
    copyCodeBtn.addEventListener('click', copyCode);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();