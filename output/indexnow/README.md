# Workstream F-18 — IndexNow setup (prepare-only)

Generated 2026-07-06. **Nothing deployed.** IndexNow lets Bing/Copilot (and Yandex) discover changed URLs immediately after an approved publish. It does not guarantee crawling/indexing and Google does not use it — treat as a Bing-discovery nicety, low priority.

## Generated key (public ownership token — NOT a secret)
```
882e18d79bece567e2cc3b524c65f532
```

## Deploy (2 steps, operator)
1. **Host the key file** at the site root so it resolves 200:
   `https://www.maxxbuilders.com/882e18d79bece567e2cc3b524c65f532.txt` — content is exactly the key on one line (file provided: `output/indexnow/882e18d79bece567e2cc3b524c65f532.txt`). On WordPress, upload it to the web root or use an SEO/IndexNow plugin that manages the key for you (RankMath/Yoast both have IndexNow add-ons — if you use one, let it generate + host the key instead of this file).
2. **Ping on change.** After each approved publish/update, POST the changed URLs to IndexNow:
   ```bash
   curl -X POST "https://api.indexnow.org/indexnow" \
     -H "Content-Type: application/json" \
     -d '{
       "host": "www.maxxbuilders.com",
       "key": "882e18d79bece567e2cc3b524c65f532",
       "keyLocation": "https://www.maxxbuilders.com/882e18d79bece567e2cc3b524c65f532.txt",
       "urlList": ["https://www.maxxbuilders.com/<changed-url>/"]
     }'
   ```
   A 200/202 means accepted. Batch up to 10,000 URLs per request.

## Where this fits the apply pipeline
Wire the ping into the WordPress apply step (`packs/wordpress/`) so that whenever an approved change_set row goes live, its URL is submitted. Only ping URLs that actually changed and are indexable 200s — do not ping the excluded/noindex URLs from the F-9 sitemap-hygiene manifest.

## Verify after deploy
- `curl -sI https://www.maxxbuilders.com/882e18d79bece567e2cc3b524c65f532.txt` → 200, `content-type: text/plain`.
- First ping returns 200/202.
- Bing Webmaster Tools → IndexNow shows submissions.
