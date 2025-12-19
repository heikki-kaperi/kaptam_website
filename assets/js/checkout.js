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

  // State
  let isEditingPrevious = false;
  let previousCode = null;
  let pendingLoadCode = null;
  let allGames = [];

  // Initialize
  async function init() {
    if (!checkoutMain) return;

    // Load games data to get size and installed information
    await loadGamesData();

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

  // Calculate total size of NOT installed games in cart
  function calculateTotalSize() {
    const items = window.KaptamCart.getItems();
    let totalSize = 0;

    items.forEach(item => {
      const game = allGames.find(g => g.id === item.id);
      // Only count size if game is NOT installed
      if (game && game.size && !game.installed) {
        totalSize += game.size;
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
      return;
    }

    emptyCartMessage.style.display = 'none';
    cartItemsList.innerHTML = '';

    items.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'cart-item';
      itemEl.dataset.gameId = item.id;

      // Get game data to check installed status
      const game = allGames.find(g => g.id === item.id);
      const isInstalled = game ? game.installed : false;

      itemEl.innerHTML = `
        <img src="${item.image}" alt="${item.name}" class="cart-item-image">
        <div class="cart-item-info">
          <span class="cart-item-name">${item.name}</span>
          <span class="cart-item-status ${isInstalled ? 'installed' : 'not-installed'}">
            ${isInstalled ? 'Installed' : 'Will install before session'}
          </span>
        </div>
        <button class="cart-item-remove" title="Remove from cart">
          <ion-icon name="trash-outline"></ion-icon>
        </button>
      `;

      cartItemsList.appendChild(itemEl);
    });

    updateSubmitButton();
    updateInfoNoticeVisibility();
  }

  // Update submit button state
  function updateSubmitButton() {
    const items = window.KaptamCart.getItems();
    const nameValue = inputName.value.trim();
    const dateValue = inputDate.value;

    submitBtn.disabled = items.length === 0 || nameValue === '' || dateValue === '';
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
      date: inputDate.value
    };

    if (!formData.name) {
      showNotification('Please enter your name or nickname', 'error');
      inputName.focus();
      return;
    }

    if (!formData.date) {
      showNotification('Please select a date', 'error');
      inputDate.focus();
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
    inputDate.addEventListener('change', updateSubmitButton);

    // Remove item from cart (event delegation)
    cartItemsList.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.cart-item-remove');
      if (removeBtn) {
        const cartItem = removeBtn.closest('.cart-item');
        const gameId = parseInt(cartItem.dataset.gameId);
        removeCartItem(gameId);
      }
    });

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