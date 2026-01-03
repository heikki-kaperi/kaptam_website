# Deployment Checklist

Quick reference guide for deploying to DigitalOcean server.

## Pre-Deployment Checklist

- [ ] Gmail App Password created
- [ ] Domain DNS pointed to server IP (206.81.19.97)
- [ ] SSH access to server confirmed
- [ ] GitHub repository set up and code pushed

---

## Deployment Steps

### 1. Connect to Server
```bash
ssh root@206.81.19.97
```

### 2. Install Node.js & PM2
```bash
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
npm install -g pm2
```

### 3. Clone Repository
```bash
mkdir -p /root/kaptam
cd /root/kaptam
git clone YOUR_GITHUB_REPO_URL .
```

### 4. Install Server Dependencies
```bash
cd server
npm install --production
```

### 5. Configure Environment
```bash
cp .env.example .env
nano .env
```

**Required settings:**
```bash
GMAIL_USER=kaptamgamers@gmail.com
GMAIL_APP_PASSWORD=your-16-char-password

PORT=3000
NODE_ENV=production

SITE_URL=https://kaptam.fi
API_URL=http://localhost:3000

DB_PATH=./data/reservations.db
MAX_RESERVATIONS_PER_DATE=6
MAX_ITEMS_PER_RESERVATION=20
RESERVATION_RETENTION_DAYS=60
```

Save with: `Ctrl+X` → `Y` → `Enter`

### 6. Set Up Admin Credentials
```bash
npm run setup-admin
```

Follow prompts:
- Username: `admin` (or custom)
- Password: Min 8 characters
- Confirm password

### 7. Start Server with PM2
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
# Copy and run the command PM2 outputs
```

### 8. Verify Server
```bash
pm2 status
pm2 logs kaptam-server
curl http://localhost:3000/api/health
```

Expected response:
```json
{"status":"ok","timestamp":"...","environment":"production"}
```

---

## Post-Deployment

### Test from Frontend
1. Open browser to https://kaptam.fi
2. Open Developer Console (F12)
3. Check for: `[Kaptam] Environment: Production`
4. Try creating a test reservation

### Monitor Logs
```bash
pm2 logs kaptam-server --lines 100
```

### Check Database
```bash
ls -la /root/kaptam/server/data/
```

---

## Updating Server After Code Changes

```bash
ssh root@206.81.19.97
cd /root/kaptam
git pull origin main
cd server
npm install --production  # Only if package.json changed
pm2 restart kaptam-server
pm2 logs kaptam-server --lines 50
```

---

## Common PM2 Commands

```bash
pm2 status                    # View status
pm2 logs kaptam-server        # View logs (live)
pm2 restart kaptam-server     # Restart server
pm2 stop kaptam-server        # Stop server
pm2 monit                     # Monitor dashboard
pm2 info kaptam-server        # Detailed info
```

---

## Troubleshooting

### Server won't start
```bash
pm2 logs kaptam-server --err
lsof -i :3000  # Check if port is in use
```

### Email not sending
- Check `.env` has correct Gmail credentials
- Verify Gmail App Password (not regular password)
- Check Gmail 2FA is enabled

### CORS errors
- Ensure `SITE_URL=https://kaptam.fi` in `.env`
- Verify `NODE_ENV=production`

### Database errors
```bash
ls -la /root/kaptam/server/data/
chmod 755 /root/kaptam/server/data/
chmod 644 /root/kaptam/server/data/reservations.db
```

---

## Admin API Testing

### Login
```bash
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_PASSWORD"}'
```

Copy the `token` from response.

### Get All Reservations
```bash
curl http://localhost:3000/api/admin/reservations \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Get Statistics
```bash
curl http://localhost:3000/api/admin/statistics \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Security Notes

✅ **Do This:**
- Keep `.env` file secure
- Use strong admin password (12+ chars)
- Set up firewall (ufw)
- Enable SSL/HTTPS with Let's Encrypt
- Regular backups of database
- Monitor PM2 logs regularly

❌ **Don't Do This:**
- Never commit `.env` to GitHub
- Don't use weak passwords
- Don't expose database file publicly
- Don't ignore security updates

---

## Backup Database

```bash
# Manual backup
cp /root/kaptam/server/data/reservations.db \
   /root/backups/reservations-$(date +%Y%m%d).db

# Automatic daily backup (2 AM)
crontab -e
# Add line:
0 2 * * * cp /root/kaptam/server/data/reservations.db /root/backups/reservations-$(date +\%Y\%m\%d).db
```

---

## Support

- **Logs**: `pm2 logs kaptam-server`
- **Status**: `pm2 status`
- **Monitor**: `pm2 monit`
- **Full README**: See README.md for detailed documentation

---

**Server IP**: 206.81.19.97
**Domain**: kaptam.fi
**Server**: Debian 13 x64 / 512MB RAM / 10GB SSD / FRA1
