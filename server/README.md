# Kaptam Reservation System - Backend

Game reservation system backend for Kaptam Gamers ry with SQLite database, email notifications, and admin dashboard.

## Features

- **Reservation Management**: Create, update, and retrieve game reservations
- **Email Notifications**: Automatic emails to admin and customers via Gmail SMTP
- **Date Availability Tracking**: Monitor reservations per date with configurable limits
- **Admin Dashboard**: JWT-authenticated admin API for managing reservations
- **Rate Limiting**: Protect against abuse with request rate limiting
- **CORS Protection**: Secure cross-origin requests in production
- **Database Cleanup**: Automatic removal of old reservations

## Tech Stack

- **Node.js** (v16+)
- **Express** - Web framework
- **better-sqlite3** - SQLite database
- **nodemailer** - Email sending
- **JWT** - Admin authentication
- **bcrypt** - Password hashing
- **PM2** - Process management (recommended)

---

## Initial Setup (Local Development)

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and configure:
- Gmail credentials (for email notifications)
- Server settings
- Admin credentials will be generated in step 3

### 3. Set Up Admin Credentials

Run the setup script to create admin username and password:

```bash
npm run setup-admin
```

This will:
- Prompt for admin username (default: admin)
- Prompt for password (min 8 characters)
- Generate secure password hash
- Generate JWT secret
- Update your `.env` file automatically

### 4. Start the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will run on `http://localhost:3000`

---

## Deployment to DigitalOcean (Debian 13)

### Prerequisites

- DigitalOcean Droplet: **512 MB Memory / 10 GB Disk / FRA1 - Debian 13 x64**
- Server IP: **206.81.19.97**
- Domain: **kaptam.fi** (pointed to server IP)
- SSH access to server

### Step 1: Connect to Server

```bash
ssh root@206.81.19.97
```

### Step 2: Install Node.js

```bash
# Update system
apt update && apt upgrade -y

# Install curl
apt install -y curl

# Install Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verify installation
node --version
npm --version
```

### Step 3: Install PM2 Globally

```bash
npm install -g pm2
```

### Step 4: Set Up Project Directory

```bash
# Create project directory
mkdir -p /root/kaptam
cd /root/kaptam

# Clone your repository (replace with your GitHub repo)
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git .

# Or if you're using password authentication
# You'll be prompted for credentials
```

### Step 5: Install Dependencies

```bash
cd server
npm install --production
```

### Step 6: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit environment file
nano .env
```

**Important settings for production:**

```bash
# Gmail SMTP
GMAIL_USER=kaptamgamers@gmail.com
GMAIL_APP_PASSWORD=your-app-password-here

# Server
PORT=3000
NODE_ENV=production

# URLs
SITE_URL=https://kaptam.fi
API_URL=http://localhost:3000

# Admin credentials (will be generated next)
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=<will be generated>
JWT_SECRET=<will be generated>

# Database
DB_PATH=./data/reservations.db

# Limits
MAX_RESERVATIONS_PER_DATE=6
MAX_ITEMS_PER_RESERVATION=20
RESERVATION_RETENTION_DAYS=60
```

Save and exit: `Ctrl+X`, then `Y`, then `Enter`

### Step 7: Set Up Admin Credentials

```bash
npm run setup-admin
```

Follow the prompts to create admin credentials.

### Step 8: Start Server with PM2

```bash
# Start server using PM2 ecosystem config
pm2 start ecosystem.config.js --env production

# Save PM2 process list
pm2 save

# Set up PM2 to start on system boot
pm2 startup
# Copy and run the command that PM2 outputs
```

### Step 9: Verify Server is Running

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs kaptam-server

# Monitor
pm2 monit
```

Test the API:
```bash
curl http://localhost:3000/api/health
```

Should return:
```json
{"status":"ok","timestamp":"...","environment":"production"}
```

---

## PM2 Commands

```bash
# View status
pm2 status

# View logs (real-time)
pm2 logs kaptam-server

# View only errors
pm2 logs kaptam-server --err

# Restart server
pm2 restart kaptam-server

# Stop server
pm2 stop kaptam-server

# Delete from PM2
pm2 delete kaptam-server

# Monitor (dashboard)
pm2 monit

# View info
pm2 info kaptam-server
```

---

## Updating the Server

When you push changes to GitHub:

