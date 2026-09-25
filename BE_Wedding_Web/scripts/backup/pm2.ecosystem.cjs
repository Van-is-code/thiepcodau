// Chạy watcher backup bằng pm2 (thay cho systemd).
//   pm2 start scripts/backup/pm2.ecosystem.cjs
//   pm2 save && pm2 startup
// Script tự đọc cấu hình từ THIEP_BACKUP_ENV (mặc định /etc/thiep-backup/backup.env).
module.exports = {
  apps: [
    {
      name: 'thiep-backup',
      script: '/opt/thiep-backup/thiep-backup',
      args: 'watch',
      interpreter: 'bash',
      autorestart: true,
      restart_delay: 15000,
      max_restarts: 50,
      env: {
        THIEP_BACKUP_ENV: '/etc/thiep-backup/backup.env'
      }
    }
  ]
};
// restic check hằng tuần (pm2 không có cron) -> thêm vào crontab:
//   30 4 * * 0  THIEP_BACKUP_ENV=/etc/thiep-backup/backup.env /opt/thiep-backup/thiep-backup check >> /var/log/thiep-backup-check.log 2>&1
