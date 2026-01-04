/**
 * Admin Dashboard JavaScript
 */

(function() {
  'use strict';

  const API_URL = 'http://localhost:3000';

  // DOM Elements
  const loginView = document.getElementById('login-view');
  const dashboardView = document.getElementById('dashboard-view');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');
  const adminUsername = document.getElementById('admin-username');
  
  const reservationsTbody = document.getElementById('reservations-tbody');
  const loadingMessage = document.getElementById('loading-message');
  const emptyMessage = document.getElementById('empty-message');
  
  const searchInput = document.getElementById('search-input');
  const dateFilter = document.getElementById('date-filter');
  
  const statTotal = document.getElementById('stat-total');
  const statItems = document.getElementById('stat-items');
  const statWeek = document.getElementById('stat-week');
  
  const viewModal = document.getElementById('view-modal');
  const modalClose = document.getElementById('modal-close');
  const editForm = document.getElementById('edit-form');
  const deleteBtn = document.getElementById('delete-btn');
  const cancelBtn = document.getElementById('cancel-btn');

  // State
  let allReservations = [];
  let filteredReservations = [];
  let currentReservation = null;

  // Initialize
  async function init() {
    await checkAuth();
    bindEvents();
  }

  // Check authentication status
  async function checkAuth() {
    try {
      const response = await fetch(`${API_URL}/api/admin/check`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        showDashboard(data.username);
        await loadReservations();
      } else {
        showLogin();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      showLogin();
    }
  }

  // Show login view
  function showLogin() {
    loginView.style.display = 'block';
    dashboardView.style.display = 'none';
  }

  // Show dashboard view
  function showDashboard(username) {
    loginView.style.display = 'none';
    dashboardView.style.display = 'block';
    adminUsername.textContent = username;
  }

  // Handle login
  async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    loginError.style.display = 'none';

    try {
      const response = await fetch(`${API_URL}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        showDashboard(data.username);
        await loadReservations();
        loginForm.reset();
      } else {
        loginError.textContent = data.message || 'Login failed';
        loginError.style.display = 'block';
      }
    } catch (error) {
      console.error('Login error:', error);
      loginError.textContent = 'Connection error. Please try again.';
      loginError.style.display = 'block';
    }
  }

  // Handle logout
  async function handleLogout() {
    try {
      await fetch(`${API_URL}/api/admin/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      
      allReservations = [];
      filteredReservations = [];
      showLogin();
      showNotification('Logged out successfully', 'success');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  // Load all reservations
  async function loadReservations() {
    loadingMessage.style.display = 'block';
    emptyMessage.style.display = 'none';
    reservationsTbody.innerHTML = '';

    try {
      const response = await fetch(`${API_URL}/api/admin/reservations`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load reservations');
      }

      allReservations = await response.json();
      applyFilters();
      updateStats();

    } catch (error) {
      console.error('Error loading reservations:', error);
      showNotification('Failed to load reservations', 'error');
    } finally {
      loadingMessage.style.display = 'none';
    }
  }

  // Apply filters
  function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const dateFilterValue = dateFilter.value;

    filteredReservations = allReservations.filter(reservation => {
      // Search filter
      if (searchTerm) {
        const matchesCode = reservation.code.toLowerCase().includes(searchTerm);
        const matchesName = reservation.name.toLowerCase().includes(searchTerm);
        const matchesEmail = reservation.email && reservation.email.toLowerCase().includes(searchTerm);
        
        if (!matchesCode && !matchesName && !matchesEmail) {
          return false;
        }
      }

      // Date filter
      if (dateFilterValue !== 'all' && reservation.visit_date) {
        const visitDate = new Date(reservation.visit_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (dateFilterValue === 'upcoming' && visitDate < today) {
          return false;
        }
        if (dateFilterValue === 'past' && visitDate >= today) {
          return false;
        }
      }

      return true;
    });

    renderReservations();
  }

  // Render reservations table
  function renderReservations() {
    reservationsTbody.innerHTML = '';

    if (filteredReservations.length === 0) {
      emptyMessage.style.display = 'block';
      return;
    }

    emptyMessage.style.display = 'none';

    filteredReservations.forEach(reservation => {
      const row = document.createElement('tr');
      
      const visitDate = reservation.visit_date 
        ? new Date(reservation.visit_date).toLocaleDateString('fi-FI')
        : '-';

      const createdDate = new Date(reservation.created_at).toLocaleDateString('fi-FI');

      row.innerHTML = `
        <td><span class="code-badge">${reservation.code}</span></td>
        <td>${reservation.name}</td>
        <td>${reservation.email || '-'}</td>
        <td>${visitDate}</td>
        <td><span class="item-count-badge">${reservation.item_count}</span></td>
        <td style="text-transform: capitalize;">${reservation.controller.replace('-', ' ')}</td>
        <td>${createdDate}</td>
        <td>
          <div class="table-actions">
            <button class="btn-icon view-btn" data-id="${reservation.id}" title="View/Edit">
              <ion-icon name="create-outline" style="font-size: 18px;"></ion-icon>
            </button>
            <button class="btn-icon delete delete-btn" data-id="${reservation.id}" title="Delete">
              <ion-icon name="trash-outline" style="font-size: 18px;"></ion-icon>
            </button>
          </div>
        </td>
      `;

      reservationsTbody.appendChild(row);
    });
  }

  // Update statistics
  function updateStats() {
    const total = allReservations.length;
    const totalItems = allReservations.reduce((sum, r) => sum + r.item_count, 0);
    
    // Count reservations from this week
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const thisWeek = allReservations.filter(r => {
      const createdDate = new Date(r.created_at);
      return createdDate >= startOfWeek;
    }).length;

    statTotal.textContent = total;
    statItems.textContent = totalItems;
    statWeek.textContent = thisWeek;
  }

  // View/Edit reservation
  async function viewReservation(id) {
    try {
      const response = await fetch(`${API_URL}/api/admin/reservations/${id}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load reservation');
      }

      currentReservation = await response.json();
      populateModal(currentReservation);
      viewModal.classList.add('active');

    } catch (error) {
      console.error('Error loading reservation:', error);
      showNotification('Failed to load reservation details', 'error');
    }
  }

  // Populate modal with reservation data
  function populateModal(reservation) {
    document.getElementById('edit-reservation-id').value = reservation.id;
    document.getElementById('edit-code').value = reservation.code;
    document.getElementById('edit-name').value = reservation.name;
    document.getElementById('edit-email').value = reservation.email || '';
    document.getElementById('edit-controller').value = reservation.controller;
    document.getElementById('edit-date').value = reservation.visit_date || '';
    document.getElementById('edit-additional').value = reservation.additional_info || '';

    // Format dates
    const createdAt = new Date(reservation.created_at).toLocaleString('fi-FI');
    const updatedAt = reservation.updated_at 
      ? new Date(reservation.updated_at).toLocaleString('fi-FI')
      : 'Never';

    document.getElementById('created-at').textContent = createdAt;
    document.getElementById('updated-at').textContent = updatedAt;

    // Render items
    const itemsList = document.getElementById('items-list');
    const itemsCount = document.getElementById('items-count');
    
    itemsList.innerHTML = '';
    itemsCount.textContent = reservation.items.length;

    reservation.items.forEach(item => {
      const itemCard = document.createElement('div');
      itemCard.className = 'item-card';
      itemCard.innerHTML = `
        <img src="${item.game_image}" alt="${item.game_name}">
        <div class="item-card-info">
          <div class="item-card-name">${item.game_name}</div>
          <div class="item-card-type">${item.game_type}</div>
        </div>
      `;
      itemsList.appendChild(itemCard);
    });
  }

  // Close modal
  function closeModal() {
    viewModal.classList.remove('active');
    currentReservation = null;
    editForm.reset();
  }

  // Handle edit form submission
  async function handleEditSubmit(e) {
    e.preventDefault();

    if (!currentReservation) return;

    const formData = {
      name: document.getElementById('edit-name').value.trim(),
      email: document.getElementById('edit-email').value.trim() || null,
      controller: document.getElementById('edit-controller').value,
      additionalInfo: document.getElementById('edit-additional').value.trim() || null,
      date: document.getElementById('edit-date').value || null,
      items: currentReservation.items
    };

    try {
      const response = await fetch(`${API_URL}/api/admin/reservations/${currentReservation.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Failed to update reservation');
      }

      showNotification('Reservation updated successfully', 'success');
      closeModal();
      await loadReservations();

    } catch (error) {
      console.error('Error updating reservation:', error);
      showNotification('Failed to update reservation', 'error');
    }
  }

  // Delete reservation
  async function deleteReservation(id) {
    if (!confirm('Are you sure you want to delete this reservation? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/admin/reservations/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete reservation');
      }

      showNotification('Reservation deleted successfully', 'success');
      closeModal();
      await loadReservations();

    } catch (error) {
      console.error('Error deleting reservation:', error);
      showNotification('Failed to delete reservation', 'error');
    }
  }

  // Show notification
  function showNotification(message, type = 'success') {
    // Remove existing notification
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Bind events
  function bindEvents() {
    // Login
    loginForm.addEventListener('submit', handleLogin);

    // Logout
    logoutBtn.addEventListener('click', handleLogout);

    // Search and filters
    searchInput.addEventListener('input', applyFilters);
    dateFilter.addEventListener('change', applyFilters);

    // Table actions (event delegation)
    reservationsTbody.addEventListener('click', (e) => {
      const viewBtn = e.target.closest('.view-btn');
      const deleteBtn = e.target.closest('.delete-btn');

      if (viewBtn) {
        const id = parseInt(viewBtn.dataset.id);
        viewReservation(id);
      } else if (deleteBtn) {
        const id = parseInt(deleteBtn.dataset.id);
        deleteReservation(id);
      }
    });

    // Modal
    modalClose.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    viewModal.addEventListener('click', (e) => {
      if (e.target === viewModal) {
        closeModal();
      }
    });

    // Edit form
    editForm.addEventListener('submit', handleEditSubmit);

    // Delete from modal
    deleteBtn.addEventListener('click', () => {
      if (currentReservation) {
        deleteReservation(currentReservation.id);
      }
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();