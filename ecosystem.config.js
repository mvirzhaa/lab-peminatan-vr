module.exports = {
  apps: [
    {
      name: 'lab-peminatan-vr',
      script: 'server.js',
      env: {
        PORT: 8080,
        NODE_ENV: 'production'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M'
    }
  ]
};
