# Mechanical Engineering Portfolio

A hand-built static site (HTML, CSS and vanilla JS) with no build step, hosted free on GitHub Pages.

## Preview locally

```bash
python -m http.server 8000
```

Then open http://localhost:8000. Use a local server rather than double-clicking `index.html`, because the code viewer needs it.

## Personalize

Search the HTML for `✏️ EDIT`. The main spots are:

- `index.html`: name, initials, school, links, about text, email
- `assets/img/profile.webp`: replace with a real headshot (about 600×700)
- `files/resume.pdf`: add your resume (the Resume buttons link here)
- `projects/*.html`: replace `Your Name` in the header and footer

Colors and fonts are at the top of `css/style.css` (`:root`).

## Add a project

1. Put optimized images in `assets/projects/<project-name>/`. Use WebP or JPG at about 1400 px wide and under 400 KB each.
2. Copy `projects/haptic-paddle.html` to `projects/<project-name>.html` and edit it.
3. In `index.html`, copy one `<a class="card">` block and set its link, image, text and `data-cat`
   (`design`, `controls`, `analysis`, `manufacturing`; a project can have several).

Videos should be MP4 (H.264), about 720 px wide and under 20 MB. GitHub rejects files over 100 MB.

## Structure

```
index.html              home page (hero, project grid, skills, about)
projects/               one page per project
css/style.css           all styles
js/main.js              shared interactions (filters, lightbox, code viewer, etc.)
js/pid-sim.js           motor-control PID playground
js/haptic-sim.js        haptic paddle virtual-environment demo
assets/                 images and video
files/                  downloadable code, reports, resume
_originals/             raw uploads (git-ignored, never published)
```

## Deploy to GitHub Pages

1. On GitHub, create a **public** repo named exactly `<your-username>.github.io`.
2. Push this folder to it (GitHub Desktop: *File → Add local repository → Publish*).
3. In the repo, open **Settings → Pages**, set *Source* to "Deploy from a branch", and pick `main` / `(root)`.
4. After about a minute the site is live at `https://<your-username>.github.io`.

## Custom domain (GitHub Student Developer Pack)

1. Claim a free domain from the Pack (for example Namecheap `.me` or `.TECH`) at https://education.github.com/pack.
2. In your registrar's DNS settings, add:
   - Four `A` records for host `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - One `CNAME` record for host `www` pointing to `<your-username>.github.io`
3. In **Settings → Pages → Custom domain**, enter your domain (this creates a `CNAME` file in the repo).
4. Once DNS has propagated (minutes to a few hours), tick **Enforce HTTPS**.
5. Set a reminder for the renewal date. Free Pack domains usually cost normal price after year one.
