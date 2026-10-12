---
name: add-email
description: Add a transactional email to this API — the job type, its data, a React Email template, the render step in the mail processor, the MailService method and its test double. Use when asked to "send an email when X", "email the user", "add a notification email", or for review results, invites, digests and receipts.
---

# Add an email

Mail is a queue: `MailService` enqueues on `mail`, and
`src/common/processors/mail/` renders the template and sends it. Six places
change, in this order; the `welcome` email is the example to follow through
all of them.

1. **The job and its data**, in `src/common/types/email.ts`: a `MailJob`
   value (`ReviewFinished = 'review-finished'`) and an interface with `to`
   plus what the template needs (`ReviewFinishedData`).
2. **The template**, `emails/review-finished.tsx`: a React Email component
   using `main-layout.tsx`, taking `EmailProps<ReviewFinishedData>`. Build it
   from the layout's blocks (`Heading`, `Action` + `Button`, `QuoteBlock`,
   `Note`, `Terminal`, `LinkFallback`, `Fine`) and style anything else with
   `emails/theme.ts` (qotm_kit's tokens), never literal colours. The designs
   are the `qotm_mail` Paper file and the qotm canvas's Emails page. Preview
   it with `yarn email:dev`.
3. **The render step**, in `src/common/processors/mail/process.ts`: a
   `ReviewFinishedProcess extends ProcessAbstract<ReviewFinishedData>` with
   `subject`, `preview` and `process()` returning `{ to, subject, html }`, and
   its entry in `ProcessFactory.jobs`.
4. **The producer method**, in `src/common/services/mail.service.ts`:
   `reviewFinished = (data: ReviewFinishedData) => { this.mail.add(MailJob.ReviewFinished, data); };`
5. **The test double**, `__mocks__/review-finished.js`, like the others, and
   a key for it in the mail mock in `test/factory/app.ts`, or e2e tests that
   trigger it fail to render.
6. **Call it** from the service where the event happens. Sending is already
   asynchronous; do not await delivery in a request.

Subjects are sentence case and say what happened. The from-address and SMTP
settings come from config (`SMTP_*`); nothing per email.
