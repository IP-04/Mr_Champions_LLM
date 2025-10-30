# 🚀 UCL ML Platform - Production Deployment Guide

Based on the architecture outlined in `ULTIMATEREADME.MD`, here's how to deploy your app to production.

---

## 📋 Architecture Overview

```
Frontend (React/Vite)     → Firebase Hosting / Vercel
Backend (Express/Node)    → GCP App Engine / Railway
ML Server (Python)        → GCP Cloud Run / Railway
Database                  → Neon PostgreSQL (already set up)
Cache                     → Upstash Redis (optional)
Static Assets             → GCP Cloud Storage / Cloudinary
```

---

## 🎯 Deployment Options (Ranked by Complexity)

### Option 1: **Quick Deploy** (Vercel + Railway) ⭐ RECOMMENDED
- **Effort**: 15 minutes
- **Cost**: Free tier available
- **Best for**: MVP, demos, testing

### Option 2: **Google Cloud Platform** (Full GCP Stack)
- **Effort**: 2-3 hours
- **Cost**: ~$20-50/month
- **Best for**: Production, scalability

### Option 3: **Docker Compose** (Self-Hosted)
- **Effort**: 1-2 hours
- **Cost**: VPS ($5-20/month)
- **Best for**: Full control, learning

---

## 🚀 Option 1: Quick Deploy (Vercel + Railway)

### Step 1: Deploy Frontend to Vercel

#### 1.1 Prepare for Build
```bash
# Update vite.config.ts to ensure proper build
npm run build
```

#### 1.2 Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Follow prompts:
# - Set up and deploy: Y
# - Which scope?: your-username
# - Link to existing project?: N
# - Project name: ucl-ml-platform
# - Directory: ./
# - Want to override settings?: N

# Production deployment
vercel --prod
```

#### 1.3 Environment Variables in Vercel Dashboard
Go to Vercel Dashboard → Settings → Environment Variables:
```
VITE_API_URL=https://your-backend.up.railway.app
```

---

### Step 2: Deploy Backend to Railway

#### 2.1 Create `Procfile` (for Railway)
```bash
# Create Procfile in project root
cat > Procfile << EOF
web: npm run start
EOF
```

#### 2.2 Update `package.json` Build Script
```json
{
  "scripts": {
    "start": "cross-env NODE_ENV=production node dist/index.js",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist"
  }
}
```

#### 2.3 Deploy to Railway
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add Neon PostgreSQL URL
railway variables set DATABASE_URL="postgresql://..."

# Deploy
railway up
```

#### 2.4 Environment Variables in Railway
```
NODE_ENV=production
DATABASE_URL=your-neon-postgres-url
ML_SERVER_URL=https://your-ml-server.up.railway.app
PORT=8080
```

---

### Step 3: Deploy ML Server to Railway

#### 3.1 Create `railway.json` for ML Server
```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pip install -r ml/python/requirements.txt"
  },
  "deploy": {
    "startCommand": "cd ml/python && python serve.py",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100
  }
}
```

#### 3.2 Deploy ML Server
```bash
railway init ml-server
railway up
```

#### 3.3 Environment Variables for ML Server
```
PORT=8000
MODEL_PATH=./models/trained/
```

---

## 🏗️ Option 2: Google Cloud Platform (Full Stack)

### Architecture
```
Frontend: Firebase Hosting
Backend: App Engine (Standard)
ML Server: Cloud Run
Database: Neon PostgreSQL (external)
Storage: Cloud Storage (player images)
```

### Step 1: Setup GCP Project

```bash
# Install gcloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Login and set project
gcloud auth login
gcloud projects create ucl-ml-platform --name="UCL ML Platform"
gcloud config set project ucl-ml-platform

# Enable APIs
gcloud services enable \
  run.googleapis.com \
  appengine.googleapis.com \
  cloudbuild.googleapis.com \
  storage.googleapis.com
```

---

### Step 2: Deploy ML Server to Cloud Run

#### 2.1 Create `Dockerfile` for ML Server
```dockerfile
# ml/python/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "serve.py"]
```

#### 2.2 Build and Deploy
```bash
cd ml/python

# Build container
gcloud builds submit --tag gcr.io/ucl-ml-platform/ml-server

# Deploy to Cloud Run
gcloud run deploy ml-server \
  --image gcr.io/ucl-ml-platform/ml-server \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --port 8000

# Get URL
gcloud run services describe ml-server --region us-central1 --format 'value(status.url)'
```

---

### Step 3: Deploy Backend to App Engine

#### 3.1 Create `app.yaml`
```yaml
runtime: nodejs20
env: standard
instance_class: F2

env_variables:
  NODE_ENV: "production"
  ML_SERVER_URL: "https://ml-server-xxxxx-uc.a.run.app"
  DATABASE_URL: "your-neon-postgres-url"

handlers:
- url: /.*
  secure: always
  script: auto
```

#### 3.2 Update `package.json` for App Engine
```json
{
  "scripts": {
    "start": "node dist/index.js",
    "gcp-build": "npm run build"
  }
}
```

#### 3.3 Deploy
```bash
gcloud app deploy app.yaml
```

---

### Step 4: Deploy Frontend to Firebase Hosting

#### 4.1 Install Firebase CLI
```bash
npm install -g firebase-tools
firebase login
```

#### 4.2 Initialize Firebase
```bash
firebase init hosting

# Select:
# - Create new project: ucl-ml-platform
# - Public directory: dist
# - Single-page app: Yes
# - GitHub deploys: No
```

#### 4.3 Update `firebase.json`
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      }
    ]
  }
}
```

#### 4.4 Build and Deploy
```bash
# Build frontend with production API URL
echo "VITE_API_URL=https://ucl-ml-platform.uc.r.appspot.com" > .env.production
npm run build

