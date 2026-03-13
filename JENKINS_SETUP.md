# Jenkins CI/CD Automation - Toko Kopi Maru

Dokumentasi lengkap untuk setup dan menggunakan Jenkins automation deployment untuk Toko Kopi Maru.

## 📋 Overview

Pipeline Jenkins ini menyediakan:

- ✅ **Multi-branch Deployment**: Development, Staging, Production
- ✅ **Code Quality Checks**: ESLint, TypeScript, Security Audit
- ✅ **Docker Build & Deploy**: Automated containerization
- ✅ **Prune Build**: Automatic cleanup untuk menghemat disk space
- ✅ **Health Checks**: Verificasi deployment berhasil

## 🏗️ Arsitektur

```
GitHub Repository
    ├── branch: development  → Deploy ke dev.toko-kopi-maru.com
    ├── branch: staging      → Deploy ke staging.toko-kopi-maru.com
    └── branch: production   → Deploy ke toko-kopi-maru.com
```

## 🚀 Quick Start

### 1. Persiapan GitHub Repository

```bash
# Buat branches yang diperlukan
git checkout -b development
git push -u origin development

git checkout -b staging
git push -u origin staging

git checkout -b production
git push -u origin production
```

### 2. Setup Jenkins

#### Prerequisites

- Jenkins server dengan plugins berikut:
  - Docker Pipeline
  - GitHub plugin
  - Pipeline plugin
  - Multibranch Pipeline

#### Install Jenkins (jika belum ada)

**MacOS:**

```bash
brew install jenkins-lts
brew services start jenkins-lts
```

**Linux:**

```bash
wget -q -O - https://pkg.jenkins.io/debian-stable/jenkins.io.key | sudo apt-key add -
sudo sh -c 'echo deb https://pkg.jenkins.io/debian-stable binary/ > /etc/apt/sources.list.d/jenkins.list'
sudo apt update
sudo apt install jenkins
sudo systemctl start jenkins
```

**Akses Jenkins**: http://localhost:8080

#### Konfigurasi Jenkins

1. **Install Required Plugins**
   - Dashboard → Manage Jenkins → Manage Plugins
   - Install: Docker Pipeline, GitHub, Multibranch Pipeline

2. **Configure GitHub Credentials**
   - Dashboard → Manage Jenkins → Manage Credentials
   - Add GitHub token dengan scope: `repo`, `admin:repo_hook`

3. **Create Multibranch Pipeline Job**
   ```
   Dashboard → New Item
   ├── Name: toko-kopi-maru
   ├── Type: Multibranch Pipeline
   └── Configure:
       ├── Branch Sources → GitHub
       ├── Repository URL: https://github.com/your-org/toko-kopi-maru
       ├── Credentials: [Select your GitHub token]
       └── Behaviors:
           ├── Discover branches
           └── Filter by name (with wildcards): development staging production
   ```

### 3. Setup Environment Files

Untuk setiap environment, buat file `.env` dari template:

```bash
# Development
cp .env.development.example .env.development

# Staging
cp .env.staging.example .env.staging

# Production
cp .env.production.example .env.production
```

**⚠️ Update nilai-nilai berikut:**

- `DB_PASSWORD`: Password database yang kuat
- `OPENROUTER_API_KEY`: API key untuk AI assistant
- `SESSION_SECRET`: Secret key untuk session management

### 4. Configure Deploy Hosts

Update `/etc/hosts` atau DNS untuk deployment:

```bash
# Development
127.0.0.1 dev.toko-kopi-maru.com

# Staging
192.168.1.100 staging.toko-kopi-maru.com

# Production
your-server-ip toko-kopi-maru.com
```

## 📦 Pipeline Stages

### 1. Checkout

Mengambil kode dari GitHub branch yang sesuai.

### 2. Install Dependencies

```bash
npm ci  # Clean install untuk reproducible builds
```

### 3. Code Quality (Parallel)

- **Lint**: Menjalankan ESLint
- **Type Check**: Validasi TypeScript
- **Security Audit**: npm audit untuk vulnerabilities

### 4. Build

```bash
npm run build  # Build Next.js application
```

### 5. Docker Build

