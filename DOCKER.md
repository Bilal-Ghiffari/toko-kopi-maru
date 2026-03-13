# Docker Setup Guide

## Development Workflow

### 🚀 Recommended: Local Development dengan Hot Reload

Untuk development sehari-hari (lebih cepat, ada hot reload):

```bash
# 1. Jalankan HANYA database PostgreSQL di Docker
docker compose up postgres -d

# 2. Jalankan aplikasi Next.js di local
npm install  # Jika belum install dependencies
npm run dev

# Aplikasi berjalan di http://localhost:3000 dengan hot reload!
# Setiap perubahan kode langsung terlihat tanpa restart
```

**Keuntungan:**

- ✅ Hot reload - perubahan kode langsung terlihat
- ✅ Debugging lebih mudah
- ✅ Tidak perlu rebuild Docker setiap kali ada perubahan
- ✅ Development lebih cepat

### 🐳 Production: Full Stack dengan Docker

Setelah development selesai dan ingin test production build:

```bash
# Build dan jalankan full stack di Docker
docker compose down
docker compose up --build -d

# Aplikasi production di http://localhost:3000
```

---

## Cara Menjalankan Aplikasi dengan Docker

### 1. Persiapan

Pastikan Anda sudah memiliki:

- Docker Desktop terinstall
- File `.env` dengan `OPENROUTER_API_KEY` Anda

```bash
# Copy .env.example ke .env dan isi API key
cp .env.example .env
```

**Penting:** Pastikan `DATABASE_URL` di `.env` menggunakan `localhost` untuk development:

```env
DATABASE_URL="postgresql://postgres:secret@localhost:5432/kasir_digital?schema=public"
```

### 2. Setup Database (First Time untuk Local Dev)

Jika Anda menggunakan local development (`npm run dev`):

```bash
# 1. Jalankan PostgreSQL di Docker
docker compose up postgres -d

# 2. Push schema ke database
npx prisma db push

# 3. Seed data dummy
npm run db:seed
```

**Catatan:** Database push dan seeding hanya perlu dilakukan sekali saat pertama kali setup.

### 3. Build dan Jalankan dengan Docker Compose (Production)

Untuk production atau testing full stack:

```bash
# Build dan start semua services
docker compose up -d

# Atau build ulang jika ada perubahan
docker compose up --build -d
```

### 4. Akses Aplikasi

- **Aplikasi**: http://localhost:3000
- **Kasir**: http://localhost:3000/kasir
- **Analytics**: http://localhost:3000/analytics

---

## 🎯 Quick Reference

### Development Commands (Recommended)

```bash
# Start database only
docker compose up postgres -d

# Run app in development mode
npm run dev

# Push database schema (first time)
npx prisma db push

# Seed data (first time)
npm run db:seed

# View logs
docker compose logs -f postgres
```

### Production Commands

```bash
# Build and start all services
docker compose up --build -d

# View logs
docker compose logs -f app

# Stop all services
docker compose down
```

### Useful Commands

```bash
# Lihat logs
docker compose logs -f app

# Stop services
docker compose down

# Stop dan hapus volumes
docker compose down -v

# Restart app service
docker compose restart app

# Masuk ke container
docker compose exec app sh

# Jalankan Prisma Studio
docker compose exec app npx prisma studio
```

## Build Docker Image Manual

```bash
# Build image
docker build -t toko-kopi-maru .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://postgres:secret@host.docker.internal:5432/kasir_digital" \
  -e OPENROUTER_API_KEY="your-key" \
  toko-kopi-maru
```

## Best Practices yang Diterapkan

✅ **Multi-stage build** - Memisahkan dependencies, build, dan runtime
✅ **Layer caching** - Optimasi build time dengan proper layer ordering
✅ **Non-root user** - Menjalankan aplikasi sebagai user nextjs (security)
✅ **Minimal image size** - Menggunakan Alpine Linux (node:20-alpine)
✅ **Health check** - Monitoring kesehatan container
✅ **Docker Compose** - Orchestrasi multi-container (app + database)
✅ **Environment variables** - Konfigurasi terpisah dari code
✅ **.dockerignore** - Mengurangi context size dan build time

## Troubleshooting

### Port sudah digunakan

```bash
# Cek proses yang menggunakan port
lsof -i :3000
lsof -i :5432

# Atau ubah port di docker-compose.yml
```

### Database connection error

```bash
# Pastikan postgres sudah ready
docker compose logs postgres

# Restart services
docker compose restart
```

### Build error

```bash
# Clean build
docker compose down
docker system prune -f
docker compose up --build

# Lihat logs untuk memastikan tidak ada error
docker compose logs -f app

# Remove Docker image
# 1. Stop dan hapus semua container yang konflik
docker rm -f postgres-db-kasir-digital toko-kopi-maru-app

# 2. Hapus network jika perlu
docker network rm toko-kopi-maru_app-network 2>/dev/null || true

# 3. Start ulang dengan compose
docker compose up -d
```
