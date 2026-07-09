# Publish the All Sport Price Ledger on GitHub Pages

The repository is already prepared with a static GitHub Pages edition in `docs/` and an automatic deployment workflow in `.github/workflows/pages.yml`.

## 1. Create the GitHub repository

Create a new repository under your GitHub account. A good name is:

`all-sport-price-ledger`

For a presentation URL that is visible to anyone, choose **Public**.

## 2. Push this folder

From this project folder, run:

```powershell
git add .
git commit -m "Build All Sport price ledger"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/all-sport-price-ledger.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

## 3. Turn on Pages once

Open the repository on GitHub, then go to **Settings â†’ Pages**. Under **Build and deployment**, choose **GitHub Actions**. The workflow will deploy `docs/` automatically after the push.

After the workflow finishes, GitHub will show the presentation URL in the repositoryâ€™s **Actions** run and **Pages** settings. It will normally look like:

`https://YOUR_USERNAME.github.io/all-sport-price-ledger/`

## What is included

- All 2,848 items from the inventory workbook.
- Search, filters, pagination, margin health, CSV export, price editing, and history.
- About section for Rafael Castrillo Beltran and All Sport International.
- Relative asset paths that work correctly from a GitHub Pages project URL.
- Browser-local history, since GitHub Pages is static hosting and has no shared database.

