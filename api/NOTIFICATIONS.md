# Bot notifications

`sendUserNotification(user, { text, button? })` sends a Telegram message directly
to an approved user's stored `telegramId`. It is reusable for future notification
types, including readers and writers. Telegram usernames are never used as delivery
addresses. Authentication alerts use the existing API Lambda and do not require
a queue or scheduler.

The first event is a new pending authentication request. After the user and session
are saved, the login handler notifies the admin selected by
`AUTH_APPROVAL_TELEGRAM_ID` (SAM parameter `AuthApprovalTelegramId`, defaulting to
Ilya's existing Telegram ID). The recipient must still be an approved admin.
The Russian message includes the applicant's name/username and an
“Открыть пользователей” button linking to `https://kittens.band/admin`.
Existing pending, approved, and rejected accounts do not trigger repeat alerts.
An empty recipient parameter disables this event.

Delivery is best effort: a single HTTPS request with a two-second timeout and no
automatic retries. Failure is logged without bot tokens or applicant details and
does not prevent login. Concurrent first logins can produce duplicate alerts;
there is no transactional deduplication or guaranteed delivery.

The login widget already requests Telegram write access. Users must grant that
permission or open `https://t.me/kittens_control_center_bot` and press Start.
The Telegram ID alone does not guarantee permission to send messages, and a blocked
bot cannot deliver them.

Run `npm --prefix api test` to verify notification delivery with mocked Telegram
and database boundaries. Tests do not send real messages.

## Rehearsals

Group delivery is enabled for `RehearsalGroupChatId` (default: musicians group
«Котятки-музыканты», `-1003138570084`). Empty disables the rehearsal worker.
Personal digests, manual requests and preference controls are available to all
approved Telegram accounts. Automatic preparation also requires a linked musician
who attends and has songs to prepare. No messages go to pending/rejected users.

One EventBridge Scheduler cron runs every ten minutes (`ReminderCheckMinutes=10`).
One-minute and hourly checks remain configurable (`1` or `60`), with flexible
windows and automatic invocation retries disabled. It invokes a dedicated Lambda
which also receives Telegram callbacks, with reserved concurrency 1. No SQS,
long polling, or per-rehearsal schedules. Each run recomputes dates/grouping from
current rehearsals. The interval does not shorten the one-hour announcement
delay or personal reminder windows. Low-volume delivery state lives in the on-demand
`kittens-notifications` table. Temporary attempts and request records expire
via TTL; each user's preference/latest control pointer does not expire.

- Announce upcoming, uncancelled rehearsals only when `now - createdAt > 1 hour`.
  Normally this means 60–70 minutes after creation with ten-minute checks; failures may delay it. Existing
  upcoming rehearsals will also be announced on the first run.
- The 24h group reminder uses the configured scheduler slot before that deadline. An announcement
  sent in that same slot already carries the logistics, so do not duplicate it.
  Failed or missed runs never send a late logistical reminder.
- Announced rehearsals' date/time/timezone/location/end-time changes,
  cancellation, restoration and deletion are reported on the next scheduler check.
  Ordinary song, attendance, note and progress edits do not create group posts.
- Personal preparation normally starts 72h before the earliest rehearsal. Delay
  until 09:00 the morning after the predecessor in its timezone when necessary.
  Merge adjacent rehearsals with starts less than 24h apart, or where that morning
  would reach or miss the 24h deadline (a zero-length window is also combined). Chains share one digest timed from the earliest.
  Automatic personal digests also wait until creation is more than one hour old.
  Past predecessors remain in the calculation so grouping stays stable after a
  rehearsal finishes. No automatic personal delivery outside the 24–72h window.
- The group button `А мне чё учить?` sends a fresh digest immediately, even while
  automatic reminders are disabled. Expired/cancelled rehearsals, unlinked users,
  absent musicians, other group chats and unapproved users cannot request personal data.
- A successful request records timestamps per covered rehearsal. Skip automatic
  preparation if every relevant rehearsal was requested within 48h of the
  **projected** reminder time (exactly 48h also skips). A new unrequested rehearsal
  in a combined group does not silently lose its reminder. Double taps within 30s
  and retries of the same Telegram callback are suppressed.
- Digests read live learning progress, include only assigned attending musicians,
  and deduplicate songs. Queue/structure → learn; mastering → polish; ready is
  included only when `RehearsalSong.refreshFor` explicitly names the musician.
  This refresh marker is independent of progress, and is editable in song details.
  Explicit requests can return “nothing to prepare”; automatic empty digests skip.
  Readers get a catalog link; rehearsal access rules remain enforced by the app.

## Rollout reset

`NotificationDeliveryVersion=rollout-20261013` starts a fresh delivery/request
namespace. Existing upcoming rehearsals are reannounced to the musicians group
and preparation eligibility is recalculated, without changing rehearsal
`createdAt`, dates, progress, attendance or opt-out preferences. Existing
rehearsals older than an hour are eligible on the next check. Trial records
remain for diagnostics and expire via TTL; only the current version/current
chat is used for changes and deduplication. Keeping the version fixed prevents
subsequent deployments from resetting history again.

Successful requests and repeated taps dismiss the Telegram spinner without a
popup or toast. Errors use non-modal callback feedback. Stop/resume saves the
preference as before.

## Personal controls and delivery failures

The personal setting on the catalog and rehearsal list and `GET/PATCH
/notification-preferences` control automatic personal reminders. Auth approval
notifications and group posts are independent. Manual preparation requests remain
available while opted out.

Only the latest personal message has the stop/resume control. Remove its previous
stop/resume button (keeping the rehearsal link) **before** posting another personal digest, invalidate the old pointer,
then save the new message ID. If removal fails, do not post another control.
Already-removed/deleted messages are safe to proceed past. A stale callback cannot
change preferences. Stop/resume saves the preference and edits only the clicked
latest message. There is no scan/edit of personal message history. If posting
fails after removal, the app setting remains available.

Durable attempts are claimed before sending (personal groups claim atomically).
Explicit Telegram rejection releases an automatic attempt for a later eligible
check. Timeouts/unknown outcomes and interrupted attempts remain claimed to avoid
duplicates: best effort, not guaranteed delivery. Telegram cannot provide an
atomic send-and-DynamoDB-write transaction. A user may explicitly request again
with a fresh button tap. Messages are capped to Telegram's size limit and link to
the full rehearsal plan. Secrets and private comments never appear in logs/copy.

CI configures the HTTPS Telegram webhook **after** deploying the endpoint, using
`api/scripts/configure-telegram-webhook.mjs`. Only callback updates are requested;
there is no chat-message ingestion. The handler verifies Telegram's secret header
using a domain-separated HMAC of the bot token; the token/secret are never logged.
Don't run this configuration script against an undeployed endpoint.
