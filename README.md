# ClipQuote

React + Vite library of YouTube reactions, with Google login and Supabase account storage.

## Local development

Copy `.env.example` to `.env.local` and provide your Supabase project URL and **publishable** key. Never use a service-role or secret key in a VITE variable.

```sh
npm install
npm run dev
npm run build
npm test
```

Preview: http://127.0.0.1:5188. Local development uses the configured **remote Supabase database**. The Vite middleware runs the same metadata and legacy-link handlers as Vercel Functions.

## Accounts and storage

- Google OAuth uses PKCE. Supabase redirect URLs must include the production origin and http://127.0.0.1:5188/ for local testing.
- The approved-email list is private. New Auth accounts are blocked unless approved. Permissions resolve from the verified Auth email; users cannot assign themselves roles.
- Admin Explore includes all saved clips and migrated links. Admin can delete any saved/migrated clip (invalidating its link), or remove a built-in example from the catalog for everyone. The admin deletion RPC checks the verified account role.
- Admin can approve/suspend emails through the Account panel. No invitation emails are sent. Suspended accounts lose database access even with existing sessions; this does not delete their Auth account or revoke previously public clip links.
- New clips and favorites save directly to Supabase under the signed-in owner. RLS enforces ownership and approved membership. Failed saves preserve the form draft.
- Browser clips can be imported explicitly. Original `cq-clips` and `cq-favorites` remain as recovery copies; account libraries are not stored in those keys. The theme and auth session are stored locally.
- Shared links use 24-character IDs and a public single-record RPC, with no public library listing. Deleting a new clip also removes its share link.
- Older 16-character shared links have been copied from Netlify Blobs to a private Supabase table and remain independent of account deletion. Only lookup by the full link ID is publicly available. Older encoded `#clip=...` links still open.
- The legacy POST /api/clips endpoint is closed; all new writes go through Supabase authorization.
- Only metadata is stored. Video and thumbnails stay hosted on YouTube. Video metadata requests are cached with a direct thumbnail fallback.
- Production hosting is Vercel. The old Netlify site forwards shared links and offers to transfer browser-only clips through a URL fragment. Original browser data and Netlify Blobs are retained.

## Database setup

Scripts in `supabase/setup/` are ordered, repeatable bootstrap SQL, applied using `supabase db query --linked --file ...`. They are not Supabase migration-history entries. Scripts beginning `check_` verify permissions inside transactions that roll back all test records.

The current project is `jiacjllvlnjeuzzlzhoc`. Its bootstrap admin is morzuchstudio@gmail.com. Use a separate project for automated staging when expanding beyond this small beta.

SQL checks cover unapproved registration, suspended-account access, cross-user isolation, admin escalation, stable share links and deletion. Browser tests mock Supabase and YouTube; real Google account selection must be completed by the user.

These are primary stored records, not a backup system. A scheduled export/restore workflow is not yet configured.

## Deployment

Production: https://clipquote.vercel.app

Vercel project: masterpiotr-s-projects/clipquote. GitHub main is connected for future deployments.

Set the two VITE variables from `.env.example` in the build environment. Local builds read `.env.local`. Vercel Functions under api/ serve legacy links and YouTube metadata. Both read Supabase through its publishable key; no service-role key is needed.

```sh
npm run build
npx vercel deploy --prod
```

The small static bridge under migration/netlify is the only remaining Netlify deployment. It keeps old URLs working and preserves a transfer path for browser libraries. Do not delete the Netlify site while old URLs are still in use.

## Player and interface

English interface, light/dark themes, sticky search and reaction filters. The ten labeled demo cards reuse curated examples for scrolling tests.

The add form displays the YouTube-hosted thumbnail when a URL is pasted. A user-initiated playback check tests the selected range. Failed embeds show a timestamped YouTube link; the end time cannot be enforced outside ClipQuote. Playback availability can change after checking. Native file uploads, transcription, semantic search, social preview cards, request-access forms and messaging integrations are not implemented.
