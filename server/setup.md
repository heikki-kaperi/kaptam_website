# Kaptam Reservation System - Setup Guide

## Prerequisites

- Node.js (v16 or higher)
- MariaDB/MySQL database server
- A server to host the application

## Step 1: Install MariaDB

### On Ubuntu/Debian:

```bash
sudo apt update
sudo apt install mariadb-server
sudo mysql_secure_installation
```

### On CentOS/RHEL:

```bash
sudo yum install mariadb-server
sudo systemctl start mariadb
sudo systemctl enable mariadb
sudo mysql_secure_installation
```

## Step 2: Create Database

Login to MariaDB:

```bash
sudo mysql -u root -p
```

Run the database setup script:

```sql
SOURCE /path/to/database.sql;
```

Or copy the contents of `database.sql` and paste into the MySQL prompt.

## Step 3: Create Database User

```sql
CREATE USER 'kaptam_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON kaptam_reservations.* TO 'kaptam_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## Step 4: Install Backend Dependencies

Navigate to your backend directory and install packages:

```bash
cd /path/to/backend
npm install
```

## Step 5: Configure Server

Edit `server.js` and update the database configuration:

```javascript
const dbConfig = {
  host: "localhost",
  user: "kaptam_user", // Change this
  password: "your_secure_password", // Change this
  database: "kaptam_reservations",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};
```

Also update the session secret:

```javascript
app.use(
  session({
    key: "kaptam_session",
    secret: "change-this-to-a-random-secret-key-in-production", // CHANGE THIS!
    // ...
  })
);
```

## Step 6: Create Admin User

The default admin credentials are:

- **Username:** admin
- **Password:** admin123

**IMPORTANT:** Change this password immediately!

### To create a new admin user:

1. Generate a password hash:

```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('your_new_password', 10, (err, hash) => console.log(hash));"
```

2. Insert into database:

```sql
USE kaptam_reservations;
INSERT INTO admin_users (username, password_hash) VALUES ('your_username', 'paste_hash_here');
```

Or delete the default admin and create a new one:

```sql
DELETE FROM admin_users WHERE username = 'admin';
```

## Step 7: Update Frontend API URLs

In your frontend JavaScript files, update the API_URL:

**checkout.js:**

```javascript
const response = await fetch("http://your-domain.com:3000/api/cart/submit", {
  // ...
});
```

**cart.js:**

```javascript
const response = await fetch("http://your-domain.com:3000/api/cart/submit", {
  // ...
});
```

**admin.js:**

```javascript
const API_URL = "http://your-domain.com:3000";
```

## Step 8: Start the Server

### Development mode (with auto-restart):

```bash
npm run dev
```

### Production mode:

```bash
npm start
```

## Step 9: Setup Process Manager (Production)

Use PM2 to keep the server running:

```bash
# Install PM2
sudo npm install -g pm2

# Start the server
pm2 start server.js --name kaptam-backend

# Make it start on system boot
pm2 startup
pm2 save
```

## Step 10: Configure CORS (if needed)

If your frontend is on a different domain, update CORS settings in `server.js`:

```javascript
app.use(
  cors({
    origin: "https://your-frontend-domain.com",
    credentials: true,
  })
);
```

## Step 11: Access Admin Panel

Navigate to: `http://your-domain.com/varasto.html`

Login with your admin credentials.

## Security Recommendations

1. **Change default admin password immediately**
2. **Use strong, unique passwords**
3. **Enable HTTPS in production** (update `secure: true` in session config)
4. **Set up a firewall** to restrict database access
5. **Keep Node.js and packages updated**
6. **Use environment variables** for sensitive data (see below)

## Using Environment Variables (Recommended)

Create a `.env` file:

```
DB_HOST=localhost
DB_USER=kaptam_user
DB_PASSWORD=your_secure_password
DB_NAME=kaptam_reservations
SESSION_SECRET=your_random_secret_here
PORT=3000
```

Install dotenv:

```bash
npm install dotenv
```

Update `server.js`:

```javascript
require("dotenv").config();

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // ...
};

const PORT = process.env.PORT || 3000;
```

## Troubleshooting

### Cannot connect to database:

- Check MariaDB is running: `sudo systemctl status mariadb`
- Verify database credentials
- Check firewall settings

### CORS errors:

- Update CORS origin in server.js to match your frontend URL
- Make sure credentials: true is set on both server and client

### Session not persisting:

- Check that cookies are enabled
- Verify session store is working: `SELECT * FROM sessions;`

### Port already in use:

- Change PORT in server.js or kill the process using that port

## Backup Database

Regular backups are important:

```bash
mysqldump -u kaptam_user -p kaptam_reservations > backup_$(date +%Y%m%d).sql
```

## Support

For issues, contact the developers:

- Kyouma960: https://github.com/Kyouma960
- heikki-kaperi: https://github.com/heikki-kaperi
