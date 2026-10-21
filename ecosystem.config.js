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
        SFU_PORT: 44444,
        SFU_ANNOUNCED_IP: '103.158.196.135',
        PUBLIC_DOMAIN: 'vr.ti.fts.uika-bogor.ac.id',
        ADMIN_KEY: 'GANTI-DENGAN-KUNCI-RAHASIA',
        PEMINATAN_USER: 'admin',
        PEMINATAN_PASS: 'GANTI-DENGAN-PASSWORD-ADMIN-PEMINATAN'
      },
      env_production: {
        PORT: 8080,
        NODE_ENV: 'production',
        SFU_PORT: 44444,
        SFU_ANNOUNCED_IP: '103.158.196.135',
        PUBLIC_DOMAIN: 'vr.ti.fts.uika-bogor.ac.id',
        ADMIN_KEY: 'GANTI-DENGAN-KUNCI-RAHASIA',
        PEMINATAN_USER: 'admin',
        PEMINATAN_PASS: 'GANTI-DENGAN-PASSWORD-ADMIN-PEMINATAN'
      }
    }
  ]
};
