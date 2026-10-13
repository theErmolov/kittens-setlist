# Bot notifications

`sendUserNotification(user, { text, button? })` sends a Telegram message directly
to an approved user's stored `telegramId`. It is reusable for future notification
types, including readers and writers. Telegram usernames are never used as delivery
addresses. No queue, scheduler, new table, or additional Lambda is required.

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
