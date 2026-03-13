# Deploy to Vercel

## Option 1: Deploy via Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login ke Vercel:
```bash
vercel login
```

3. Deploy:
```bash
cd /path/to/this/project
vercel --prod
```

## Option 2: Deploy via GitHub + Vercel Dashboard

1. Push project ini ke GitHub repository

2. Buka https://vercel.com/dashboard

3. Klik "Add New Project"

4. Import dari GitHub repository lu

5. Settings:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

6. Klik Deploy

## Option 3: Deploy via Vercel API (Token)

Kalo lu punya Vercel token, bisa deploy langsung:

```bash
# Set token
export VERCEL_TOKEN="your_token_here"

# Deploy
npx vercel --token=$VERCEL_TOKEN --prod --yes
```

---

## Files yang udah disiapin untuk Vercel:

- `vercel.json` - Konfigurasi routing dan build
- `package.json` - Dependencies dan build script
- `dist/` - Build output (setelah running `npm run build`)

## Environment Variables (kalo perlu):

Kalo lu mau set API key default (opsional):

```bash
vercel env add VITE_API_KEY
```

Tapi sebaiknya API key diinput user lewat UI aja biar aman.
