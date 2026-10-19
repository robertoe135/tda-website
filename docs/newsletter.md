# The newsletter

Issues are written in the admin under **Newsletter › Newsletters** and sent through
[Resend](https://resend.com), which also keeps the subscriber list, runs the unsubscribe page and
removes addresses that bounce or complain. The design is option D ("Journal") from the October
2026 mockups: a numbered issue with a short letter, then sections.

## Writing an issue (marketing)

1. **Create new.** The issue starts with the usual layout: a letter, then *Recent work*,
   *In progress*, *Conversation* and *Recognition*, each with its blocks. The newsletter's name
   carries over from the last issue.
2. **Fill in the blocks, or delete the ones you don't need.** Blocks can be added, reordered
   (drag the handle), duplicated and removed. The letter and the conversation are optional.
   - *Project*: choose a published project; its photo, name, city, architect, client and
     photographer come from the project. Write a note for the issue, or leave it empty to use
     the project's summary. A confidential project never shows its client.
   - *Projects, two across*: for work in progress.
   - *Awards* and *Press*: choose from what is already on the site.
   - *Conversation*, *Talks and events*, *Text*, *Image*: written in the issue itself.
   Empty blocks, and headings with nothing under them, are left out; sections renumber themselves.
3. **Check it in the preview**: the eye button at the top opens the email beside the form, with
   Desktop and Phone sizes. It follows what you type (drafts save on their own).
4. **Send a test** to yourself from the sidebar. Check it on a phone and in Outlook if you can.
5. **Publish changes**, then **Send to the list**. Only the published version goes out, and only
   once. A sent issue can't be changed or deleted by editors; to send a correction, duplicate it.

What can't be changed per issue: fonts, colors, sizes and columns. That keeps every issue on
brand and readable in Outlook and Gmail (which ignore web fonts: there the text is Helvetica or
Arial, and the design is drawn to work in either).

## Setting up sending (once, by whoever runs the domain)

1. Create a Resend account for TDA. Add and verify a sending domain: a subdomain such as
   `news.tillotsondesign.com` is better than the main domain, so newsletter complaints can't
   affect everyday office email. Resend lists the DNS records to add.
2. In Resend, create a segment for the newsletter and import the current subscribers, keeping
   only people who signed up (export them from the current list with their consent dates).
3. In Vercel → Settings → Environment Variables (Production), set:
   - `RESEND_API_KEY`: an API key with sending access.
   - `RESEND_SEGMENT_ID`: the segment's id.
   - `NEWSLETTER_FROM`: e.g. `Tillotson Design Associates <news@news.tillotsondesign.com>`.
   Redeploy. Until all three are set, the sidebar says what is missing and nothing can be sent
   to the list. Tests work with `RESEND_API_KEY` and `NEWSLETTER_FROM`, or the site's SMTP settings.

## Open decisions

- **Where sign-ups go.** The footer's sign-up box still adds people to Mailchimp
  (docs/forms-and-email.md). Once Resend holds the list, the box should add them to the Resend
  segment instead, with a confirmation email (double opt-in). Not built yet.
- **Before launch**, links in an issue lead to the password page, and "View in browser" pages
  (`/newsletter/<id>`) are behind it too. Send the first issue after launch.

## How it works (developers)

- Collection: `src/collections/newsletters/` (blocks, endpoints). Endpoints:
  `GET /api/newsletters/sending-status`, `POST /api/newsletters/:id/test`, `POST /api/newsletters/:id/send`.
- Data: `src/lib/newsletter.ts` reads what the blocks point at as the public sees it
  (`overrideAccess: false`: published projects only, no confidential clients) and builds the issue.
- Email: `src/emails/Newsletter.tsx` (React Email, open source). The logo is a PNG
  (`public/tda-logo-email.png`) because Gmail and Outlook don't show SVG.
- Sending: `src/lib/resend.ts`, Resend's Broadcast API (`segment_id`, `send: true`); Resend
  fills in `{{{RESEND_UNSUBSCRIBE_URL}}}` per recipient.
- Preview: `/newsletter-preview/<id>` (editors only, outside the site password);
  "View in browser": `/newsletter/<id>` (sent issues only).
