/** PM2 进程配置 — 在服务器执行: pm2 start deploy/pm2.ecosystem.config.cjs */
/** 或复制到 C:\tapnowone\backend-nest\ 后: pm2 start pm2.ecosystem.config.cjs */

module.exports = {
  apps: [
    {
      name: 'tapnow-api',
      cwd: 'C:/tapnowone/node',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        // 国内服务器：本机代理端口，与 .env 中 GOOGLE_HTTP_PROXY 保持一致
        GOOGLE_HTTP_PROXY: 'http://127.0.0.1:7890',
      },
    },
  ],
};
