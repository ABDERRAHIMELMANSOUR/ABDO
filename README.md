# ABDO

The internal operations platform for **ALM & CPA Assurances**. It covers:

- **Team and tasks:** daily checklists plus a weekly master roadmap for the team: Abderrahim (admin), Ikram and Ayman.
- **Attendance (pointage):** an employee's first sign-in of the day records their arrival and sends it to the HR Google Sheet.
  Before 09:00 counts as `Present`; after 09:00 counts as `En retard`.
- **WordPress Migration & Audit:** imports the ALM and CPA WordPress exports into an inventory of every URL, form and media file.
  It then checks that each old URL still works on the new Next.js site without losing SEO.
- **WhatsApp & Meta:** a template manager with a live preview and Meta submission, plus Cloud API number and webhook monitoring.
  It also has a launch checklist for Meta Ads campaigns.

Built with Next.js (App Router), TypeScript, Tailwind CSS and SQLite.

## Project structure

```
app/
  login/                    Sign-in, logout
  dashboard/                Employee view: arrival, today's checklist, weekly roadmap
  admin/
    page.tsx                Today: presence, lateness, task progress, weekly roadmap
    tasks/                  Assign daily tasks and weekly roadmap items
    team/                   Members, passwords, deactivation
    attendance/             Arrival history and HR sheet sync status
    migration/              WordPress Migration & Audit
      page.tsx              Tabs: Files & data · SEO & routing · Forms
      export/route.ts       Download Next.js redirects (JSON) or the URL map (CSV)
    whatsapp/
      page.tsx              Template list
      templates/            Template editor with WhatsApp preview
      webhooks/             Numbers, Cloud API checks, webhook log
      campaigns/            Meta Ads creative & campaign checklist
  api/whatsapp/webhook/     Public webhook endpoint for Meta
lib/
  db.ts                     SQLite connection and schema
  seed.ts                   First-start data: team, weekly roadmap, sites, numbers, templates, campaigns
  auth.ts                   Signed session cookie and role checks
  attendance.ts, sheets.ts  Punch-in and Google Sheets sync
  wp/                       WordPress export parsers (SQL, JSON), importer, URL/SEO checker
  whatsapp/                 Template rules, Graph API client, data access
  marketing.ts              Campaign statuses and the default checklist
google-apps-script/Code.gs  Webhook that writes attendance rows into the HR sheet
```

## Run it locally

