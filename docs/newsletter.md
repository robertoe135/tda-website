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
   - *Projects, two across*: for work in progress. Every photo is cropped to the same 3:2 shape
     around its focal point (set on the image), so the tiles line up; move the focal point to
     change what shows.
   - *Awards* and *Press*: choose from what is already on the site.
   - *Conversation*, *Talks and events*, *Text*, *Image*: written in the issue itself.
   Empty blocks, and headings with nothing under them, are left out; sections renumber themselves.
   Or use the **Design tab** (next to Edit): drag blocks from the list on the left into the email,
   move them up or down on the page, and fill in the selected block on the right. The email in
   the middle is drawn exactly as it will be sent. Changes save on their own into the same
   blocks the Edit tab shows; use one tab at a time. Images are chosen from the site's Images;
   upload a new one there first.
3. **Check it in the preview**: on the Edit tab, the eye button opens the email beside the form,
   with Desktop and Phone sizes. It follows what you type (drafts save on their own).
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
2. In Resend, create a segment for the newsletter (Audience → Segments; its id is on its page).
   Then bring over the old list (below).
3. In Vercel → Settings → Environment Variables (Production), set:
   - `RESEND_API_KEY`: an API key with sending access.
   - `RESEND_SEGMENT_ID`: the segment's id.
   - `NEWSLETTER_FROM`: e.g. `Tillotson Design Associates <news@news.tillotsondesign.com>`.
   Redeploy. Until all three are set, the sidebar says what is missing and nothing can be sent
   to the list.
4. Check `NEXT_PUBLIC_SERVER_URL`: links in the email (projects, View in browser) are built from
   it, so it must be the address this site is served at. Before launch that is the Vercel address
   (e.g. `https://tda-website.vercel.app`), not tillotsondesign.com, which is still Squarespace.
   The sidebar warns when it is wrong. The logo and photos load from Blob storage either way. Tests work with `RESEND_API_KEY` and `NEWSLETTER_FROM`, or the site's SMTP settings.

## Sign-ups (the footer box)

The box at the bottom of every page appears once `RESEND_API_KEY`, `RESEND_SEGMENT_ID` and
`NEWSLETTER_FROM` are set. It uses **double opt-in**:

1. The visitor enters their address; the site emails them a link ("Confirm your subscription").
2. The link opens `/subscribe/confirm`, which asks them to press **Confirm subscription**.
   Opening the link alone changes nothing, because office mail scanners open links by themselves.
3. Only then are they added to the Resend segment. Someone who had unsubscribed and signs up
   again is resubscribed, since they just confirmed.

Nothing about sign-ups is stored on the site: the link carries the address, signed with the
site's secret, and works for 7 days. The confirmation page works before launch too (it is not
behind the site password). Unsubscribing is handled by Resend's own page, linked in every issue.

## Bringing over the old list (once)

Export the subscribers from the old newsletter (Mailchimp: Audience → Export, the *subscribed*
file; Squarespace: Email Campaigns → Mailing lists → Export). Then, on a computer with the
repository and `RESEND_API_KEY` and `RESEND_SEGMENT_ID` in `.env.local`:

```
pnpm newsletter:import ~/Downloads/subscribers.csv          # check it; nothing is sent
pnpm newsletter:import ~/Downloads/subscribers.csv --write  # add them to Resend
```

It keeps only people the file shows as subscribed. Unsubscribed, bounced, pending, unclear and
duplicate rows are skipped and counted. Someone already in Resend who unsubscribed stays
unsubscribed. It also writes a cleaned file (`scripts/newsletter/out/subscribers-clean.csv`,
never committed) that can be uploaded in Resend instead (Contacts → Import).
The export holds people's addresses: keep it out of the repository and chat, and delete it after.

Only import people who signed up for TDA's newsletter. The first issue to the imported list
should say the newsletter has a new look, so nobody is surprised.

## Before launch

Links in an issue lead to the password page, and "View in browser" pages (`/newsletter/<id>`)
are behind it too. Send the first issue after launch.

## How it works (developers)

- Collection: `src/collections/newsletters/` (blocks, endpoints). Endpoints:
  `GET /api/newsletters/sending-status`, `POST /api/newsletters/:id/test`, `POST /api/newsletters/:id/send`.
- Data: `src/lib/newsletter.ts` reads what the blocks point at as the public sees it
  (`overrideAccess: false`: published projects only, no confidential clients) and builds the issue.
- Email: `src/emails/Newsletter.tsx` (React Email, open source). The logo is a PNG
  (`public/tda-logo-email.png`) because Gmail and Outlook don't show SVG.
- Sending: `src/lib/resend.ts`, Resend's Broadcast API (`segment_id`, `send: true`); Resend
  fills in `{{{RESEND_UNSUBSCRIBE_URL}}}` per recipient.
- Sign-ups: `src/lib/subscribe.ts` (token, confirmation email `src/emails/ConfirmSignup.tsx`),
  page `/subscribe/confirm`; contacts are created with `POST /contacts`, then added to the segment.
- Import: `scripts/newsletter/` (`import-lib.ts` holds the rules).
- Design tab: `components/admin/NewsletterDesign.tsx`, built with Puck (open source, MIT). It
  converts between Puck's data and the blocks (`src/lib/newsletter-puck.ts`) and draws each block
  with the email's own components (`POST /api/newsletters/preview-blocks`).
- Logo: `src/lib/email-logo.ts` puts it in Blob storage on first use (`src/emails/logo.ts`).
- Preview: `/newsletter-preview/<id>` (editors only, outside the site password);
  "View in browser": `/newsletter/<id>` (sent issues only).
