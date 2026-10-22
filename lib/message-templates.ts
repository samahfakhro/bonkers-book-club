// Every message the app sends, in one place. The wording here is the ORIGINAL; edits made in Admin → Messages are
// saved in the message_templates table and used instead ("Reset to original" removes the edit).
// {placeholders} are filled in per family. Safe in the browser (no secrets) — the server reads edits in lib/messages.ts.

export type Placeholder = { key: string; label: string; sample: string }
export type MessageTemplate = {
  key: string
  group: string
  name: string
  when: string                 // when it's sent / who gets it
  title?: string               // headline (in-app title, email subject)
  body: string
  placeholders: Placeholder[]
  whatsapp?: boolean           // also goes by WhatsApp → Meta must approve changed wording
}

const P = {
  parent: { key: 'parent_name', label: 'Parent’s first name', sample: 'Sarah' },
  child: { key: 'child_name', label: 'Child’s name', sample: 'Layla' },
  childrenPossessive: { key: 'children_possessive', label: 'Children’s names, e.g. “Layla and Omar’s” (or “your”)', sample: 'Layla and Omar’s' },
  whose: { key: 'whose', label: '“Layla’s” or “your”', sample: 'Layla’s' },
  day: { key: 'curious_day', label: 'Curious Day, e.g. Monday', sample: 'Monday' },
  cutoff: { key: 'cutoff_time', label: 'Cutoff time, e.g. 8pm', sample: '8pm' },
  returning: { key: 'returning_count', label: 'Books to return, e.g. “3 books”', sample: '3 books' },
  place: { key: 'place', label: 'Where, e.g. “at your door” / “in your safe spot (behind the gate)” / “with reception”', sample: 'in your safe spot (behind the side gate)' },
  book: { key: 'book_title', label: 'Book title', sample: 'Dog Man' },
  amount: { key: 'amount', label: 'Amount in AED', sample: '45' },
  booksAtHome: { key: 'books_at_home', label: 'Books at home, e.g. 6', sample: '6' },
  planBooks: { key: 'plan_books', label: 'Books on their plan, e.g. 4', sample: '4' },
  extra: { key: 'extra_books', label: 'Extra books, e.g. “2 books”', sample: '2 books' },
  plan: { key: 'plan_name', label: 'Plan name', sample: 'A Little Curious' },
  date: { key: 'date', label: 'A date, e.g. 15 November 2026', sample: '15 November 2026' },
  savedDays: { key: 'saved_days', label: 'Saved paid days, e.g. “12 days”', sample: '12 days' },
  owedNote: { key: 'owed_note', label: 'Money-owed sentence (only when something is owed)', sample: ' AED 45 for lost or damaged books has been charged to your card.' },
  lastDay: { key: 'last_curious_day', label: 'Their last Curious Day before the change', sample: 'Sunday 9 November' },
  link: { key: 'link', label: 'Sign-up link', sample: 'https://curiouslibrary.ae/signup' },
}

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  // ── joining ──
  { key: 'welcome', group: 'Joining', name: 'Welcome', when: 'When a family signs up.', placeholders: [P.parent],
    title: 'Welcome!',
    body: 'We’re so happy you’re here! Add your readers, explore the library together and choose your first books — we’ll bring them to your door on your Curious Day.' },
  { key: 'signup_reminder', group: 'Joining', name: 'Finish signing up', when: 'Email only — once, about 24 hours after someone starts signing up but doesn’t finish. The button takes them back with their details filled in.', placeholders: [P.parent],
    title: 'You’re nearly there!',
    body: 'You started joining The Curious Library but didn’t quite finish. Your details are saved, so you can pick up right where you left off — your first books could be on their way soon.' },
  { key: 'waitlist_invite', group: 'Joining', name: 'Waitlist invite', when: 'Sent by hand from Admin → Capacity when a place opens up.', placeholders: [P.parent, P.link], whatsapp: true,
    body: 'Hi {parent_name}! Good news — a Curious Library membership place has opened up in your area 🎉 You can join here: {link}\n\nPlaces are limited, so we’d love to welcome you soon!' },

  // ── choosing books ──
  { key: 'cutoff_confirm', group: 'Choosing books', name: 'Cutoff reminder — choices waiting', when: '12 noon on cutoff day, if they have unconfirmed choices.', placeholders: [P.day, P.cutoff], whatsapp: true,
    title: 'Don’t forget to confirm your books', body: 'Your book choices for {curious_day}’s Curious Day need confirming by {cutoff_time} tonight.' },
  { key: 'cutoff_choose', group: 'Choosing books', name: 'Cutoff reminder — nothing chosen', when: '12 noon on cutoff day, if nothing is chosen and there’s space for new books.', placeholders: [P.day, P.cutoff], whatsapp: true,
    title: 'Time to choose your books!', body: 'Pick your books for {curious_day}’s Curious Day by {cutoff_time} tonight.' },
  { key: 'child_sent', group: 'Choosing books', name: 'Child has chosen books', when: 'When a child sends their choices to their grown-up (once per Curious Day).', placeholders: [P.child],
    title: '{child_name} has chosen books', body: '{child_name} has chosen books and sent them to you. Tap to have a look and confirm them before the cutoff.' },
  { key: 'back_in_stock', group: 'Choosing books', name: 'Back in stock (the bell)', when: 'When a book they rang the bell for is checked back in.', placeholders: [P.book, P.whose], whatsapp: true,
    title: '{book_title} is back!', body: 'Good news! {book_title} is back on The Curious Library shelf. It’s first come, first served — add it to {whose} next delivery before someone else does!' },
  { key: 'request_added', group: 'Choosing books', name: 'Book request added', when: 'When admin marks a book request as Added.', placeholders: [P.book],
    title: 'Your book request is here!', body: 'Good news! {book_title} is now in The Curious Library. Thank you for asking for it.' },
  { key: 'swap_added', group: 'Choosing books', name: 'We added a book', when: 'When admin adds a book to a child’s next delivery.', placeholders: [P.child, P.book],
    title: 'We’ve updated {child_name}’s books', body: 'We’ve added {book_title} to {child_name}’s books for your next Curious Day.' },
  { key: 'swap_removed', group: 'Choosing books', name: 'We removed a book', when: 'When admin takes a book off a child’s next delivery.', placeholders: [P.child, P.book],
    title: 'We’ve updated {child_name}’s books', body: 'We’ve taken {book_title} off {child_name}’s books for your next Curious Day. Choose another any time before the deadline.' },

  // ── tomorrow is your Curious Day (built from pieces) ──
  { key: 'eve_title', group: 'Tomorrow is your Curious Day', name: 'Headline', when: '6pm the evening before, when something is being delivered and/or collected.', placeholders: [], whatsapp: true,
    body: 'Tomorrow is your Curious Day!' },
  { key: 'eve_lead_both', group: 'Tomorrow is your Curious Day', name: 'Opening — delivery and collection', when: 'First sentence when books are coming and going.', placeholders: [P.returning],
    body: 'Your new books are on their way, and we’ll collect your {returning_count} to return.' },
  { key: 'eve_lead_delivery', group: 'Tomorrow is your Curious Day', name: 'Opening — delivery only', when: 'First sentence when only new books are coming.', placeholders: [],
    body: 'Your new books are on their way.' },
  { key: 'eve_lead_collection', group: 'Tomorrow is your Curious Day', name: 'Opening — collection only', when: 'First sentence when books are only being collected.', placeholders: [P.returning],
    body: 'We’re collecting your {returning_count} to return.' },
  { key: 'eve_handover', group: 'Tomorrow is your Curious Day', name: 'Have them ready', when: 'Families who chose Ring bell or Call me, with books to return.', placeholders: [],
    body: 'Please have them ready to hand over.' },
  { key: 'eve_ring', group: 'Tomorrow is your Curious Day', name: 'Ring bell', when: 'Families whose #1 choice is Ring bell.', placeholders: [],
    body: 'Our driver will ring your bell.' },
  { key: 'eve_call', group: 'Tomorrow is your Curious Day', name: 'Call me', when: 'Families whose #1 choice is Call me.', placeholders: [],
    body: 'Our driver will call you when they arrive.' },
  { key: 'eve_backup', group: 'Tomorrow is your Curious Day', name: 'Backup choice', when: 'Ring bell / Call me families with a #2 choice, when new books are coming.', placeholders: [P.place],
    body: 'If we can’t reach you, we’ll leave your new books {place}.' },
  { key: 'eve_leave_both', group: 'Tomorrow is your Curious Day', name: 'Leave — delivery and collection', when: 'Door / safe spot / reception families, books coming and going.', placeholders: [P.place],
    body: 'Our driver will leave your new books {place} — please leave your returning books there too, first thing tomorrow morning.' },
  { key: 'eve_leave_delivery', group: 'Tomorrow is your Curious Day', name: 'Leave — delivery only', when: 'Door / safe spot / reception families, only new books coming.', placeholders: [P.place],
    body: 'Our driver will leave them {place}.' },
  { key: 'eve_leave_collection', group: 'Tomorrow is your Curious Day', name: 'Leave — collection only', when: 'Door / safe spot / reception families, only collecting.', placeholders: [P.place],
    body: 'Please leave them {place} first thing tomorrow morning.' },
  { key: 'eve_no_preference', group: 'Tomorrow is your Curious Day', name: 'No preference set', when: 'Families with no delivery preference, with books to return.', placeholders: [],
    body: 'Please have them ready for our driver.' },

  // ── missed visits ──
  { key: 'missed_delivery', group: 'Missed visits', name: 'Missed delivery', when: 'When the driver couldn’t deliver.', placeholders: [P.childrenPossessive], whatsapp: true,
    title: 'We missed you today!', body: 'Our driver came by with {children_possessive} new books but couldn’t deliver them.' },
  { key: 'missed_collection', group: 'Missed visits', name: 'Missed collection', when: 'When some returning books weren’t there.', placeholders: [], whatsapp: true,
    title: 'We couldn’t collect your books today', body: 'Some of your returning books weren’t there when our driver called.' },
  { key: 'missed_no_return', group: 'Missed visits', name: 'No books out', when: 'When no books were out, so new ones stayed in the van.', placeholders: [P.childrenPossessive], whatsapp: true,
    title: 'We couldn’t collect your books today', body: 'Our driver came to collect your books and drop off new ones, but there were no books out to collect — so {children_possessive} new books have stayed in the van. New books go out once the old ones come back.' },
  { key: 'missed_ask', group: 'Missed visits', name: 'What to do next', when: 'Added to every missed-visit message, above the link.', placeholders: [], whatsapp: true,
    body: 'Tap below to tell us what to do — the sooner you reply, the more likely we can sort it today.' },

  // ── returns ──
  { key: 'over_new', group: 'Returns', name: 'Some books didn’t come back', when: 'After returns are checked in, if a family has more books at home than their plan.', placeholders: [P.booksAtHome, P.planBooks, P.extra],
    title: 'Some books didn’t come back', body: 'You have {books_at_home} books at home, but your plan is for {plan_books}. New books are on hold until we get {extra_books} back — please mark the extra books as Returning for your next Curious Day. Anything you’d chosen is safe on your saved list.' },
  { key: 'over_reminder', group: 'Returns', name: 'New books still on hold', when: 'After a visit, while a family is still over their plan.', placeholders: [P.extra],
    title: 'New books are on hold', body: 'We still need {extra_books} back before we can send new ones. Please mark the extra books as Returning for your next Curious Day — you can choose books again as soon as they’re back.' },
  { key: 'all_sorted', group: 'Returns', name: 'All sorted', when: 'When a family is back within their plan.', placeholders: [],
    title: 'All sorted — thank you!', body: 'Everything’s back within your plan, so you can choose new books again. Happy reading!' },
  { key: 'payment_lost', group: 'Returns', name: 'Payment request — lost book', when: 'When staff press “Send to family” on a lost book.', placeholders: [P.book, P.amount],
    title: 'A lost book', body: 'We’ve marked {book_title} as lost. The replacement cost is AED {amount}. We’ll be in touch about payment — once it’s settled, you’re all clear.' },
  { key: 'payment_damaged', group: 'Returns', name: 'Payment request — damaged book', when: 'When staff press “Send to family” on a damaged book.', placeholders: [P.book, P.amount],
    title: 'A damaged book', body: '{book_title} came back damaged. The repair/replacement cost is AED {amount}. We’ll be in touch about payment.' },

  // ── membership ──
  { key: 'plan_upgraded', group: 'Membership', name: 'Upgraded', when: 'When a family upgrades.', placeholders: [P.plan, P.planBooks],
    title: 'You’re now on {plan_name}', body: 'Your plan has been upgraded to {plan_name} — {plan_books} books at a time. You can choose more books straight away.' },
  { key: 'downgrade_booked', group: 'Membership', name: 'Downgrade booked', when: 'When a family books a downgrade.', placeholders: [P.plan, P.planBooks, P.date],
    title: 'Your plan change is booked', body: 'Your plan will change to {plan_name} ({plan_books} books at a time) on {date}. Please return any extra books by then — we’ll remind you before your last Curious Day.' },
  { key: 'downgrade_reminder', group: 'Membership', name: 'Downgrade reminder', when: 'Before their last Curious Day ahead of a downgrade, if they still have extra books.', placeholders: [P.plan, P.date, P.extra, P.lastDay],
    title: 'Getting ready for {plan_name}', body: 'To switch to {plan_name} on {date}, please return {extra_books} on your Curious Day, {last_curious_day}. Just mark them as Returning on your dashboard.' },
  { key: 'downgrade_done', group: 'Membership', name: 'Downgrade done', when: 'On the billing date, when the family fits the smaller plan.', placeholders: [P.plan, P.planBooks, P.date],
    title: 'You’re now on {plan_name}', body: 'Your plan has changed to {plan_name} — {plan_books} books at a time — from {date}.' },
  { key: 'downgrade_postponed', group: 'Membership', name: 'Downgrade tries again next month', when: 'On the billing date, when there are still extra books at home.', placeholders: [P.plan, P.extra],
    title: 'Your plan change will try again next month', body: 'There are still {extra_books} too many at home, so your current plan carries on for another month. Return them before your next billing date and we’ll switch you to {plan_name} then.' },
  { key: 'paused', group: 'Membership', name: 'Paused', when: 'When a family pauses.', placeholders: [P.savedDays],
    title: 'Your membership is paused', body: 'Your membership is paused and payments have stopped. We’ve saved {saved_days} of paid membership for when you come back — resume any time in Settings.' },
  { key: 'resumed', group: 'Membership', name: 'Resumed', when: 'When a family resumes.', placeholders: [P.date],
    title: 'Welcome back!', body: 'Your membership is active again. Your saved days run from today, and your next payment is on {date}.' },
  { key: 'cancelling', group: 'Membership', name: 'Cancelling', when: 'When a family cancels.', placeholders: [P.date, P.owedNote],
    title: 'Your membership will end', body: 'Your membership will end on {date}, the end of the period you’ve paid for.{owed_note} Changed your mind? You can keep your membership in Settings until then.' },
  { key: 'kept', group: 'Membership', name: 'Keeping membership', when: 'When a family changes their mind about cancelling.', placeholders: [],
    title: 'Your membership will carry on', body: 'Great news — you’re staying with us! Your membership carries on as normal.' },
]

export const templateByKey = (key: string) => MESSAGE_TEMPLATES.find(t => t.key === key)

// "{child_name} has chosen books" + { child_name: 'Layla' } → "Layla has chosen books" (unknown placeholders are left as typed)
export const fillPlaceholders = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m))
