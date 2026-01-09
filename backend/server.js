const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// File paths
const RESERVATIONS_FILE = path.join(__dirname, 'data', 'reservations.json');
const BACKUP_FILE = path.join(__dirname, 'data', 'reservations.backup.json');
const ADMIN_CREDENTIALS_FILE = path.join(__dirname, 'data', 'admin-credentials.json');
const GAMES_FILE = path.join(__dirname, 'data', 'games.json');
const BOARDGAMES_FILE = path.join(__dirname, 'data', 'boardgames.json');

// Ensure data directory exists
async function ensureDataDirectory() {
  try {
    await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
  } catch (error) {
    console.error('Error creating data directory:', error);
  }
}

// Initialize files if they don't exist
async function initializeFiles() {
  await ensureDataDirectory();

  try {
    await fs.access(RESERVATIONS_FILE);
  } catch {
    await fs.writeFile(RESERVATIONS_FILE, JSON.stringify([], null, 2));
  }

  try {
    await fs.access(ADMIN_CREDENTIALS_FILE);
  } catch {
    const defaultCredentials = {
      username: 'admin',
      password: 'changeme123'
    };
    await fs.writeFile(ADMIN_CREDENTIALS_FILE, JSON.stringify(defaultCredentials, null, 2));
  }
}

// Generate reservation code (format: K4PT-AM7X)
function generateReservationCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar looking chars
  let code = '';
  
  // First part: 4 characters
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  code += '-';
  
  // Second part: 4 characters
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return code;
}

// Check if code is unique
async function isCodeUnique(code) {
  const reservations = await readReservations();
  return !reservations.some(r => r.code === code);
}

// Generate unique reservation code
async function generateUniqueCode() {
  let code;
  let attempts = 0;
  
  do {
    code = generateReservationCode();
    attempts++;
    if (attempts > 100) {
      throw new Error('Failed to generate unique code');
    }
  } while (!(await isCodeUnique(code)));
  
  return code;
}

