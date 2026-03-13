# Deploy ke Vercel (WAJIB biar API Key jalan!)

## Kenapa Harus Deploy ke Vercel?

Browser ada **CORS restriction** - gabisa langsung hit HeroSMS API dari frontend. Jadi perlu **backend proxy** yang gua udah siapin di folder `/api/`.

## Cara Deploy (3 langkah):

### 1. Push ke GitHub

```bash
cd /path/to/project

git init
git add .
git commit -m "Initial commit"

# Buat repo di GitHub dulu, terus:
git remote add origin https://github.com/username/herosms-auto-order.git
git push -u origin main
```

### 2. Deploy ke Vercel

**Opsi A: Vercel Dashboard (Recommended)**
1. Buka https://vercel.com/dashboard
2. Klik "Add New Project"
3. Import dari GitHub repo lu
4. Framework Preset: **Vite**
5. Build Command: `npm run build`
6. Output Directory: `dist`
7. Klik **Deploy**

**Opsi B: Vercel CLI**
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
cd /path/to/project
vercel --prod
```

### 3. Test API Key

Setelah deploy, buka URL Vercel lu dan tes API key. Sekarang harusnya bisa konek!

---

## Struktur Project

```
app/
├── api/
│   └── herosms.ts      ← API Proxy (Vercel Serverless Function)
├── src/
│   ├── services/
│   │   └── herosms.ts  ← Frontend service (pake proxy)
│   └── ...
├── dist/               ← Build output
├── vercel.json         ← Vercel config
└── package.json
```

---

## Troubleshooting

**Kalo API key masih invalid:**
1. Cek di Vercel Logs (Dashboard → Project → Logs)
2. Pastikan API key bener (copy dari HeroSMS dashboard)
3. Cek apakah HeroSMS API lagi down

**Kalo CORS error masih muncul:**
- Pastikan deploy ke Vercel, bukan platform lain
- Cek `vercel.json` udah ada di root project