You need [Node.js](https://nodejs.org) 20 or newer.

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from the example (on Windows PowerShell, use `Copy-Item .env.example .env.local`):

   ```bash
   cp .env.example .env.local
   ```

3. Fill in at least these values:
   - `SESSION_SECRET`: a random string of 32 characters or more.
   - `ADMIN_PASSWORD`: the password for `abderrahim`.
   - `EMPLOYEE_PASSWORD`: the first password for `ikram` and `ayman`. Reset them later in **Team**.

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open http://localhost:3000 and sign in as `abderrahim`.

The first start creates the database at `data/app.db` and fills it with:

- the team and this week's roadmap
- the ALM and CPA sites, and their four WhatsApp number slots
- the Welcome, Follow-up and Devis Confirmation templates for each brand
- one Meta Ads campaign per brand, with its checklist

Delete `data/app.db` to start over.

## Weekly roadmap

Weekly items belong to the week (Monday to Friday) and move through **To do → In progress → Done**.
Daily tasks are ticked off as before.
Admins add either kind in **Tasks**, choosing "Weekly roadmap" or "Daily task".
Everyone sees their own roadmap on their dashboard. The admin sees everyone's on **Overview**.

## WordPress Migration & Audit

Each site (ALM, CPA) has three tabs.

**Files & data**

Import what Ikram exports over FileZilla/FTP:

- **MySQL dump** (`.sql` or `.sql.gz`, up to 200 MB) from phpMyAdmin or `mysqldump`.
  The importer reads `wp_posts`, `wp_postmeta` and `wp_options`, works with any table prefix, and rebuilds each URL from the permalink settings.
  It also picks up Yoast and Rank Math titles and descriptions, and detects forms (Contact Form 7, WPForms, Gravity Forms, Elementor and others).
- **REST API JSON** from `/wp-json/wp/v2/pages?per_page=100` (and `posts`, `media`). Upload it as one array, or as `{ "pages": [...], "posts": [...], "media": [...] }`.
  JSON gives exact public links, which is useful when permalinks use `%category%`.

Set the downloaded `wp-content/uploads` folder in **Site settings**, then click **Scan uploads folder** to confirm every media file was downloaded.
Importing again updates the inventory and keeps your mappings, checks and form audits.

**SEO & routing**

Set the new Next.js site URL (staging or `http://localhost:3001`), then click **Check unchecked URLs**.
Each old path is requested on the new site the way Google will request it. A URL passes when it:

- answers 200, directly or through permanent 301/308 redirects
- lands on the mapped new path
- keeps the same SEO title and meta description
- isn't set to `noindex`

Edit the new path of any URL that changes. **Export Next.js redirects** then downloads the matching `redirects()` entries for `next.config`.

**Forms**

Lists every page with a form. Record each one as working or broken after a test submission on the live site.

## WhatsApp & Meta setup

1. In [Meta Business Manager](https://business.facebook.com), create a System User with access to the WhatsApp Business Account(s).
   Generate a permanent token with `whatsapp_business_management` and `whatsapp_business_messaging`, and put it in `WHATSAPP_ACCESS_TOKEN`.
2. In **WhatsApp & Meta → Numbers & webhooks**, fill in the **Phone number ID** and **WhatsApp Business Account ID** of each ALM and CPA number (from WhatsApp Manager → API Setup).
   Then click **Check connection**.
3. The webhook needs a public HTTPS address. Set `APP_URL` to it.
   For local testing, a tunnel such as `cloudflared tunnel --url http://localhost:3000` works.
4. In the Meta app dashboard (WhatsApp → Configuration):
   - Set the callback URL shown on the page.
   - Use the same verify token as `WHATSAPP_VERIFY_TOKEN`.
   - Subscribe to `messages`.
5. Set `META_APP_SECRET` so the app rejects requests that weren't signed by Meta.

Templates can be drafted and previewed without any of this. **Submit to Meta** and **Refresh status** need the token and a WABA ID for the brand.
Customer phone numbers in the webhook log are masked to their last 4 digits, and message text is never stored.

## Connect the HR Google Sheet

The app sends each arrival to a small Google Apps Script web app attached to your sheet.
You don't need a Google Cloud project.

1. Open the HR Google Sheet and go to **Extensions → Apps Script**.
2. Paste in `google-apps-script/Code.gs` and change `SECRET` to a random string.
3. Click **Deploy → New deployment → Web app**, with **Execute as: Me** and **Who has access: Anyone**. Approve the permissions it asks for.
4. Put the web app URL (ending in `/exec`) in `GOOGLE_SHEETS_WEBHOOK_URL` and the same secret in `GOOGLE_SHEETS_WEBHOOK_SECRET`.
   Optionally, set `HR_SHEET_URL` to the sheet's link.
5. Restart the app.

The sheet ("les retards") is a grid: dates down column A (`01/11/2026`, `02/11/2026`, ...) and one column per person in row 1 (`abderrahim`, `ikram`, `ayman`).
Each first sign-in of the day fills the cell where that day meets that person, for example `09:14 En retard` on a yellow background or `08:52 Present` on green.
A missing date row or person column is added automatically. The script fills the tab named `Sheet1`; change `SHEET_NAME` in `Code.gs` if you rename it.

On Vercel, set `GOOGLE_SHEETS_WEBHOOK_URL` and `GOOGLE_SHEETS_WEBHOOK_SECRET` under **Settings → Environment Variables**, then redeploy.

If Google can't be reached, the arrival is still saved. **Attendance** shows it as failed and has a **Retry** button.
After editing `Code.gs`, redeploy it with **Manage deployments → New version**.

## Attendance rules

| Setting              | Default             | Meaning                                       |
| -------------------- | ------------------- | --------------------------------------------- |
| `TIMEZONE`           | `Africa/Casablanca` | Timezone that decides the work day and time   |
| `WORK_START_TIME`    | `09:00`             | Arrivals after this time are `En retard`      |
| `LATE_GRACE_MINUTES` | `0`                 | Optional tolerance added to the start time    |

Everyone is punched in, Abderrahim included.
Arrival is recorded on the first sign-in of the day. It is also recorded the first time the dashboard (or, for the admin, the overview) opens that day, so it still works for anyone who stayed signed in overnight.

## Deploying

```bash
npm run build
npm start
```

SQLite needs a persistent disk, so use a small VPS or VM rather than a serverless host.
Put the app behind HTTPS (required for the WhatsApp webhook) and set `COOKIE_SECURE=true`.