// Read reservations
async function readReservations() {
  try {
    const data = await fs.readFile(RESERVATIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Write reservations with backup
async function writeReservations(reservations) {
  try {
    // Create backup of current file
    try {
      const currentData = await fs.readFile(RESERVATIONS_FILE, 'utf8');
      await fs.writeFile(BACKUP_FILE, currentData);
    } catch (error) {
      // Ignore if file doesn't exist yet
    }
    
    // Write new data
    await fs.writeFile(RESERVATIONS_FILE, JSON.stringify(reservations, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing reservations:', error);
    return false;
  }
}

// Load games data
async function loadGamesData() {
  try {
    const [gamesData, boardgamesData] = await Promise.all([
      fs.readFile(GAMES_FILE, 'utf8'),
      fs.readFile(BOARDGAMES_FILE, 'utf8')
    ]);
    
    return {
      games: JSON.parse(gamesData),
      boardgames: JSON.parse(boardgamesData)
    };
  } catch (error) {
    console.error('Error loading games data:', error);
    return { games: [], boardgames: [] };
  }
}

// Check videogame reservation limits (max 10 per date)
async function checkVideogameLimit(date) {
  const reservations = await readReservations();
  const videogameReservations = reservations.filter(r => {
    if (r.visit_date !== date) return false;
    return r.items.some(item => item.game_type === 'videogame');
  });
  
  return videogameReservations.length < 10;
}

// Check boardgame availability (based on copies)
async function checkBoardgameAvailability(date, items) {
  const reservations = await readReservations();
  const { boardgames } = await loadGamesData();
  
  // Count existing reservations for this date
  const boardgameReservations = reservations.filter(r => r.visit_date === date);
  
  for (const item of items) {
    if (item.game_type === 'boardgame') {
      const game = boardgames.find(g => g.id === item.game_id);
      if (!game) continue;
      
      const copies = game.copies || 1;
      const reservedCount = boardgameReservations.reduce((count, reservation) => {
        const hasGame = reservation.items.some(i => i.game_id === item.game_id && i.game_type === 'boardgame');
        return count + (hasGame ? 1 : 0);
      }, 0);
      
      if (reservedCount >= copies) {
        return { available: false, game: game.name };
      }
    }
  }
  
  return { available: true };
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get date availability
app.get('/api/dates/availability', async (req, res) => {
  try {
    const reservations = await readReservations();
    const availability = {};
    
    reservations.forEach(reservation => {
      if (reservation.visit_date) {
        availability[reservation.visit_date] = (availability[reservation.visit_date] || 0) + 1;
      }
    });
    
    res.json(availability);
  } catch (error) {
    console.error('Error getting date availability:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit new reservation
app.post('/api/cart/submit', async (req, res) => {
  try {
    const { items, name, email, controller, additionalInfo, date } = req.body;
    
    // Validation
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Name is required' });
    }
    
    // Check limits if date is provided
    if (date) {
      // Check videogame limit
      const hasVideogames = items.some(item => item.type === 'videogame');
      if (hasVideogames) {
        const videogameAllowed = await checkVideogameLimit(date);
        if (!videogameAllowed) {
          return res.status(400).json({ message: 'Maximum videogame reservations reached for this date' });
        }
      }
      
      // Check boardgame availability
      const boardgameItems = items.filter(item => item.type === 'boardgame').map(item => ({
        game_id: item.id,
        game_type: 'boardgame'
      }));
      
      if (boardgameItems.length > 0) {
        const boardgameCheck = await checkBoardgameAvailability(date, boardgameItems);
        if (!boardgameCheck.available) {
          return res.status(400).json({ 
            message: `Boardgame "${boardgameCheck.game}" is fully reserved for this date` 
          });
        }
      }
    }
    
    // Generate unique code
    const code = await generateUniqueCode();
    
    // Create reservation object
    const reservation = {
      id: Date.now(),
      code: code,
      name: name.trim(),
      email: email ? email.trim() : null,
      controller: controller || 'controller',
      additional_info: additionalInfo ? additionalInfo.trim() : null,
      visit_date: date || null,
      items: items.map(item => ({
        game_id: item.id,
        game_name: item.name,
        game_image: item.image,
        game_type: item.type
      })),
      item_count: items.length,
      created_at: new Date().toISOString(),
      updated_at: null
    };
    
    // Save reservation
    const reservations = await readReservations();
    reservations.push(reservation);
    const success = await writeReservations(reservations);
    
    if (!success) {
      return res.status(500).json({ message: 'Failed to save reservation' });
    }
    
    res.status(201).json({
      message: 'Reservation created successfully',
      code: code
    });
    
  } catch (error) {
    console.error('Error submitting reservation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get reservation by code
app.get('/api/cart/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const reservations = await readReservations();
    const reservation = reservations.find(r => r.code.toUpperCase() === code.toUpperCase());
    
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    
    res.json(reservation);
    
  } catch (error) {
    console.error('Error getting reservation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update reservation
app.put('/api/cart/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const { items, name, email, controller, additionalInfo, date } = req.body;
    
    const reservations = await readReservations();
    const index = reservations.findIndex(r => r.code.toUpperCase() === code.toUpperCase());
    
    if (index === -1) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    
    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Name is required' });
    }
    
    // Check limits if date is provided and changed
    if (date && date !== reservations[index].visit_date) {
      const hasVideogames = items.some(item => item.type === 'videogame');
      if (hasVideogames) {
        const videogameAllowed = await checkVideogameLimit(date);
        if (!videogameAllowed) {
          return res.status(400).json({ message: 'Maximum videogame reservations reached for this date' });
        }
      }
      
      const boardgameItems = items.filter(item => item.type === 'boardgame').map(item => ({
        game_id: item.id,
        game_type: 'boardgame'
      }));
      
      if (boardgameItems.length > 0) {
        const boardgameCheck = await checkBoardgameAvailability(date, boardgameItems);
        if (!boardgameCheck.available) {
          return res.status(400).json({ 
            message: `Boardgame "${boardgameCheck.game}" is fully reserved for this date` 
          });
        }
      }
    }
    
    // Update reservation
    reservations[index] = {
      ...reservations[index],
      name: name.trim(),
      email: email ? email.trim() : null,
      controller: controller || 'controller',
      additional_info: additionalInfo ? additionalInfo.trim() : null,
      visit_date: date || null,
      items: items.map(item => ({
        game_id: item.game_id || item.id,
        game_name: item.game_name || item.name,
        game_image: item.game_image || item.image,
        game_type: item.game_type || item.type
      })),
      item_count: items.length,
      updated_at: new Date().toISOString()
    };
    
    const success = await writeReservations(reservations);
    
    if (!success) {
      return res.status(500).json({ message: 'Failed to update reservation' });
    }
    
    res.json({
      message: 'Reservation updated successfully',
      code: code.toUpperCase()
    });
    
  } catch (error) {
    console.error('Error updating reservation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const credentials = JSON.parse(await fs.readFile(ADMIN_CREDENTIALS_FILE, 'utf8'));
    
    if (username === credentials.username && password === credentials.password) {
      res.json({ 
        message: 'Login successful',
        username: credentials.username 
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
    
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check admin session (simplified - no real session management)
app.get('/api/admin/check', async (req, res) => {
  // For simplicity, we're not implementing real sessions
  // In production, you'd want proper session management
  res.status(401).json({ message: 'Not authenticated' });
});

// Get all reservations (admin)
app.get('/api/admin/reservations', async (req, res) => {
  try {
    const reservations = await readReservations();
    res.json(reservations);
  } catch (error) {
    console.error('Error getting reservations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single reservation (admin)
app.get('/api/admin/reservations/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const reservations = await readReservations();
    const reservation = reservations.find(r => r.id === id);
    
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    
    res.json(reservation);
    
  } catch (error) {
    console.error('Error getting reservation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update reservation (admin)
app.put('/api/admin/reservations/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, email, controller, additionalInfo, date, items } = req.body;
    
    const reservations = await readReservations();
    const index = reservations.findIndex(r => r.id === id);
    
    if (index === -1) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    
    reservations[index] = {
      ...reservations[index],
      name: name.trim(),
      email: email ? email.trim() : null,
      controller: controller || 'controller',
      additional_info: additionalInfo ? additionalInfo.trim() : null,
      visit_date: date || null,
      items: items,
      item_count: items.length,
      updated_at: new Date().toISOString()
    };
    
    const success = await writeReservations(reservations);
    
    if (!success) {
      return res.status(500).json({ message: 'Failed to update reservation' });
    }
    
    res.json({ message: 'Reservation updated successfully' });
    
  } catch (error) {
    console.error('Error updating reservation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete reservation (admin)
app.delete('/api/admin/reservations/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const reservations = await readReservations();
    const filteredReservations = reservations.filter(r => r.id !== id);
    
    if (filteredReservations.length === reservations.length) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    
    const success = await writeReservations(filteredReservations);
    
    if (!success) {
      return res.status(500).json({ message: 'Failed to delete reservation' });
    }
    
    res.json({ message: 'Reservation deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting reservation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// Serve admin panel
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Start server
async function startServer() {
  await initializeFiles();
  
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
  });
}

startServer();