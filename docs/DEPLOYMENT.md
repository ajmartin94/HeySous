# Deployment Guide

Deploy HeySous to a DigitalOcean droplet with PM2, nginx, and Let's Encrypt. Targets 2-5 beta testers.

## Prerequisites

- A domain or subdomain (required -- Telegram Mini Apps need HTTPS)
- A DigitalOcean account ([sign up with $200 credit](https://www.digitalocean.com))
- SSH key pair on your local machine

## 1. Create Droplet

1. Log into DigitalOcean, click **Create > Droplets**
2. **Region:** Choose one close to your users
3. **Image:** Ubuntu 24.04 LTS
4. **Size:** Basic, Regular, $6/mo (1 vCPU, 1 GB RAM, 25 GB disk)
5. **Authentication:** SSH key (add your public key)
6. **Hostname:** `heysous`
7. Click **Create Droplet** and note the IP address

## 2. Initial Server Setup

```bash
# SSH in as root
ssh root@YOUR_DROPLET_IP

# Create a non-root user
adduser heysous
usermod -aG sudo heysous

# Set up SSH for the new user
mkdir -p /home/heysous/.ssh
cp ~/.ssh/authorized_keys /home/heysous/.ssh/
chown -R heysous:heysous /home/heysous/.ssh

# Enable firewall
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable

# Disable root login
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh

# Log out and reconnect as heysous
exit
```

```bash
ssh heysous@YOUR_DROPLET_IP
```

## 3. Install Dependencies

```bash
# Node.js 22 (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version  # should be >= 22

# PM2 (process manager)
sudo npm install -g pm2

# nginx
sudo apt-get install -y nginx

# certbot (Let's Encrypt SSL)
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
```

## 4. Domain Setup

Point your domain's DNS A record to the droplet IP:

```
Type: A
Name: sous (or @ for root domain)
Value: YOUR_DROPLET_IP
TTL: 300
```

Wait for DNS propagation (usually 1-5 minutes). Verify:

```bash
dig +short your-domain.com
```

## 5. Clone and Build

```bash
cd ~
git clone <repo-url> heysous
cd heysous

npm install
cd mini-app && npm install && cd ..

npm run build:all
```

## 6. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with production values:

```bash
BOT_TOKEN=your_telegram_bot_token
BOT_MODE=webhook
PORT=3000
WEBHOOK_URL=https://your-domain.com
DB_FILE_NAME=data/heysous.db
LOG_LEVEL=info
NODE_ENV=production

ANTHROPIC_API_KEY=your_api_key
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
ADMIN_USER_IDS=your_telegram_numeric_id
MINI_APP_URL=https://your-domain.com/app
```

Create the data directory (SQLite auto-creates the file, but the directory must exist):

```bash
mkdir -p data
```

## 7. PM2 Process Management

Create `ecosystem.config.cjs` in the project root:

```js
module.exports = {
  apps: [{
    name: 'heysous',
    script: 'dist/main.js',
    env: {
      NODE_ENV: 'production',
    },
    max_memory_restart: '256M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
```

Start and configure auto-restart:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
# Run the command it outputs (sudo env PATH=... pm2 startup ...)
```

Verify it's running:

```bash
pm2 status
pm2 logs heysous --lines 20
```

## 8. nginx Reverse Proxy

Create the nginx config:

```bash
sudo nano /etc/nginx/sites-available/heysous
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/heysous /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 9. SSL Certificate

```bash
sudo certbot --nginx -d your-domain.com
```

Certbot will auto-configure nginx for HTTPS and set up auto-renewal.

Verify renewal works:

```bash
sudo certbot renew --dry-run
```

## 10. Verify

1. **Health check:** `curl https://your-domain.com/health` should return `ok`
2. **Bot:** Send `/start` to your bot on Telegram
3. **Mini App:** Open the bot menu button -- the Mini App hub should load
4. **Webhook:** `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo` should show `url` set and `pending_update_count: 0`
5. **Logs:** `pm2 logs heysous` should show clean startup

## Maintenance

### Deploying Updates

```bash
cd ~/heysous
git pull
npm run build:all
pm2 restart heysous
```

### Database Backups

SQLite makes backups trivial. Set up a daily cron:

```bash
mkdir -p ~/backups
crontab -e
```

Add:

```
0 3 * * * cp ~/heysous/data/heysous.db ~/backups/heysous-$(date +\%F).db
0 4 * * * find ~/backups -name "heysous-*.db" -mtime +14 -delete
```

This keeps 14 days of daily backups.

For off-site backups, install `rclone` and sync to DigitalOcean Spaces or S3:

```bash
rclone copy ~/backups spaces:your-bucket/heysous-backups/
```

### Monitoring

```bash
pm2 monit           # Real-time CPU/memory
pm2 logs heysous    # Application logs
pm2 status          # Process status
```

The bot also has built-in admin commands:
- `/costs` -- View API usage costs
- `/debug` -- View retrieval stats

### Inviting Beta Testers

1. Message the bot and run `/invite`
2. Choose "household" (shared data) or "independent" (separate data)
3. Send the invite link to your tester
4. They click the link, which opens Telegram and starts onboarding

### Troubleshooting

| Symptom | Check |
|---------|-------|
| Bot not responding | `pm2 logs heysous`, `pm2 status` |
| 502 Bad Gateway | Is the process running? `pm2 restart heysous` |
| Mini App blank page | Was `npm run build:app` run? Check `/app/` in browser |
| Webhook errors | `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo` |
| SSL certificate expired | `sudo certbot renew` |
| Database locked | Check for orphaned processes: `fuser data/heysous.db` |
