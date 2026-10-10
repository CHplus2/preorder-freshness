# Dapur Kita menu photos

Licensed illustrative photos for a fictional demo catalogue; not photographs of this kitchen. Garnishes, recipes, portions, packaging and variants may differ. Recipe/allergen records remain authoritative.

The 24 menus use 17 reviewed photos from Wikimedia Commons, copied unchanged into `frontend/public/menu-images/`. Some related variants share an illustration. Full authorship, original URLs, licences, SHA-256 hashes and assignments are in [DAPUR-KITA-MENU-PHOTOS.json](DAPUR-KITA-MENU-PHOTOS.json). Public attribution is served at `/static/menu-images/credits.html` and linked in the storefront footer. Individual image licences remain separate from the software licence.

## Deployment and assignment

Build and deploy the assets first. Product URL values are recorded in `DAPUR-KITA-STARTER-DATA.json`; therefore later catalogue imports preserve these photos. Production URLs intentionally point to the existing public Vercel domain. For another host, change those URLs to its HTTPS origin before applying.

```powershell
python scripts/update_dapur_kita_photos.py
python scripts/update_dapur_kita_photos.py --apply
```

The first command is read-only. Both commands authenticate through the existing Django staff session/CSRF flow and verify every deployed JPEG against its local checksum. The apply command PATCHes only `image_url`, verifies all other product fields, retains an external before-snapshot and write receipt, and skips already-correct values. It does not import recipes, create inventory, reprice orders or train CatBoost. Multiple API writes are not one transaction; inspect the private receipt if interrupted, then rerun the read-only plan before continuing.

The trained model is separately Git-ignored. This photo release uses a direct Vercel source upload with the original checksum-verified runtime bundle. A Git-only Vercel redeploy still requires a valid server-side `FRESHCAST_BUNDLE_URL` and checksum; menu photos do not provide a model download source.
