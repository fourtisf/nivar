# NIVAR — VPS deploy runbook (nivar.fun)

Target: Hostinger VPS `187.77.120.136` (`srv1728105`), PM2 + Nginx (handoff §2).
Run every command in **your own SSH session** on the server.

> **Reality check before you start**
> - The **web app is the playable game** and is what makes `nivar.fun` live. It is
>   self-contained (no DB) and verified pixel-identical to the prototype.
> - The **api** is built + tested but (1) the frontend isn't wired to it yet
>   (milestones 2–7) and (2) it currently uses an **in-memory store** — data resets
>   on restart until the Prisma store (schema is ready) is implemented, and SIWS
>   login needs a real ed25519 verifier (milestone 8). Deploying it now is optional
>   "preview" infra; it won't change the live game yet. Web-first is recommended.

---

## 0. Prerequisites (install once)

```bash
node -v        # need Node 20+. If older: use nvm or NodeSource.
pm2 -v         # already installed (you used it)
nginx -v       # sudo apt install -y nginx   (if missing)
git --version  # sudo apt install -y git      (if missing)
```

## 1. Remove the old `randlands-server`  ⚠️ permanent

You chose to delete it permanently. Find where it lives first, then remove it:

```bash
pm2 describe randlands-server | grep -E "script path|exec cwd"   # note its folder
pm2 delete randlands-server
pm2 save

# (optional 5-second insurance before deleting files — skip if you're sure)
# tar czf /root/randlands-backup-$(date +%F).tar.gz /path/to/randlands

rm -rf /path/to/randlands        # <-- the folder from `pm2 describe` above
```

## 2. Point the domain `nivar.fun` → this server

At your DNS provider (where `nivar.fun` is registered), set:

| Type | Name | Value            | TTL |
|------|------|------------------|-----|
| A    | `@`  | `187.77.120.136` | 300 |
| A    | `www`| `187.77.120.136` | 300 |

Check propagation: `dig +short nivar.fun` should return `187.77.120.136`.

## 3. Deploy the app

```bash
# Clone + build + start (web on :3000, api on :4000)
sudo APP_DIR=/var/www/nivar BRANCH=claude/new-session-x1npk7 bash <(curl -fsSL \
  https://raw.githubusercontent.com/fourtisf/nivar/claude/new-session-x1npk7/deploy/deploy.sh) \
  2>/dev/null || {
    # if the one-liner above can't fetch, clone manually then run the script:
    git clone -b claude/new-session-x1npk7 https://github.com/fourtisf/nivar.git /var/www/nivar
    cd /var/www/nivar && sudo BRANCH=claude/new-session-x1npk7 bash deploy/deploy.sh
  }

pm2 status        # nivar-web should be "online"
curl -s localhost:3000 | head -c 200   # should return NIVAR HTML
```

> Use `BRANCH=main` once this branch is merged to `main`.
> If `npm install` fails on the Prisma engine download, re-run with `--ignore-scripts`
> (web doesn't need Prisma): `cd /var/www/nivar && npm install --ignore-scripts && bash deploy/deploy.sh`.

## 4. Nginx + HTTPS

```bash
sudo cp /var/www/nivar/deploy/nginx/nivar.fun.conf /etc/nginx/sites-available/nivar.fun
sudo ln -sf /etc/nginx/sites-available/nivar.fun /etc/nginx/sites-enabled/nivar.fun
sudo rm -f /etc/nginx/sites-enabled/default        # if the default site is in the way
sudo nginx -t && sudo systemctl reload nginx

# TLS (after DNS from step 2 resolves):
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d nivar.fun -d www.nivar.fun
```

Open **https://nivar.fun** — the game should load. ✅ (Web deploy done.)

---

## 5. (Optional) Full-stack: Postgres + Redis + api

Only needed for the server-authoritative backend. The frontend doesn't call it yet.

```bash
sudo apt install -y postgresql redis-server
sudo -u postgres psql -c "CREATE USER nivar WITH PASSWORD 'STRONG_PW';"
sudo -u postgres psql -c "CREATE DATABASE nivar OWNER nivar;"

# Strong secrets (api refuses to boot in prod without JWT_SECRET):
export JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")"
export DATABASE_URL="postgresql://nivar:STRONG_PW@localhost:5432/nivar?schema=public"
export REDIS_URL="redis://localhost:6379"

cd /var/www/nivar
npm run prisma:generate
npm run migrate:deploy --workspace @nivar/prisma   # creates tables from schema.prisma
pm2 startOrReload deploy/ecosystem.config.cjs --update-env && pm2 save

curl -s localhost:4000/health    # {"ok":true,"service":"nivar-api"}
```

> Until the Prisma `Store` impl + an ed25519 SIWS verifier land, the api runs with
> in-memory state and SIWS login returns 500 in prod. `/health` works. This is the
> milestone 8–9 work, not a deploy blocker for the playable game.

## Updating later

```bash
cd /var/www/nivar && sudo BRANCH=claude/new-session-x1npk7 bash deploy/deploy.sh
```
