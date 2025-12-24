/**
 * Shopping Cart Module - Cookie-free using localStorage
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'kaptam_cart';
  const LAST_CODE_KEY = 'kaptam_last_code';

  // Cart state
  let cartItems = [];

  // Initialize cart from localStorage
  function init() {
    loadCart();
    updateCartIcon();
  }

  // Load cart from localStorage
  function loadCart() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      cartItems = stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Error loading cart:', e);
      cartItems = [];
    }
  }

  // Save cart to localStorage
  function saveCart() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
    } catch (e) {
      console.error('Error saving cart:', e);
    }
  }

// Add item to cart
  function addItem(gameId, gameName, gameImage) {
    if (!isInCart(gameId)) {
      // Check if cart is full (max 20 games)
      if (cartItems.length >= 20) {
        return 'limit_reached';
      }
      
      cartItems.push({
        id: gameId,
        name: gameName,
        image: gameImage,
        addedAt: new Date().toISOString()
      });
      saveCart();
      updateCartIcon();
      return true;
    }
    return false;
  }

  // Remove item from cart
  function removeItem(gameId) {
    const index = cartItems.findIndex(item => item.id === gameId);
    if (index !== -1) {
      cartItems.splice(index, 1);
      saveCart();
      updateCartIcon();
      return true;
    }
    return false;
  }

  // Check if item is in cart
  function isInCart(gameId) {
    return cartItems.some(item => item.id === gameId);
  }

  // Get all cart items
  function getItems() {
    return [...cartItems];
  }

  // Get cart count
  function getCount() {
    return cartItems.length;
  }

  // Clear cart
  function clearCart() {
    cartItems = [];
    saveCart();
    updateCartIcon();
  }

  // Clear all items from cart with confirmation
  function clearCartWithConfirmation() {
    if (confirm('Are you sure you want to clear your reservation?')) {
      clearCart();

      // Refresh game list if on that page
      if (window.location.pathname.includes('list.html') || window.location.pathname.includes('v-list')) {
        window.location.reload();
      }
    }
  }

  // Update cart icon appearance
  function updateCartIcon() {
    // Update desktop cart icon
    const cartIcon = document.getElementById('cart-icon-btn');
    if (cartIcon) {
      if (cartItems.length > 0) {
        cartIcon.classList.add('has-items');
        cartIcon.setAttribute('title', `Cart (${cartItems.length} items)`);
      } else {
        cartIcon.classList.remove('has-items');
        cartIcon.setAttribute('title', 'Reserve (empty)');
      }
    }

    // Update mobile cart icon
    const cartIconMobile = document.getElementById('cart-icon-btn-mobile');
    if (cartIconMobile) {
      if (cartItems.length > 0) {
        cartIconMobile.classList.add('has-items');
        cartIconMobile.setAttribute('title', `Cart (${cartItems.length} items)`);
      } else {
        cartIconMobile.classList.remove('has-items');
        cartIconMobile.setAttribute('title', 'Reserve (empty)');
      }
    }

    // Update cart count badges
    const cartBadge = document.getElementById('cart-badge');
    if (cartBadge) {
      cartBadge.textContent = cartItems.length;
      cartBadge.style.display = cartItems.length > 0 ? 'flex' : 'none';
    }

    const cartBadgeMobile = document.getElementById('cart-badge-mobile');
    if (cartBadgeMobile) {
      cartBadgeMobile.textContent = cartItems.length;
      cartBadgeMobile.style.display = cartItems.length > 0 ? 'flex' : 'none';
    }

    // Update clear cart button visibility
    const clearBtn = document.getElementById('cart-clear-btn');
    if (clearBtn) {
      if (cartItems.length > 0) {
        clearBtn.classList.add('visible');
      } else {
        clearBtn.classList.remove('visible');
      }
    }

    const clearBtnMobile = document.getElementById('cart-clear-btn-mobile');
    if (clearBtnMobile) {
      if (cartItems.length > 0) {
        clearBtnMobile.classList.add('visible');
      } else {
        clearBtnMobile.classList.remove('visible');
      }
    }
  }

  // Save last used cart code
  function saveLastCode(code) {
    try {
      localStorage.setItem(LAST_CODE_KEY, code);
    } catch (e) {
      console.error('Error saving cart code:', e);
    }
  }

  // Get last used cart code
  function getLastCode() {
    try {
      return localStorage.getItem(LAST_CODE_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  // Load cart from server by code
  async function loadCartByCode(code) {
    try {
      const response = await fetch(`http://localhost:3000/api/cart/${code}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to load cart');
      }
      const data = await response.json();
      return data;
    } catch (e) {
      console.error('Error loading cart by code:', e);
      throw e;
    }
  }

  // Submit cart to server
  async function submitCart(formData) {
    try {
      const payload = {
        items: cartItems,
        name: formData.name,
        email: formData.email || null,
        controller: formData.controller,
        additionalInfo: formData.additionalInfo || null,
        date: formData.date || null
      };

      const response = await fetch('http://localhost:3000/api/cart/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit cart');
      }

      const data = await response.json();

      // Save the code for future reference
      saveLastCode(data.code);

      // Clear the cart after successful submission
      clearCart();

      return data;
    } catch (e) {
      console.error('Error submitting cart:', e);
      throw e;
    }
  }

  // Update existing cart on server
  async function updateCart(code, formData) {
    try {
      const payload = {
        items: cartItems,
        name: formData.name,
        email: formData.email || null,
        controller: formData.controller,
        additionalInfo: formData.additionalInfo || null,
        date: formData.date || null
      };

      const response = await fetch(`http://localhost:3000/api/cart/${code}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update cart');
      }

      const data = await response.json();

      // Clear the cart after successful update
      clearCart();

      return data;
    } catch (e) {
      console.error('Error updating cart:', e);
      throw e;
    }
  }

  // Set cart items (used when loading from server)
  function setItems(items) {
    cartItems = items.map(item => ({
      id: item.id,
      name: item.name,
      image: item.image,
      addedAt: item.addedAt || new Date().toISOString()
    }));
    saveCart();
    updateCartIcon();
  }

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Clear cart button handler
  document.addEventListener('DOMContentLoaded', function() {
    const clearCartBtn = document.getElementById('cart-clear-btn');
    if (clearCartBtn) {
      clearCartBtn.addEventListener('click', clearCartWithConfirmation);
    }

    const clearCartBtnMobile = document.getElementById('cart-clear-btn-mobile');
    if (clearCartBtnMobile) {
      clearCartBtnMobile.addEventListener('click', clearCartWithConfirmation);
    }
  });

  // Expose public API
  window.KaptamCart = {
    addItem,
    removeItem,
    isInCart,
    getItems,
    getCount,
    clearCart,
    updateCartIcon,
    saveLastCode,
    getLastCode,
    loadCartByCode,
    submitCart,
    updateCart,
    setItems
  };

})();