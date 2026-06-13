module.exports = {
  apps: [
    {
      name: 'heavenlydreams-app',
      script: 'server.ts',
      interpreter: 'tsx',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '512M',
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
