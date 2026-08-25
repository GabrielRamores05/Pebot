# Uploads

**Gives you:** upload to Lightsail Object Storage (S3-compatible) with progress,
validation, access control, and image optimisation.

**Use when:** people attach images or documents.

**Escalate when:** what's being uploaded is a **photo or scan of a government ID**
— a passport, driver's licence, PhilID, or anything showing a TIN, SSS or
PhilHealth number. That is sensitive personal information under the Data Privacy
Act, and `standard/privacy.md` sets conditions on holding it that go beyond this
recipe. Before escalating, check whether it's actually needed: if the builder only
wants to verify who someone is, offer checking the ID and recording *that it was
checked, by whom, and when* while keeping no image. Most take that once it's
offered — it's less work for them too.

## Ask the builder

1. **What are people uploading?** Photos, PDFs, spreadsheets — determines what's
   allowed.
2. **How big might they be?** They won't know precisely; "phone photos" or
   "scanned contracts" is enough.
3. **Who should be able to see them?** The big one. Anyone with the link, only the
   person who uploaded, only staff? Ask it plainly — builders often assume files
   are private when they're serving them from a public bucket.
4. **How many per record?** One profile photo, or many attachments.

Never ask about: buckets, signed URLs, MIME validation, CDN, image formats.

## Creates

```
lib/storage/client.ts                  S3 client pointed at the bucket
lib/storage/presign.ts                 upload and download URLs, short-lived
components/<feature>/uploader.tsx      drag-drop + picker
supabase/migrations/<ts>_create_<name>_files.sql   file records + RLS
```

Files live in the bucket; a row per file lives in the database with the usual
`team_id`/`user_id` and RLS. **Permission is decided by that row, never by the
bucket** — the bucket has no idea who anyone is.

## Invariants

- **Private bucket by default.** Public only when the builder has said, in answer to
  question 3, that anyone may see these. Files in a public bucket are readable by
  anyone with the URL, forever, whatever the app shows.
- Private files are served through short-lived presigned URLs, generated per
  request — and only after checking the file's row, which RLS scopes to the
  person asking.
- **Uploads never go through the app server.** Presign a URL and let the browser
  send the file straight to the bucket. Proxying a 20 MB upload through a
  container with 384 MB of heap is how the whole site goes down during a busy
  afternoon.
- Separate buckets for local development and production.
- Validate type and size **server-side**. A client-side check is a courtesy; the
  file arrives regardless.
- Check the actual content type, not the filename extension.
- Never use the user's filename as the storage path — generate one. User filenames
  contain path characters, unicode, and occasionally other people's names.
- Show progress on anything over a second, and let it be cancelled.
- Images: resize and convert on upload. A 12MB phone photo displayed as a 200px
  avatar is the most common cause of a slow first page.
- Deleting the record deletes the file. Orphaned files accumulate and cost money
  nobody is watching.
- **Uploads are personal data.** A photo of a person is personal data whatever
  else it shows. So uploaded files are included in that person's export and are
  really deleted — bucket key and all — by `lib/privacy/erase.ts`, and the
  personal-data inventory lists what the bucket holds. A file that survives an
  erasure request is the failure this whole path exists to prevent.