# Deploy
firebase deploy --only hosting
```

---

## 🐳 Option 3: Docker Compose (Self-Hosted)

### Create `docker-compose.yml`
```yaml
version: '3.8'

services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "80:80"
    environment:
      - VITE_API_URL=http://backend:8080
    depends_on:
      - backend

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - ML_SERVER_URL=http://ml-server:8000
    depends_on:
      - ml-server

  ml-server:
    build:
      context: ./ml/python
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - ./ml/python/models:/app/models

volumes:
  postgres_data:
```

### Dockerfiles

#### `Dockerfile.frontend`
```dockerfile
FROM node:20-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### `Dockerfile.backend`
```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

EXPOSE 8080
CMD ["npm", "start"]
```

### Deploy to VPS
```bash
# Copy to VPS
scp -r . user@your-vps:/opt/ucl-ml-platform

# SSH and deploy
ssh user@your-vps
cd /opt/ucl-ml-platform
docker-compose up -d
```

---

## 📊 Post-Deployment Checklist

### 1. Environment Variables ✅
- [ ] `DATABASE_URL` set (Neon PostgreSQL)
- [ ] `ML_SERVER_URL` set (Cloud Run / Railway)
- [ ] `VITE_API_URL` set (Frontend)
- [ ] `NODE_ENV=production`

### 2. Database Setup ✅
```bash
# Run migrations
npm run db:push

# Verify players
npm run check-merged
```

### 3. ML Models ✅
```bash
# Verify models are loaded
curl https://your-ml-server.com/health

# Response should include:
# {"models_loaded": {"match_outcome": true, "player_predictor": true}}
```

### 4. Generate Predictions ✅
```bash
# Generate initial predictions
npm run generate-predictions

# Verify in browser
open https://your-app.com
```

### 5. Performance Testing ✅
```bash
# Test API response times
curl -w "@curl-format.txt" -o /dev/null -s https://your-backend.com/api/matches

# Should be < 500ms
```

---

## 🔒 Security Checklist

- [ ] Enable HTTPS (automatic on Vercel/Railway/Firebase)
- [ ] Set CORS origins in `server/index.ts`
- [ ] Add rate limiting (already implemented)
- [ ] Set secure environment variables (not in code)
- [ ] Enable GCP Cloud Armor (DDoS protection)
- [ ] Use GCP Secret Manager for sensitive data

---

## 📈 Monitoring & Analytics

### Setup Application Monitoring

#### Option 1: Vercel Analytics (Free)
```bash
npm install @vercel/analytics
```

```typescript
// client/src/main.tsx
import { Analytics } from '@vercel/analytics/react';

<Analytics />
```

#### Option 2: Google Analytics
```html
<!-- client/index.html -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
```

---

## 💰 Cost Estimation

### Option 1 (Vercel + Railway) - FREE Tier
- Frontend (Vercel): Free
- Backend (Railway): Free ($5/month after)
- ML Server (Railway): Free ($5/month after)
- Database (Neon): Free (up to 0.5GB)
- **Total**: $0-10/month

### Option 2 (GCP) - Production Scale
- Firebase Hosting: Free (10GB/month)
- App Engine: ~$30/month (F2 instance)
- Cloud Run: ~$20/month (2GB RAM)
- Cloud Storage: ~$5/month (images)
- **Total**: ~$55/month

### Option 3 (VPS) - Self-Hosted
- DigitalOcean Droplet: $20/month (4GB RAM)
- Neon Database: Free
- **Total**: ~$20/month

---

## 🎯 Recommended Deployment Path

### For Demo/MVP:
✅ **Use Option 1 (Vercel + Railway)**
- Fastest deployment (15 min)
- Free tier available
- Easy rollback
- Great for showing investors

### For Production:
✅ **Use Option 2 (GCP Full Stack)**
- Scalable to millions of users
- Auto-scaling
- Enterprise-grade monitoring
- Aligns with your ULTIMATEREADME.MD architecture

---

## 🚀 Quick Deploy Commands (Copy-Paste)

### Fastest Deployment (Vercel + Railway):
```bash
# 1. Deploy Frontend
vercel --prod

# 2. Deploy Backend
railway up

# 3. Deploy ML Server
cd ml/python && railway up

# Done! ✅
```

### Full GCP Deployment:
```bash
# 1. ML Server
cd ml/python && gcloud run deploy ml-server --source .

# 2. Backend
gcloud app deploy

# 3. Frontend
npm run build && firebase deploy

# Done! ✅
```

---

## 📞 Troubleshooting

### Issue: ML Server returns 500
**Solution**: Check model files are included in deployment
```bash
ls ml/python/models/trained/
# Should show: player_*.json, match_outcome_model.pkl, etc.
```

### Issue: Frontend can't reach backend
**Solution**: Update CORS settings
```typescript
// server/index.ts
app.use(cors({
  origin: ['https://your-frontend.vercel.app']
}));
```

### Issue: Database connection fails
**Solution**: Check Neon connection string
```bash
psql $DATABASE_URL
# Should connect successfully
```

---

## 🎉 Next Steps After Deployment

1. **Share your live URL** with investors/users
2. **Monitor performance** via Vercel/Railway dashboards
3. **Set up CI/CD** for automatic deployments
4. **Add custom domain** (e.g., `uclpredict.ai`)
5. **Enable analytics** to track user behavior

---

## 🏆 You're Ready to Deploy!

Choose your deployment path and run the commands above. Your UCL ML Platform will be live in minutes!

**Recommended for you**: Start with **Option 1 (Vercel + Railway)** to get live quickly, then migrate to GCP when you're ready to scale.

Good luck! 🚀⚽

