# Career applications and the newsletter

## Career applications

`/careers` (linked from Contact → Apply) has the application form: name, email, phone,
position of interest, portfolio link, CV (PDF, up to 4 MB) and a message.

Each application:

1. is saved under **Leads** in the admin (admins only; marketing editors do not see it), with
   a status (New, Reviewing, Contacted, Closed) and internal notes;
2. is emailed to the address in **Site settings → Applications go to**
   (`jobs@tillotsondesign.com`), with the CV attached and Reply-To set to the applicant.

The CV is **not stored** on the site: only its file name is kept on the lead. If a lead shows
"Emailed to the jobs inbox" off, the email failed or email is not set up yet; ask the
applicant for the CV directly.

Protection against spam: a hidden field bots fill in, a minimum time on the form, and at
most five applications an hour from one sender. Applications are personal data: delete leads
once a position is filled, and keep none longer than six months.

### Turning on email (once)

Applications are saved from day one, but emails only go out once SMTP is configured in
Vercel → Settings → Environment Variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASS`, `EMAIL_FROM` (see `.env.example`). Whoever runs TDA's email (Microsoft 365 or
Google Workspace) can create a sending account for `website@tillotsondesign.com`, or use a
sending service such as Resend, which needs DNS records on tillotsondesign.com (open
question 8 in `decisions.md`: who controls DNS?). Redeploy after adding them.

## Newsletter (Mailchimp)

A signup box in the footer adds the address to TDA's Mailchimp audience with **double
opt-in**: Mailchimp emails the person to confirm. Nothing about signups is stored on the
site. The box is hidden until `MAILCHIMP_API_KEY` and `MAILCHIMP_AUDIENCE_ID` are set in
Vercel; then redeploy. Create the API key in Mailchimp → Profile → Extras → API keys.

## How long applications are kept

Career applications and inquiries (Leads) are deleted automatically six months after they
arrive. That matches what the Leads screen tells staff: delete once a position is filled, or
after six months, whichever comes first. Delete earlier by hand when a position is filled.
CVs are never stored on the site. They live only in the jobs inbox, so they follow the inbox's
own rules.

The deletion runs once a day (06:17 UTC) as a Vercel Cron job (`vercel.json`, route
`/cron/purge-leads`). It needs one setting in Vercel, Settings → Environment Variables:

- `CRON_SECRET`: any long random value, Production only. Vercel sends it with each run, and the
  route refuses anything else. Without it the job does nothing, and the cron log says so.

The six months is `LEAD_RETENTION_MONTHS` in `src/lib/retention.ts`.
