module.exports = {
  apps: [
    {
      name: 'discord-bot',
      script: './dist/bot/index.js',
      env_production: {
        NODE_ENV: 'production'
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      max_memory_restart: '1G',
      exp_backoff_restart_delay: 100,
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      log_file: 'logs/combined.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
      merge_logs: true,
      instances: 1,
      exec_mode: 'fork',
      wait_ready: true,
      kill_timeout: 5000,
      listen_timeout: 10000,
      max_memory_restart: '256M',
      node_args: '--max-old-space-size=256'
    }
  ]
};