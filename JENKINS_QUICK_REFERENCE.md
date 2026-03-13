# Jenkins CI/CD - Quick Reference

## 🚀 Deployment Commands

### Manual Deployment (Local)

```bash
# Deploy to development
./deploy.sh development

# Deploy to staging
./deploy.sh staging

# Deploy to production
./deploy.sh production
```

### Check Status

```bash
./check-status.sh
```

### Cleanup Docker Resources

```bash
./cleanup-docker.sh
```

## 🔧 Jenkins Setup Commands

### Start Jenkins

```bash
# MacOS
brew services start jenkins-lts

# Linux
sudo systemctl start jenkins
```

### Stop Jenkins

```bash
# MacOS
brew services stop jenkins-lts

# Linux
sudo systemctl stop jenkins
```

### Restart Jenkins

```bash
# MacOS
brew services restart jenkins-lts

# Linux
sudo systemctl restart jenkins
```

### Access Jenkins

```
http://localhost:8080
```

### Get Initial Admin Password

```bash
# MacOS
cat ~/.jenkins/secrets/initialAdminPassword

# Linux
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

## 📦 Docker Commands

### View Running Containers

```bash
docker ps
```

### View Logs

```bash
# Development
docker logs -f toko-kopi-maru-dev

# Staging
docker logs -f toko-kopi-maru-staging

# Production
docker logs -f toko-kopi-maru-prod
```

### Stop Environment

```bash
docker-compose -f docker-compose.development.yml down
docker-compose -f docker-compose.staging.yml down
docker-compose -f docker-compose.production.yml down
```

### Rebuild and Restart

```bash
# Development
docker-compose -f docker-compose.development.yml up -d --build

# Staging
docker-compose -f docker-compose.staging.yml up -d --build

# Production
docker-compose -f docker-compose.production.yml up -d --build
```

## 🔍 Health Checks

### Check Application Health

```bash
# Development
curl http://localhost:3000/api/health

# Staging
curl http://localhost:3001/api/health

# Production
curl http://localhost:3002/api/health
```

### Check Database Connection

```bash
# Development
docker exec -it toko-kopi-db-dev psql -U postgres -d toko_kopi_dev -c "SELECT 1;"

# Staging
docker exec -it toko-kopi-db-staging psql -U postgres -d toko_kopi_staging -c "SELECT 1;"

# Production
docker exec -it toko-kopi-db-prod psql -U postgres -d toko_kopi_prod -c "SELECT 1;"
```

## 🌿 Git Workflow

### Development

```bash
git checkout development
git pull origin development
# Make changes
git add .
git commit -m "feat: your feature"
git push origin development
# Jenkins will auto-deploy
```

### Staging

```bash
git checkout staging
git merge development
git push origin staging
# Jenkins will auto-deploy
```

### Production

```bash
git checkout production
git merge staging
git push origin production
# Jenkins will auto-deploy
```

## 🐛 Troubleshooting

### Pipeline Failed - View Console

1. Go to Jenkins dashboard
2. Click on job (toko-kopi-maru)
3. Click on branch (development/staging/production)
4. Click on failed build number
5. Click "Console Output"

### Container Not Starting

```bash
# Check logs
docker logs toko-kopi-maru-{env}

# Check if port is in use
lsof -i :3000  # or 3001, 3002

# Restart container
docker restart toko-kopi-maru-{env}
```

### Build Fails Locally

```bash
# Clean install
rm -rf node_modules
npm ci

# Run checks
npm run lint
npx tsc --noEmit
npm run build
```

### Database Issues

```bash
# Reset database
docker-compose -f docker-compose.development.yml down -v
docker-compose -f docker-compose.development.yml up -d

# Run migrations
npx prisma migrate dev
```

### Disk Space Full

```bash
# Quick cleanup
./cleanup-docker.sh

# OR manual
docker system prune -a -f --volumes
```

## 📊 Monitoring

### View Resource Usage

```bash
# Docker stats
docker stats

# Disk usage
docker system df
```

### View Build History

```bash
# In Jenkins UI
Dashboard → toko-kopi-maru → {branch} → Build History
```

## 🔐 Security

### Update Environment Variables

```bash
# Edit environment file
nano .env.{environment}

# Restart containers
docker-compose -f docker-compose.{environment}.yml restart
```

### Rotate Secrets

1. Update `.env.{environment}` files
2. Update Jenkins credentials
3. Redeploy: `./deploy.sh {environment}`

## 📝 Useful Aliases (Optional)

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
# Jenkins
alias jenkins-start='brew services start jenkins-lts'
alias jenkins-stop='brew services stop jenkins-lts'
alias jenkins-restart='brew services restart jenkins-lts'

# Toko Kopi
alias tk-deploy-dev='./deploy.sh development'
alias tk-deploy-stag='./deploy.sh staging'
alias tk-deploy-prod='./deploy.sh production'
alias tk-status='./check-status.sh'
alias tk-cleanup='./cleanup-docker.sh'

# Docker logs
alias tk-logs-dev='docker logs -f toko-kopi-maru-dev'
alias tk-logs-stag='docker logs -f toko-kopi-maru-staging'
alias tk-logs-prod='docker logs -f toko-kopi-maru-prod'
```

---

**For detailed information, see:** [JENKINS_SETUP.md](./JENKINS_SETUP.md)
