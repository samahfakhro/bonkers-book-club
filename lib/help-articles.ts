// Help answers for the Support page — grouped by topic and searchable.
// Keep answers short and true to how the service actually works. `keywords` catch words people type that aren't in the text.

export type HelpArticle = { q: string; a: string; keywords?: string }
export type HelpTopic = { topic: string; articles: HelpArticle[] }

export const HELP_TOPICS: HelpTopic[] = [
  {
    topic: 'Getting started',
    articles: [
      { q: 'How does The Curious Library work?', a: 'Choose books from our library on the app and we’ll deliver them to your door on your Curious Day. When you’re ready for new ones, mark which books you’re returning on the app, and we’ll collect them when we bring your next selection.', keywords: 'how it works start begin explain' },
      { q: 'How do I add a reader?', a: 'Tap Add a Reader on your dashboard and enter your child’s details. You can add as many children as you like — one membership covers the whole family.', keywords: 'child children kid add profile sibling new reader' },
      { q: 'What is the parent PIN for?', a: 'It keeps your dashboard, including billing, account settings and book approvals, separate from your children’s profiles. You can change it any time in Settings.', keywords: 'pin password lock code' },
      { q: 'Which areas do you deliver to?', a: 'We deliver to selected areas of Dubai. Pin your home on the map when you sign up to check if we cover your area. If we don’t yet, you can join our waitlist.', keywords: 'area community location where deliver dubai waitlist zone' },
      { q: 'What ages are the books for?', a: 'Our books are mainly for ages 3–10. Browse by age group: Hatchling (3–5), Chick (5–7) and Bird (8–10).', keywords: 'age ages old young level reading level hatchling chick bird' },
      { q: 'Can siblings share a membership?', a: 'Absolutely! One membership covers the whole family, and your books can be shared between all your children.', keywords: 'brothers sisters family share kids' },
    ],
  },
  {
    topic: 'Choosing books',
    articles: [
      { q: 'How do we choose books?', a: 'Browse the library and tap the plus sign to add books to your child’s Coming Next list, or the heart to save them for later. You can choose as many books as you have available slots. If you already have books at home, simply mark the ones you’re finished with as Returning to make room for new ones. Each returning book frees up one slot for a new book. Don’t forget to confirm your choices before your Curious Day cutoff!', keywords: 'pick select basket plus coming next order choose slots space full' },
      { q: 'Can my child choose their own books?', a: 'Of course! Each child can browse and choose books from their own profile. You can approve their choices yourself or give them permission to choose independently — it’s up to you!', keywords: 'child kids choose themselves own profile approve approval permission independent' },
      { q: 'When is the cutoff?', a: 'You’ll need to confirm your books a couple of days before your Curious Day. The exact cutoff is always shown on your dashboard.', keywords: 'deadline time last day lock' },
      { q: 'What happens if we miss the cutoff?', a: 'No problem! Any unconfirmed books go back to your saved list, ready for next time. Nothing is sent without your approval.', keywords: 'late missed forgot submit' },
      { q: 'A book we want isn’t available. What can we do?', a: 'Tap the bell on the book page and we’ll let you know when it’s available again. Books are first come, first served, so it’s worth being quick!', keywords: 'unavailable out of stock notify bell waiting borrowed' },
      { q: 'Can we keep our books for longer than a week?', a: 'Absolutely! There are no due dates or late fees, so you’re welcome to keep your books for as long as you like. Just return them when you’re ready for something new.', keywords: 'keep longer extend due date week time' },
      { q: 'Do we have to return all our books at once?', a: 'Not at all! You can return whichever books you’re finished with and keep the rest. We’ll bring you new books to replace the ones you return, up to your plan’s limit.', keywords: 'return some all part keep rest' },
      { q: 'Can we ask for a book you don’t have?', a: 'Yes, please do! Search the library, and if it’s not there, tap “Ask us to add it” (or “Suggest a book” at the bottom of the library). Children can ask too. If we add it, we’ll let you know.', keywords: 'request suggest suggestion missing add new book series want wish' },
      { q: 'Can I suggest a book for the library?', a: 'We’d love your suggestions! Tap “Suggest a book” at the bottom of the library, or “Ask us to add it” if a search doesn’t find what you’re looking for. Children can suggest books too. We can’t promise every title, but we’ll consider every suggestion and let you know if we add it.', keywords: 'suggest suggestion recommend request add new book series idea' },
      { q: 'Can we change which books we’re returning after the cutoff?', a: 'Yes! You can mark more books as Returning at any time, or change which ones are going back. Just keep at least as many books marked as you had before the cutoff — your new books are coming because those ones are going back.', keywords: 'returning change swap after cutoff more books different return' },
      { q: 'What happens if my child doesn’t enjoy a book?', a: 'No problem! Not every book is going to be a favourite. Just mark it as Returning on the app and choose something different for your next Curious Day.', keywords: 'dislike didnt like enjoy boring not interested' },
    ],
  },
  {
    topic: 'Deliveries & collections',
    articles: [
      { q: 'When is my Curious Day?', a: 'It’s your regular weekly delivery and collection day, based on your area. You’ll find it at the top of your dashboard.', keywords: 'delivery day when date schedule' },
      { q: 'How do we return books?', a: 'Mark the books as Returning on your dashboard and have them ready to hand to the driver on your Curious Day. We’ll collect them when we deliver your next books.', keywords: 'return give back collection collect send back' },
      { q: 'Why didn’t we get new books?', a: 'We need to collect your returning books before handing over new ones, so you stay within your plan’s limit. If something went wrong, just get in touch.', keywords: 'no new books not delivered held hold kept' },
      { q: 'How do I change how you deliver?', a: 'Go to Settings → Collection & Delivery Preferences and rank your preferred options. Our driver will try them in that order.', keywords: 'safe spot door reception ring bell call preference instructions' },
      { q: 'Do we need to be home?', a: 'Not at all! You can choose doorstep, safe spot or reception delivery in Settings. Just make sure your returning books are ready for collection too.', keywords: 'home away out not home present door safe spot reception' },
      { q: 'How will the books arrive?', a: 'Each child’s books arrive in their own named envelope, so it’s easy to see whose books are whose.', keywords: 'envelope bag packaging arrive package' },
      { q: 'How do I change my address?', a: 'Update your address and map pin in Settings. If your new address is in a different area, your Curious Day may change.', keywords: 'address move moving new home location change' },
      { q: 'We missed our delivery. What now?', a: 'We’ll send you a message with a link to choose what happens next — another delivery attempt if available, or waiting until your next Curious Day. Your books will stay reserved for you until we can deliver them, but you’re welcome to change your choices in the meantime.', keywords: 'missed not home failed delivery driver' },
      { q: 'What happens if we’re away on holiday?', a: 'Going away? No problem! You can keep your current books while you’re away and arrange your next exchange when you’re back. There are no due dates or late fees.', keywords: 'holiday vacation away travel trip summer' },
      { q: 'How are books cleaned and checked between families?', a: 'We check our books when they’re returned to make sure they’re in good condition, and then we clean and sanitise them, ready for the next reader.', keywords: 'clean cleaning hygiene sanitise sanitize germs condition' },
    ],
  },
  {
    topic: 'Membership & payments',
    articles: [
      { q: 'Are there due dates or late fees?', a: 'None! Keep your books for as long as you like and return them when you’re ready.', keywords: 'due date late fee fine overdue keep' },
      { q: 'How do I change my plan?', a: 'You can upgrade or downgrade anytime in Settings → Plan. Upgrades start straight away, with a part-month charge for the rest of your billing cycle. Downgrades start on your next billing date — just return any extra books by then, and we’ll send you a reminder before your last Curious Day so you don’t miss it. If there are still more books at home than your new plan allows, your current plan carries on for another month and we’ll try the change again on your next billing date.', keywords: 'upgrade downgrade plan change membership bigger smaller' },
      { q: 'How will you contact me?', a: 'We’ll send updates by WhatsApp and email. You can manage your preferences in Settings, but at least one has to be switched on.', keywords: 'messages notifications whatsapp email contact alerts' },
      { q: 'How do I cancel?', a: 'You can cancel in Settings → Plan once all your books have been returned. Book a free collection on your Curious Day, and once we’ve collected your books, you’ll be able to cancel.', keywords: 'cancel stop end leave membership quit' },
      { q: 'When will my membership payment be taken?', a: 'Your membership is billed monthly and renews on the same date each month as your first payment. You can check your billing details in your account.', keywords: 'payment billing charge date renew renewal when paid monthly' },
      { q: 'Can I pause my membership?', a: 'Of course! Just go to Settings → Plan to pause your membership. You’ll need to return all your books before the pause takes effect, but any unused days will be saved for when you’re ready to resume. You can restart your membership anytime in Settings, right where you left off!', keywords: 'pause hold freeze break stop temporarily resume' },
    ],
  },
  {
    topic: 'For young readers',
    articles: [
      { q: 'How do reviews work?', a: 'Your child can give books stars, rate things like how funny or spooky they were, and write a review. Written reviews are checked before they appear on the book page.', keywords: 'review rating stars blobs write comment' },
      { q: 'What is the Curious Universe?', a: 'It’s your child’s own little world that grows with every book they read. The more they read, the more there is to discover!', keywords: 'universe world worlds discoveries collection collectibles unlock game' },
    ],
  },
  {
    topic: 'Lost or damaged books',
    articles: [
      { q: 'We’ve lost a book. What happens?', a: 'Let us know and take a little time to look for it. If it doesn’t turn up, we’ll send you a payment request for a replacement.', keywords: 'lost missing cant find gone' },
      { q: 'A book got damaged. What should we do?', a: 'Accidents happen! Just let us know and return the book as usual. If it’s too damaged to lend again, we may ask you to cover the cost of a replacement.', keywords: 'damage damaged torn ripped wet broken' },
    ],
  },
]

