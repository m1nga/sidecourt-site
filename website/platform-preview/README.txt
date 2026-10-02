Canonical SideCourt application and independent /admin/. Addresses are real paths: each fixed page has its own folder holding the application, published works and their authors have folders with their own head, and 404.html answers every other /work/<id> and /people/<handle>.
Production: copy this folder, except admin.html, into website/platform-preview/ of the hosting checkout and admin/index.html to website/admin.html.
Copy with rsync -a --checksum: pages differ only in their cache keys and keep their size, so a size-and-time check can skip a changed file.
Merge (never delete): CleanPause pages, downloads and update manifests, domain and Google ownership files, OAuth discovery and other products stay as they are. Run check-hosting.mjs --target on the checkout after copying.
public-pages.json lists what this export wrote for published works; the next export reads it back (--previous).
This export does not certify SMTP, AI, backup recovery or complete launch acceptance.
