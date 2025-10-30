# 🔧 Fix Vercel Deployment - Root Directory Configuration

## Problem
Vercel is looking for `package.json` in the root directory, but our frontend is in the `client/` subdirectory.

## ✅ Solution: Configure Root Directory in Vercel Dashboard

### Step 1: Go to Vercel Dashboard
1. Open: https://vercel.com/isaias-perezs-projects/ucl-ml-platform
2. Click on **Settings** tab

### Step 2: Update Root Directory
1. In Settings, find **"Root Directory"** section
2. Click **"Edit"**
3. Enter: `client`
4. Click **"Save"**

### Step 3: Redeploy
1. Go back to **Deployments** tab
2. Click on the latest deployment
3. Click **"Redeploy"** button
4. OR run in terminal: `vercel --prod`

---

## Alternative: Deploy from Client Directory

If the dashboard method doesn't work, delete the project and redeploy:

```bash
# Delete current Vercel project (optional)
vercel remove ucl-ml-platform --yes

# Navigate to client directory
cd client

# Deploy from client directory
vercel --prod

# Answer prompts:
# - Link to existing project? No
# - Project name: ucl-ml-platform-client
# - In which directory is your code located? ./
# - Override settings? No
```

---

## What This Does

**Before:**
```
vercel/path0/          <-- Vercel looks here
  ├── vercel.json
  ├── client/          <-- But our code is here!
  │   ├── package.json
  │   ├── index.html
  │   └── src/
  └── server/
```

**After:**
```
vercel/path0/client/   <-- Vercel now looks here
  ├── package.json     <-- ✅ Found!
  ├── index.html
  └── src/
```

