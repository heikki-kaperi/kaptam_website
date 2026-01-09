# Backend Setup Instructions

## 1. Initial Setup on Debian Server

### Install Node.js (if not already installed)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # Should show v20.x.x
```

### Clone/Upload Backend Files

```bash
# If using git
cd /path/to/your/project
git pull

# Or manually upload the 'backend' folder to your server
```

### Install Dependencies

```bash
cd backend
npm install
```

## 2. Copy Game Data Files

Copy your game JSON files to the data directory:

```bash
mkdir -p data
cp /path/to/games.json data/
cp /path/to/boardgames.json data/
```

## 3. Set Admin Credentials

Edit the admin credentials file (will be created on first run):

```bash
# Start the server once to create default files
npm start
# Press Ctrl+C to stop

# Now edit the credentials
nano data/admin-credentials.json
```

Change the default username/password:

```json
{
  "username": "your_admin_username",
  "password": "your_secure_password"
}
```

## 4. Test Locally

```bash
npm start
```

Visit:

- API: http://localhost:3000/api/health
- Admin: http://localhost:3000/admin

## 5. Run in Production

### Option A: Using PM2 (Recommended)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the application
pm2 start server.js --name kaptam-backend

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions shown

# View logs
pm2 logs kaptam-backend

# Stop/Restart
pm2 stop kaptam-backend
pm2 restart kaptam-backend
```

### Option B: Using systemd

Create `/etc/systemd/system/kaptam-backend.service`:

```ini
[Unit]
Description=Kaptam Reservation Backend
After=network.target

[Service]
Type=simple
User=your_username
WorkingDirectory=/path/to/backend
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=kaptam-backend

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable kaptam-backend
sudo systemctl start kaptam-backend
sudo systemctl status kaptam-backend
```

## 6. Configure Firewall

```bash
# Allow port 3000
sudo ufw allow 3000/tcp
```

## 7. Access Admin Panel

Visit: http://your-server-ip:3000/admin

Default credentials (change these!):

- Username: admin
- Password: changeme123

## Troubleshooting

### Check if server is running:

```bash
ps aux | grep node
```

### Check logs (if using PM2):

```bash
pm2 logs kaptam-backend
```

### Check port usage:

```bash
sudo netstat -tulpn | grep 3000
```

### Test API directly:

```bash
curl http://localhost:3000/api/health
```
