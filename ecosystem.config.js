module.exports = {
  apps: [
    {
      name: 'lab-peminatan-vr',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        PORT: 8080,
        NODE_ENV: 'production',
        ADMIN_KEY: 'GANTI-DENGAN-KUNCI-RAHASIA'
      },
      env_production: {
        PORT: 8080,
        NODE_ENV: 'production',
        ADMIN_KEY: 'GANTI-DENGAN-KUNCI-RAHASIA'
      }
    }
  ]
};
