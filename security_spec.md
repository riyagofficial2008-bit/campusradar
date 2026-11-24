# Campus Radar Super App Security Specification (Phases 0-2)

## 1. Data Invariants
1. **Default Deny**: Every undefined collection path must return `PERMISSION_DENIED`.
2. **Non-PII Public Campus Feed**: Campus facilities, pin positions, live status reports, events, clubs, public community posts, marketplace listings, lost & found, and public polls contain zero user emails, phone numbers, or private contact credentials.
3. **PII & Private Data Isolation**:
   - `/users/{userId}` holds only public student profile attributes (`displayName`, `department`, `course`, `year`, `section`, `interests`, `visibility`, `allowDirectMessages`). `allow list` requires `resource.data.visibility == 'campus'` (or owner get).
   - `/user_private/{userId}`, `/timetables/{slotId}`, `/assignments/{assignmentId}`, `/notifications/{id}` are strictly owner-only (`request.auth.uid == userId` / `resource.data.userId`).
   - `/messages/{messageId}` is strictly restricted to the two `participants` (`request.auth.uid in resource.data.participants`).
   - `/feedback/{feedbackId}` separates anonymous feedback from public student profiles: private/anonymous complaints can only be read by their `submitterUid` or an admin; public suggestions never carry identifying PII.
4. **Role & Privilege Protection**:
   - Users cannot self-assign `isVerifiedOrganizer: true` in `/users/{userId}`, nor write to `/admins` or `/organizers`.
   - Only verified organizers (`/organizers/{uid}`) or admins (`isAdmin()`, requiring verified email or `/admins/{uid}`) can publish `isOfficial: true` events or post admin responses on `/feedback`.
5. **Creator Identity Integrity & Immutable Fields**:
   - All `create` operations require creator UID == `request.auth.uid` and `createdAt == request.time`.
   - Creator UIDs, `createdAt`, and document `id` fields are immutable after creation.
6. **Terminal State & Action-Scoped Updates**:
   - Once a marketplace listing is `sold` or `removed`, or a lost & found item is `returned`, or a safety/feedback item is `resolved`, non-admin owners cannot revert terminal state.
   - Peer actions (report confirmation, post likes, post reporting, event registration, club join, group join, poll voting) use strict `affectedKeys().hasOnly(...)` branches so peers cannot mutate titles, owners, or timestamps.

## 2. "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated write**: Client without `request.auth` writes to `/facilities`, `/statusReports`, `/posts`, `/messages`, or `/marketplace_listings`.
2. **Self-promoted organizer**: User sets `isVerifiedOrganizer: true` on `/users/{uid}` creation or update.
3. **Spoofed official event**: Non-organizer student creates `/events/ev1` with `isOfficial: true`.
4. **Direct message eavesdropping**: User `uidC` queries or gets `/messages/msg1` where `participants == ['uidA', 'uidB']`.
5. **Private schedule scraping**: User `uidB` lists or reads `/timetables` or `/assignments` belonging to `uidA`.
6. **Anonymous feedback deanonymization**: User `uidB` lists private `/feedback` complaints created by `uidA`.
7. **Client-forged timestamp**: Authenticated user submits `createdAt` not equal to `request.time`.
8. **Shadow field injection**: User injects `isAdmin: true` or `extraField: "x"` on any document creation/update.
9. **Oversized image / Denial-of-Wallet**: User uploads a 900KB `photoDataUrl` (>180,000 chars), >4 `imageUrls`, non-HTTPS `imageUrls`, or 5,000-char description.
10. **Terminal state bypass**: Seller tries to revert a `sold` listing back to `available` or alter another seller's price.
11. **Unverified email spoofing**: User signs in with unverified `email_verified: false` claiming admin email.
12. **Arbitrary delete**: Non-admin user deletes shared `facilities`, `statusReports`, or `feedback`.
13. **Firebase Storage abuse**: Unauthenticated upload, cross-user path overwrite (`lost_found/{otherUid}/...`), >5 MB file, or non-image MIME type upload rejected by `storage.rules`.