- Build Docker image dengan tag: `{branch}-{build-number}`
- Build latest tag: `{branch}-latest`
- **Prune**: Cleanup images older than 24h

### 6. Deploy

- Stop container lama
- Deploy container baru dengan docker-compose
- Health check untuk validasi

### 7. Post Deploy Cleanup

- Remove dangling images
- Cleanup unused containers

## 🔧 Konfigurasi Pipeline

### Jenkinsfile

File `Jenkinsfile` di root repository mendefinisikan pipeline. Key configurations:

```groovy
environment {
    DOCKER_IMAGE = 'toko-kopi-maru'
    DOCKER_REGISTRY = 'your-registry.com'  // Update ini
    NODE_ENV = getEnvironment()
    DEPLOY_HOST = getDeployHost()
}
```

### Docker Compose Files

Setiap environment memiliki docker-compose file sendiri:

- `docker-compose.development.yml` - Port 3000
- `docker-compose.staging.yml` - Port 3001
- `docker-compose.production.yml` - Port 3002

## 🧹 Prune Build Strategy

Pipeline mengimplementasikan beberapa teknik prune:

### 1. Image Prune (After Build)

```bash
docker image prune -f --filter "until=24h"
docker system prune -f --volumes
```

Menghapus images yang tidak digunakan lebih dari 24 jam.

### 2. Post Deploy Cleanup

```bash
docker image prune -f
docker container prune -f
```

Menghapus dangling images dan stopped containers.

### 3. Workspace Cleanup

```groovy
post {
    cleanup {
        cleanWs()  // Membersihkan Jenkins workspace
    }
}
```

## 🔍 Code Quality

### ESLint

Coding standards dan best practices check.

### TypeScript

Type safety validation.

### Security Audit

Deteksi vulnerabilities di dependencies.

## 🚦 Deployment Flow

### Development Branch

```
Push ke development → Jenkins trigger → Code Quality → Build → Deploy ke Dev Server
```

### Staging Branch

```
Merge ke staging → Jenkins trigger → Code Quality → Build → Deploy ke Staging Server
```

### Production Branch

```
Merge ke production → Jenkins trigger → Code Quality → Build → Deploy ke Production Server
```

## 📊 Monitoring

### Health Check Endpoint

```bash
curl http://dev.toko-kopi-maru.com/api/health
```

### Docker Status

```bash
docker ps
docker logs toko-kopi-maru-dev
```

### Jenkins Console Output

Dashboard → [Job Name] → [Build Number] → Console Output

## 🔐 Security

### Environment Variables

- Never commit `.env` files
- Use Jenkins credentials for sensitive data
- Rotate secrets regularly

### Docker Security

- Images are scanned during build
- Use official base images
- Regular updates via pipeline

## 🐛 Troubleshooting

### Build Gagal di Code Quality

```bash
# Run locally untuk debug
npm run lint
npx tsc --noEmit
```

### Docker Build Gagal

```bash
# Test docker build locally
docker build -t test .
```

### Deploy Gagal

```bash
# Check logs
docker logs toko-kopi-maru-{env}

# Check health endpoint
curl -f http://{host}/api/health
```

### Disk Space Issues

```bash
# Manual cleanup
docker system prune -a --volumes
docker builder prune -a
```

## 📝 Maintenance

### Weekly

- Review build logs
- Check disk usage
- Update dependencies if needed

### Monthly

- Rotate credentials
- Review and optimize pipeline
- Update Jenkins plugins

## 🎯 Next Steps (Post-MVP)

- [ ] Tambah automated testing (unit, integration)
- [ ] Setup Slack/Discord notifications
- [ ] Implement blue-green deployment
- [ ] Add database migration automation
- [ ] Setup monitoring (Prometheus/Grafana)
- [ ] Add rollback mechanism
- [ ] Implement canary deployments
- [ ] Add performance testing

## 📞 Support

Jika ada masalah, check:

1. Jenkins console output
2. Docker logs
3. Application logs
4. GitHub Actions (jika ada)

---

**Created**: March 2026  
**Version**: 1.0.0 (MVP)  
**Maintained by**: DevOps Team