// Search: ignores little words (how, do, I, the…), matches word stems (books → book, returning → return)
// and ranks answers by how many of the typed words they contain — matches in the question count most.
const STOP = new Set('a an and are be can could did do does for from get got have how i if in is it its me my of on or our so that the their them there they this to was we what when where which who why will with you your'.split(' '))
const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, '')

export function searchHelp(query: string): (HelpArticle & { topic: string })[] {
  const words = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP.has(w)).map(stem).filter(w => w.length > 1)
  if (!words.length) return []
  const all = HELP_TOPICS.flatMap(t => t.articles.map(art => ({ art, topic: t.topic, q: art.q.toLowerCase(), body: `${art.a} ${art.keywords || ''}`.toLowerCase() })))
  // a word found in nearly every answer (like "book") tells us little; rarer words count for more
  const weight = Object.fromEntries(words.map(w => [w, 1 / Math.max(1, all.filter(x => x.q.includes(w) || x.body.includes(w)).length)]))
  const results = all
    .map(x => ({ article: { ...x.art, topic: x.topic }, score: words.reduce((sum, w) => sum + (x.q.includes(w) ? 3 : x.body.includes(w) ? 1 : 0) * weight[w], 0) }))
    .filter(r => r.score > 0)
    .sort((x, y) => y.score - x.score)
  const best = results[0]?.score ?? 0
  return results.filter(r => r.score >= best * 0.4).slice(0, 6).map(r => r.article)
}
