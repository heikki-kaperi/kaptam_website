/**
 * PM2 Ecosystem Configuration
 * Used to manage the Kaptam Reservation Server with PM2
 */

module.exports = {
  apps: [
    {
      name: 'kaptam-server',
      script: './server.js',

      // Environment
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000
      },

      // Process management
      instances: 1,
      exec_mode: 'fork',

      // Auto-restart on crash
      autorestart: true,
      watch: false, // Set to true in development if you want auto-reload on file changes

      // Restart if memory exceeds 500MB
      max_memory_restart: '500M',

      // Logging
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,

      // Log rotation
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Restart delay
      restart_delay: 4000,

      // Kill timeout
      kill_timeout: 5000,

      // Wait for server to be ready before marking as online
      wait_ready: false,

      // Listen timeout
      listen_timeout: 10000,

      // Cron restart (optional - restart every day at 4 AM)
      // cron_restart: '0 4 * * *',

      // Maximum number of restarts within 1 minute before stopping
      min_uptime: 10000,
      max_restarts: 10,

      // Environment variables file
      env_file: '.env'
    }
  ],

  // PM2 deploy configuration (optional)
  deploy: {
    production: {
      user: 'root',
      host: '206.81.19.97',
      ref: 'origin/main',
      repo: 'https://github.com/YOUR_USERNAME/YOUR_REPO.git',
      path: '/root/kaptam-server',
      'post-deploy': 'cd server && npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};
