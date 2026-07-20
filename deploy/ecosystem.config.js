// Konfiguracja PM2 — uruchamia zbudowaną aplikację Next.js i utrzymuje ją
// przy życiu po restarcie serwera (pm2 startup + pm2 save).
module.exports = {
  apps: [
    {
      name: "frontline-pulse",
      cwd: "/var/www/frontline",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        DATABASE_URL: "postgres://frontline:ZMIEN_HASLO@localhost:5432/frontline",
      },
      max_memory_restart: "512M",
      autorestart: true,
    },
  ],
};
