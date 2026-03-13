# Toko Kopi Maru ☕

Point of Sale (POS) system dengan AI Assistant untuk toko kopi. Built with Next.js, TypeScript, Prisma, dan OpenRouter AI.

## Features

- 🛒 Point of Sale System
- 🤖 AI Assistant untuk rekomendasi dan bantuan
- 📊 Analytics Dashboard
- 🗣️ Voice Commands
- 💳 Payment Processing
- 🔍 Product Search
- 📱 Responsive Design

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **AI**: OpenRouter (GPT-4, Claude)
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **Deployment**: Docker + Jenkins CI/CD

## 🚀 CI/CD Automation

Project ini menggunakan Jenkins untuk automated deployment dengan support untuk multiple environments:

- **Development** - Auto-deploy dari branch `development`
- **Staging** - Auto-deploy dari branch `staging`
- **Production** - Auto-deploy dari branch `production`

### Quick Setup

```bash
# Setup Jenkins dan CI/CD
# Lihat dokumentasi lengkap di:
```

📖 **[Jenkins Setup Guide](./JENKINS_SETUP.md)**  
⚡ **[Quick Reference](./JENKINS_QUICK_REFERENCE.md)**

### Deployment Scripts

```bash
# Manual deployment
./deploy.sh development    # Deploy ke dev
./deploy.sh staging        # Deploy ke staging
./deploy.sh production     # Deploy ke production

# Check status
./check-status.sh

# Docker cleanup
./cleanup-docker.sh
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