```bash
# Connect to server
ssh root@206.81.19.97

# Navigate to project
cd /root/kaptam

# Pull latest changes
git pull origin main

# Update dependencies if package.json changed
cd server
npm install --production

# Restart server
pm2 restart kaptam-server

# View logs to ensure it started correctly
pm2 logs kaptam-server --lines 50
```

---

## Setting Up Gmail App Password

1. Go to your Google Account: https://myaccount.google.com/
2. Select **Security**
3. Under "How you sign in to Google," select **2-Step Verification**
4. At the bottom, select **App passwords**
5. Enter a name (e.g., "Kaptam Server")
6. Click **Create**
7. Copy the 16-character password
8. Add it to your `.env` file as `GMAIL_APP_PASSWORD`

---

## API Endpoints

### Public Endpoints

- `GET /api/health` - Health check
- `GET /api/dates/availability` - Get reservation count by date
- `POST /api/cart/submit` - Create new reservation
- `GET /api/cart/:code` - Get reservation by code
- `PUT /api/cart/:code` - Update reservation

### Admin Endpoints (Require JWT Token)

- `POST /api/admin/login` - Login and get token
- `POST /api/admin/verify` - Verify token validity
- `GET /api/admin/reservations` - List all reservations
- `GET /api/admin/reservations/:code` - Get specific reservation
- `DELETE /api/admin/reservations/:code` - Delete reservation
- `GET /api/admin/statistics` - Get statistics

### Admin Authentication

1. Login to get token:
```bash
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
```

2. Use token in requests:
```bash
curl http://localhost:3000/api/admin/reservations \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Database Management

### Backup Database

```bash
# Create backup
cp /root/kaptam/server/data/reservations.db /root/backups/reservations-$(date +%Y%m%d).db

# Or set up automatic daily backups with cron
crontab -e
# Add line:
# 0 2 * * * cp /root/kaptam/server/data/reservations.db /root/backups/reservations-$(date +\%Y\%m\%d).db
```

### View Database

```bash
# Install sqlite3
apt install sqlite3

# Open database
sqlite3 /root/kaptam/server/data/reservations.db

# View tables
.tables

# View all reservations
SELECT * FROM reservations;

# Exit
.quit
```

---

## Troubleshooting

### Server Won't Start

```bash
# Check PM2 logs
pm2 logs kaptam-server --err

# Check if port 3000 is in use
lsof -i :3000

# Kill process using port
kill -9 <PID>
```

### Email Not Sending

- Verify Gmail credentials in `.env`
- Ensure Gmail App Password is correct (not regular password)
- Check Gmail account has 2FA enabled
- Check server logs: `pm2 logs kaptam-server`

### CORS Errors

- Ensure `SITE_URL` in `.env` matches your domain
- Check `NODE_ENV=production` is set
- Verify domain is in allowed origins list in `server.js`

### Database Errors

```bash
# Check if database exists
ls -la /root/kaptam/server/data/

# Check permissions
chmod 755 /root/kaptam/server/data/
chmod 644 /root/kaptam/server/data/reservations.db
```

### Can't Access Admin Dashboard

```bash
# Re-run admin setup
cd /root/kaptam/server
npm run setup-admin

# Restart server
pm2 restart kaptam-server
```

---

## Security Best Practices

1. **Never commit `.env` file** - It's in `.gitignore`
2. **Use strong admin password** - Minimum 12 characters
3. **Keep dependencies updated** - Run `npm audit` regularly
4. **Set up firewall**:
   ```bash
   apt install ufw
   ufw allow ssh
   ufw allow http
   ufw allow https
   ufw enable
   ```
5. **Use HTTPS** - Set up SSL certificate with Let's Encrypt
6. **Regular backups** - Automate database backups
7. **Monitor logs** - Check PM2 logs regularly

---

## Performance Tuning

For 512MB RAM server:

```bash
# Limit Node.js memory
# In ecosystem.config.js, already set to max_memory_restart: '500M'

# Monitor memory usage
pm2 monit

# If server crashes due to memory
# Increase swap space:
fallocate -l 1G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
```

---

## Support

- **Issues**: Check logs with `pm2 logs kaptam-server`
- **Email**: kaptamgamers@gmail.com
- **Location**: Mukkulankatu 19, 15210 Lahti

---

## License

ISC - Kaptam Gamers ry
