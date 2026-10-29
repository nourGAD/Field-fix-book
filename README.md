# Field Fix Book

A shared logbook of problems field teams hit on telecom sites, and exactly how they fixed them, so the next team doesn't lose a day on the same fault.

**Open the logbook:** https://nourgad.github.io/Field-fix-book/

## How it works

- **Log a fix:** click *Log a fix* on the site. No account needed. Add what you saw on site, the root cause, the fix steps, what to avoid, and up to 3 photos.
- **Add your own step or tip:** open any fix and add it at the bottom.
- **It worked for you?** Click *This worked for me*. Fixes with the most votes rise to the top.

## Behind the scenes

- The site is a static page on GitHub Pages (`index.html`, `app.js`).
- Entries are stored in a Google Sheet through a Google Apps Script web app (`google/Code.gs`). Photos are saved to a Google Drive folder.
- The web app URL is set in `config.js`.

> Hide site IDs, operator names and customer data before posting. Everything on the site is public.

Maintained by Nour Gad.
