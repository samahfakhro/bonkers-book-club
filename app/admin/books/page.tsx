'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import CoverPicker from '@/components/admin/CoverPicker'
import { copyCode, normaliseCopyLabel } from '@/lib/copy-codes'
import EnvelopeScanner from '@/components/driver/EnvelopeScanner'

// ─── Types ────────────────────────────────────────────────────────────────────

type Book = {
  id: string; title: string; author: string
  cover_image_url: string | null; discovery_asset_url: string | null
  isbn: string | null; page_count: number | null; book_type: string | null
  publisher?: string | null; illustrator?: string | null; publication_date?: string | null; is_non_fiction?: boolean
  created_at?: string
  series_id: string | null; series_number: number | null
  reading_level_id: string | null; search_tags: string[] | null
  description: string | null; age_min: number | null; age_max: number | null
  collectible_status: string | null; collectible_name: string | null
  collectible_concept: string | null; collectible_lore: string | null
  collectible_image_url: string | null; collectible_openai_response_id: string | null
  collectible_version: number | null; collectible_source_moment: string | null
  collectible_research: string | null
  collectible_fact_sheet?: string | null; collectible_notes?: string | null
  collectible_kind?: string | null   // creature → hatches from an egg; thing → comes in a parcel
  collectible_lore_live?: boolean    // the lore line is shown to children only once published
  collectible_options?: { collectible_name: string; concept: string; lore: string; source_moment: string }[] | null
}

type Category = { id: string; name: string }
type ReadingLevel = { id: string; name: string }
type Series = { id: string; name: string; parent_series_id: string | null; series_number: number | null }
type BookCopy = { id: string; book_id: string; internal_id: string; status: string; created_at?: string }
type LoanEntry = { id: string; status: string; created_at: string; returned_at: string | null; child_name: string | null }

type DetailsForm = {
  title: string; author: string
  isbn: string; page_count: string; book_type: string
  publisher: string; illustrator: string; publication_date: string; is_non_fiction: boolean
  series_id: string; series_number: string
  reading_level_id: string
  tags: string; description: string
  age_min: string; age_max: string
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: '6px',
  backgroundColor: '#ffffff', border: '1px solid #d4d4d4',
  color: '#1a1a1a', fontSize: '13px', boxSizing: 'border-box', outline: 'none',
}

const lbl: React.CSSProperties = {
  color: '#6b6b6b', fontSize: '11px', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.05em',
  display: 'block', marginBottom: '4px',
}

const secHead: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, color: '#9b9b9b',
  letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px',
}

function Btn({ variant = 'primary', disabled, onClick, children, style }: {
  variant?: 'primary' | 'secondary'
  disabled?: boolean; onClick?: () => void
  children: React.ReactNode; style?: React.CSSProperties
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '7px 14px', borderRadius: '6px', border: 'none', cursor: disabled ? 'default' : 'pointer',
      fontSize: '13px', fontWeight: 600,
      backgroundColor: variant === 'primary' ? '#1a1a1a' : '#f0f0f0',
      color: variant === 'primary' ? '#ffffff' : '#1a1a1a',
      opacity: disabled ? 0.5 : 1, ...style,
    }}>
      {children}
    </button>
  )
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    available: ['#16a34a', 'Available'],
    checked_out: ['#d97706', 'Out'],
    active: ['#d97706', 'Out'],
    retired: ['#9b9b9b', 'Archived'],
    lost: ['#dc2626', 'Lost'],
  }
  const [color, text] = map[status] || ['#9b9b9b', status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
      {text}
    </span>
  )
}

// ─── Copy codes (CUR-0001…, printed on the labels from /admin/books/labels) ───

async function nextCopyId(): Promise<string> {
  const { data } = await supabase.from('book_copies').select('internal_id').like('internal_id', 'CUR-%')
  const nums = (data || []).map((c: any) => parseInt(String(c.internal_id).slice(4), 10)).filter(n => Number.isFinite(n))
  return copyCode((nums.length > 0 ? Math.max(...nums) : 0) + 1)
}

async function labelInUse(code: string): Promise<boolean> {
  const { data } = await supabase.from('book_copies').select('id').eq('internal_id', code).limit(1)
  return !!data?.length
}

// ─── Component ────────────────────────────────────────────────────────────────

// The collectible's one-line lore. The AI's line is only a suggestion: children see it once it's published here.
function LoreEditor({ book, onSaved }: { book: Book; onSaved: (lore: string | null, live: boolean) => void }) {
  const [text, setText] = useState(book.collectible_lore || '')
  const [saving, setSaving] = useState(false)
  useEffect(() => { setText(book.collectible_lore || '') }, [book.id, book.collectible_lore])
  const live = !!book.collectible_lore_live
  const changed = text.trim() !== (book.collectible_lore || '').trim()
  async function save(publish: boolean) {
    setSaving(true)
    const lore = text.trim() || null
    const nowLive = publish && !!lore
    await fetch('/api/admin/books', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: book.id, collectible_lore: lore, collectible_lore_live: nowLive }) })
    setSaving(false); onSaved(lore, nowLive)
  }
  const small: React.CSSProperties = { fontSize: '11px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', border: '1px solid #e5e5e5', backgroundColor: '#fff', color: '#1a1a1a' }
  return (
    <div style={{ marginTop: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#9b9b9b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lore</span>
        <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '999px', backgroundColor: live && !changed ? '#dcfce7' : '#fef3c7', color: live && !changed ? '#16a34a' : '#b45309' }}>
          {live && !changed ? 'Published: children see this' : 'Not published: children don’t see it'}
        </span>
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="One short, funny line (optional)"
        style={{ width: '100%', boxSizing: 'border-box', fontSize: '12px', fontStyle: 'italic', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e5e5e5', resize: 'vertical', fontFamily: 'inherit' }} />
      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
        {(!live || changed) && <button type="button" disabled={saving || !text.trim()} onClick={() => save(true)} style={{ ...small, backgroundColor: '#7c3aed', color: '#fff', border: 'none' }}>{saving ? 'Saving…' : changed ? 'Save & publish' : 'Publish'}</button>}
        {changed && <button type="button" disabled={saving} onClick={() => save(false)} style={small}>Save without publishing</button>}
        {live && !changed && <button type="button" disabled={saving} onClick={() => save(false)} style={small}>Unpublish</button>}
      </div>
    </div>
  )
}

// A thumbnail that shows a big version beside it while the mouse is over it (computers only; touch screens ignore it).
// Book covers by default; collectibles use the square, see-through version.
function HoverCover({ src, square = false }: { src: string; square?: boolean }) {
  const [box, setBox] = useState<DOMRect | null>(null)
  const canHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
  const W = square ? 420 : 300, H = square ? 420 : 450
  const pos = box && {
    left: box.right + 16 + W < window.innerWidth ? box.right + 16 : Math.max(8, box.left - 16 - W),
    top: Math.min(Math.max(8, box.top + box.height / 2 - H / 2), window.innerHeight - H - 8),
  }
  return (
    <>
      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: square ? 'contain' : 'cover', cursor: canHover ? 'zoom-in' : undefined }}
        onMouseEnter={e => canHover && setBox(e.currentTarget.getBoundingClientRect())} onMouseLeave={() => setBox(null)} />
      {pos && (
        <img src={src} alt="" style={{ position: 'fixed', left: pos.left, top: pos.top, width: W, height: H, objectFit: 'contain', zIndex: 1000, pointerEvents: 'none',
          backgroundColor: square ? '#1a2f51' : '#fff', padding: square ? '16px' : 0, boxSizing: 'border-box', borderRadius: '10px', boxShadow: '0 12px 40px rgba(0,0,0,0.3)', border: '1px solid #e5e5e5' }} />
      )}
    </>
  )
}

export default function AdminBooksPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [readingLevels, setReadingLevels] = useState<ReadingLevel[]>([])
  const [seriesList, setSeriesList] = useState<Series[]>([])
  const [copies, setCopies] = useState<Record<string, BookCopy[]>>({})
  const [assignments, setAssignments] = useState<Record<string, Set<string>>>({})
  const [levelAssignments, setLevelAssignments] = useState<Record<string, Set<string>>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [suggestions, setSuggestions] = useState<{ isbn: string; title: string; author: string; year: string; publisher: string; thumbnail: string }[]>([])
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [onlyNoAsset, setOnlyNoAsset] = useState(false)   // book list: just the books without an approved collectible
  const [onlyNoCover, setOnlyNoCover] = useState(false)   // book list: just the books still missing a cover
  const [sortNewest, setSortNewest] = useState(false)   // book list: A–Z or newest first
  const [saving, setSaving] = useState<string | null>(null)
  const [savingLevel, setSavingLevel] = useState<string | null>(null)

  // Panel
  const [panelMode, setPanelMode] = useState<null | 'detail' | 'add'>(null)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [detailsForm, setDetailsForm] = useState<DetailsForm | null>(null)
  const [savingDetails, setSavingDetails] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [uploadingCoverFor, setUploadingCoverFor] = useState<string | null>(null)

  // Series edit state
  const [newSeriesMode, setNewSeriesMode] = useState(false)
  const [newSeriesName, setNewSeriesName] = useState('')
  const [editMainSeriesId, setEditMainSeriesId] = useState('')
  const [newSubSeriesMode, setNewSubSeriesMode] = useState(false)
  const [newSubSeriesName, setNewSubSeriesName] = useState('')
  const [newSubSeriesNumber, setNewSubSeriesNumber] = useState('')

  // Copies
  const [expandedCopyId, setExpandedCopyId] = useState<string | null>(null)
  const [copyLoans, setCopyLoans] = useState<Record<string, LoanEntry[]>>({})
  const [loadingLoans, setLoadingLoans] = useState<string | null>(null)
  const [addingCopy, setAddingCopy] = useState(false)
  const [addLabel, setAddLabel] = useState('')          // copy label for a new book (scanned or typed)
  const [copyLabel, setCopyLabel] = useState('')        // copy label for "+ Add copy"
  const [scanFor, setScanFor] = useState<'isbn' | 'addLabel' | 'copyLabel' | null>(null)
  const [addingCopyOf, setAddingCopyOf] = useState<string | null>(null)   // book opened because its ISBN was scanned again
  const [allowDuplicate, setAllowDuplicate] = useState(false)            // "add as a new book anyway"
  const copyLabelRef = useRef<HTMLInputElement>(null)
  // the side panel always opens at the top (after adding a book, opening one, or starting a new one)
  const panelScrollRef = useRef<HTMLDivElement>(null)

  // Add form
  const [addForm, setAddForm] = useState({ title: '', author: '', isbn: '', publisher: '', illustrator: '', publication_date: '', is_non_fiction: false, page_count: '', book_type: '', series_number: '', reading_level_id: '', tags: '', description: '', age_min: '', age_max: '' })
  const [addMainSeriesId, setAddMainSeriesId] = useState('')
  const [addCoverFile, setAddCoverFile] = useState<File | null>(null)
  const [addingBook, setAddingBook] = useState(false)
  const [addNewSeriesMode, setAddNewSeriesMode] = useState(false)
  const [addNewSeriesName, setAddNewSeriesName] = useState('')
  const [addSubSeriesName, setAddSubSeriesName] = useState('')
  const [addSubSeriesNumber, setAddSubSeriesNumber] = useState('')
  const addCoverRef = useRef<HTMLInputElement>(null)
  const lookupIdRef = useRef(0)   // only the latest lookup may fill the form; an older one finishing late is ignored

  // Add form chips
  const [addLevelIds, setAddLevelIds] = useState<Set<string>>(new Set())
  const [addCategoryIds, setAddCategoryIds] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Collectible generation
  const [generatingCollectibleFor, setGeneratingCollectibleFor] = useState<Set<string>>(new Set())   // books with a collectible being made (several can run at once)
  const startGenerating = (id: string) => setGeneratingCollectibleFor(prev => new Set(prev).add(id))
  const stopGenerating = (id: string) => setGeneratingCollectibleFor(prev => { const n = new Set(prev); n.delete(id); return n })
  const [collectibleFeedback, setCollectibleFeedback] = useState('')
  const [showCollectibleFeedback, setShowCollectibleFeedback] = useState(false)
  const [collectibleCustomPrompt, setCollectibleCustomPrompt] = useState('')
  // simple collectibles: one thing from the cover, redrawn
  const [collectibleStep, setCollectibleStep] = useState<'generate' | 'draw' | 'polish' | null>(null)
  const [collectibleSuggestion, setCollectibleSuggestion] = useState('')
  useEffect(() => { setCollectibleSuggestion('') }, [selectedBook?.id])

  // Fetch / enrich
  const [fetchQuery, setFetchQuery] = useState('')
  const [fetchLoading, setFetchLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [fetchResults, setFetchResults] = useState<any[]>([])
  const [fetchedCoverBase64, setFetchedCoverBase64] = useState<string | null>(null)
  const [coverMayBeOther, setCoverMayBeOther] = useState(false)   // the cover found wasn't in English, so it was left out
  const [justAdded, setJustAdded] = useState<{ id: string; title: string; code: string | null } | null>(null)   // confirmation after Add Book
  const [descNeedsCheck, setDescNeedsCheck] = useState(false)   // the AI had too little to go on for the description

  // ── Load ───────────────────────────────────────────────────────────────────

  async function loadAll() {
    const [
      { data: bookData }, { data: catData }, { data: bcData },
      { data: levelData }, seriesRes, { data: copyData }, { data: brlData }
    ] = await Promise.all([
      supabase.from('books').select('id, created_at, collectible_kind, collectible_lore_live, collectible_fact_sheet, collectible_notes, collectible_options, title, author, cover_image_url, discovery_asset_url, isbn, publisher, illustrator, publication_date, is_non_fiction, page_count, book_type, series_id, series_number, reading_level_id, search_tags, description, age_min, age_max, collectible_status, collectible_name, collectible_concept, collectible_lore, collectible_image_url, collectible_openai_response_id, collectible_version, collectible_source_moment, collectible_research').eq('is_active', true).order('title'),
      supabase.from('categories').select('id, name').order('display_order'),
      supabase.from('book_categories').select('book_id, category_id'),
      supabase.from('reading_levels').select('id, name').order('display_order'),
      fetch('/api/admin/series').then(r => r.json()),
      supabase.from('book_copies').select('id, book_id, internal_id, status, created_at'),
      supabase.from('book_reading_levels').select('book_id, reading_level_id'),
    ])
    setBooks(bookData || [])
    setCategories(catData || [])
    setReadingLevels(levelData || [])
    setSeriesList(seriesRes.data || [])
    const amap: Record<string, Set<string>> = {}
    for (const bc of bcData || []) {
      if (!amap[bc.book_id]) amap[bc.book_id] = new Set()
      amap[bc.book_id].add(bc.category_id)
    }
    setAssignments(amap)
    const lmap: Record<string, Set<string>> = {}
    for (const bl of brlData || []) {
      if (!lmap[bl.book_id]) lmap[bl.book_id] = new Set()
      lmap[bl.book_id].add(bl.reading_level_id)
    }
    setLevelAssignments(lmap)
    const cmap: Record<string, BookCopy[]> = {}
    for (const c of copyData || []) {
      if (!cmap[c.book_id]) cmap[c.book_id] = []
      cmap[c.book_id].push(c)
    }
    setCopies(cmap)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  // ── Category toggle ────────────────────────────────────────────────────────

  async function toggleCategory(bookId: string, categoryId: string) {
    const current = new Set(assignments[bookId] || [])
    const isOn = current.has(categoryId)
    setSaving(`${bookId}-${categoryId}`)
    if (isOn) {
      await supabase.from('book_categories').delete().eq('book_id', bookId).eq('category_id', categoryId)
      current.delete(categoryId)
    } else {
      await supabase.from('book_categories').insert({ book_id: bookId, category_id: categoryId })
      current.add(categoryId)
    }
    setAssignments(prev => ({ ...prev, [bookId]: current }))
    setSaving(null)
  }

  // ── Reading level toggle ───────────────────────────────────────────────────

  async function toggleReadingLevel(bookId: string, levelId: string) {
    const current = new Set(levelAssignments[bookId] || [])
    const isOn = current.has(levelId)
    setSavingLevel(`${bookId}-${levelId}`)
    if (isOn) {
      await supabase.from('book_reading_levels').delete().eq('book_id', bookId).eq('reading_level_id', levelId)
      current.delete(levelId)
    } else {
      await supabase.from('book_reading_levels').insert({ book_id: bookId, reading_level_id: levelId })
      current.add(levelId)
    }
    setLevelAssignments(prev => ({ ...prev, [bookId]: current }))
    setSavingLevel(null)
  }

  // ── Book selection / panel ─────────────────────────────────────────────────

  // a scanned ISBN that's already in the library → open that book, ready to scan the new copy's label (no lookup, no duplicate)
  const cleanIsbn = (v: string) => (v || '').replace(/[^0-9X]/gi, '').toUpperCase()
  function bookWithIsbn(isbn: string) {
    const c = cleanIsbn(isbn)
    return c.length >= 10 ? books.find(b => cleanIsbn(b.isbn || '') === c) ?? null : null
  }
  // title suggestions while typing (not for ISBNs): Google Books, English editions only
  useEffect(() => {
    const q = fetchQuery.trim()
    if (q.length < 3 || /^\d[\d\-]*$/.test(q)) { setSuggestions([]); return }
    let cancelled = false
    const t = setTimeout(async () => {
      const r = await fetch('/api/admin/book-suggest?q=' + encodeURIComponent(q)).then(x => x.json()).catch(() => ({ results: [] }))
      if (!cancelled) setSuggestions(r.results || [])
    }, 400)
    return () => { cancelled = true; clearTimeout(t) }
  }, [fetchQuery])

  function pickSuggestion(isbn: string) {
    setSuggestOpen(false); setSuggestions([]); setFetchQuery(isbn)
    lookUpOrOpen(isbn, true)
  }

  function lookUpOrOpen(q: string, isIsbn: boolean) {
    const existing = isIsbn ? bookWithIsbn(q) : null
    if (existing) {
      openBook(existing); setAddingCopyOf(existing.id); setFetchQuery('')
      setTimeout(() => copyLabelRef.current?.focus(), 300)
      return
    }
    fetchBookInfo(q, isIsbn, undefined)
  }

  useEffect(() => { panelScrollRef.current?.scrollTo({ top: 0 }) }, [selectedBook?.id, panelMode])

  function openBook(book: Book) {
    setJustAdded(null)
    if (selectedBook?.id === book.id && panelMode === 'detail') {
      closePanel(); return
    }
    setSelectedBook(book)
    setPanelMode('detail')
    setExpandedCopyId(null)
    setConfirmDelete(false)
    setNewSeriesMode(false); setNewSeriesName('')
    setNewSubSeriesMode(false); setNewSubSeriesName(''); setNewSubSeriesNumber('')
    const s = seriesList.find(s => s.id === book.series_id)
    setEditMainSeriesId(s?.parent_series_id ? s.parent_series_id : (s?.id || ''))
    setDetailsForm({
      title: book.title || '', author: book.author || '',
      isbn: book.isbn || '',
      publisher: book.publisher || '', illustrator: book.illustrator || '', publication_date: book.publication_date || '', is_non_fiction: !!book.is_non_fiction,
      page_count: book.page_count != null ? String(book.page_count) : '',
      book_type: book.book_type || '',
      series_id: book.series_id || '',
      series_number: book.series_number != null ? String(book.series_number) : '',
      reading_level_id: book.reading_level_id || '',
      tags: (book.search_tags || []).join(', '),
      description: book.description || '',
      age_min: book.age_min != null ? String(book.age_min) : '',
      age_max: book.age_max != null ? String(book.age_max) : '',
    })
  }

  function closePanel() {
    setPanelMode(null); setSelectedBook(null); setDetailsForm(null); setExpandedCopyId(null)
  }

  // ── Series helper ──────────────────────────────────────────────────────────

  async function createSeriesViaApi(body: object): Promise<{ id: string; name: string; parent_series_id: string | null; series_number: number | null } | null> {
    const res = await fetch('/api/admin/series', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json()
    if (json.error) { setError(`Series create failed: ${json.error}`); return null }
    return json.data
  }

  async function ensureSeries(): Promise<string | null> {
    if (newSeriesMode) {
      const name = newSeriesName.trim()
      if (!name) return null
      const data = await createSeriesViaApi({ name })
      if (!data) return null
      setSeriesList(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      return data.id
    }
    if (newSubSeriesMode) {
      if (!editMainSeriesId) return null
      const name = newSubSeriesName.trim()
      const sNum = newSubSeriesNumber.trim() ? Number(newSubSeriesNumber.trim()) : null
      const data = await createSeriesViaApi({ name: name || null, parent_series_id: editMainSeriesId, series_number: sNum })
      if (!data) return null
      setSeriesList(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      return data.id
    }
    return detailsForm?.series_id || null
  }

  // ── Save details ───────────────────────────────────────────────────────────

  async function saveDetails() {
    if (!detailsForm || !selectedBook) return
    setSavingDetails(true); setError(null)
    const seriesId = await ensureSeries()
    if ((newSeriesMode || newSubSeriesMode) && !seriesId) { setSavingDetails(false); return }
    const tags = detailsForm.tags.split(',').map(t => t.trim()).filter(Boolean)
    const seriesNum = detailsForm.series_number.trim() ? Number(detailsForm.series_number.trim()) : null
    const patchBody = {
      id: selectedBook.id,
      title: detailsForm.title.trim() || selectedBook.title, author: detailsForm.author.trim() || selectedBook.author,
      isbn: detailsForm.isbn.trim() || null,
      publisher: detailsForm.publisher.trim() || null, illustrator: detailsForm.illustrator.trim() || null, publication_date: detailsForm.publication_date.trim() || null, is_non_fiction: detailsForm.is_non_fiction,
      page_count: detailsForm.page_count.trim() ? Number(detailsForm.page_count.trim()) : null,
      book_type: detailsForm.book_type.trim() || null,
      series_id: seriesId || null,
      series_number: seriesId ? seriesNum : null,
      search_tags: tags.length > 0 ? tags : null,
      description: detailsForm.description.trim() || null,
      age_min: detailsForm.age_min.trim() ? Number(detailsForm.age_min.trim()) : null,
      age_max: detailsForm.age_max.trim() ? Number(detailsForm.age_max.trim()) : null,
    }
    const patchRes = await fetch('/api/admin/books', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody),
    })
    const patchJson = await patchRes.json()
    if (patchJson.error) { console.error('[saveDetails] PATCH error:', patchJson.error); setError(`Save failed: ${patchJson.error}`); setSavingDetails(false); return }
    const updated = {
      ...selectedBook,
      title: detailsForm.title.trim() || selectedBook.title, author: detailsForm.author.trim() || selectedBook.author,
      isbn: detailsForm.isbn.trim() || null,
      publisher: detailsForm.publisher.trim() || null, illustrator: detailsForm.illustrator.trim() || null, publication_date: detailsForm.publication_date.trim() || null, is_non_fiction: detailsForm.is_non_fiction,
      page_count: detailsForm.page_count.trim() ? Number(detailsForm.page_count.trim()) : null,
      book_type: detailsForm.book_type.trim() || null,
      series_id: seriesId || null,
      series_number: seriesId ? seriesNum : null,
      search_tags: tags.length > 0 ? tags : null,
      description: detailsForm.description.trim() || null,
      age_min: detailsForm.age_min.trim() ? Number(detailsForm.age_min.trim()) : null,
      age_max: detailsForm.age_max.trim() ? Number(detailsForm.age_max.trim()) : null,
    }
    setBooks(prev => prev.map(b => b.id === selectedBook.id ? updated : b))
    setSelectedBook(updated)
    setSavingDetails(false)
    setSavedOk(true)
    setTimeout(() => setSavedOk(false), 2000)
  }

  // ── Upload helpers ─────────────────────────────────────────────────────────

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function patchBook(id: string, fields: object) {
    await fetch('/api/admin/books', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...fields }) })
  }

  async function uploadCover(file: File, bookId: string) {
    setUploadingCoverFor(bookId); setError(null)
    const base64 = await fileToBase64(file)
    const res = await fetch('/api/admin/books', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: bookId, bucket: 'book-covers', base64, field: 'cover_image_url' }) })
    const json = await res.json()
    if (json.error) { setError(`Cover upload failed: ${json.error}`); setUploadingCoverFor(null); return }
    setBooks(prev => prev.map(b => b.id === bookId ? { ...b, cover_image_url: json.publicUrl } : b))
    setSelectedBook(prev => prev?.id === bookId ? { ...prev, cover_image_url: json.publicUrl } : prev)
    setUploadingCoverFor(null)
  }

  async function uploadCoverDataUrl(base64: string, bookId: string) {
    setUploadingCoverFor(bookId); setError(null)
    const res = await fetch('/api/admin/books', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: bookId, bucket: 'book-covers', base64, field: 'cover_image_url' }) })
    const json = await res.json()
    if (json.error) { setError(`Cover upload failed: ${json.error}`); setUploadingCoverFor(null); return }
    setBooks(prev => prev.map(b => b.id === bookId ? { ...b, cover_image_url: json.publicUrl } : b))
    setSelectedBook(prev => prev?.id === bookId ? { ...prev, cover_image_url: json.publicUrl } : prev)
    setUploadingCoverFor(null)
  }

  // ── Fetch & enrich book ────────────────────────────────────────────────────

  async function fetchBookInfo(query: string, isIsbn: boolean, volumeId?: string) {
    const myLookup = ++lookupIdRef.current
    setFetchLoading(true); setFetchError(null); setFetchResults([])
    try {
      const res = await fetch('/api/admin/enrich-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(volumeId
          ? { volumeId, bookData: fetchResults.find(r => r.volumeId === volumeId), categoryNames: categories.map(c => c.name) }
          : { query, isIsbn, categoryNames: categories.map(c => c.name) }),
      })
      const data = await res.json()
      if (myLookup !== lookupIdRef.current) return   // a newer lookup (or Clear) has replaced this one

      if (data.results) {
        if (data.results.length === 0) { setFetchError('No books found. Try a different title or ISBN.') }
        else { setFetchResults(data.results) }
        setFetchLoading(false); return
      }

      // Single book returned — fill form
      const { book, enrichment } = data
      applyFetchedBook(book, enrichment)
    } catch {
      if (myLookup === lookupIdRef.current) setFetchError('Fetch failed. Check your connection and try again.')
    }
    if (myLookup === lookupIdRef.current) setFetchLoading(false)
  }

  function applyFetchedBook(book: any, enrichment: any) {
    setError(null)
    setDescNeedsCheck(!!enrichment?.description_needs_check || !enrichment?.description || !book?.publisherBlurb)   // no publisher blurb = less reliable
    setFetchResults([])

    // Match series in DB
    let mainSeriesId = ''
    let finalSeriesId = ''
    if (enrichment?.series_name) {
      const match = seriesList.find(s => !s.parent_series_id &&
        s.name.toLowerCase().trim() === enrichment.series_name.toLowerCase().trim())
      if (match) {
        mainSeriesId = match.id
        if (enrichment.sub_series_name) {
          const subMatch = seriesList.find(s => s.parent_series_id === match.id &&
            s.name?.toLowerCase().trim() === enrichment.sub_series_name.toLowerCase().trim())
          if (subMatch) finalSeriesId = subMatch.id
        }
        if (!finalSeriesId) finalSeriesId = match.id
      } else {
        // Series not in DB — pre-fill new series name
        setAddNewSeriesMode(true)
        setAddNewSeriesName(enrichment.series_name)
      }
    }

    setAddMainSeriesId(mainSeriesId)
    // Pre-fill sub-series fields from enrichment
    setAddSubSeriesName(enrichment?.sub_series_name || '')
    setAddSubSeriesNumber(enrichment?.sub_series_number ? String(enrichment.sub_series_number) : '')
    setFetchedCoverBase64(book.coverBase64 || null)
    setCoverMayBeOther(!!book.coverNotEnglish)

    // Map Claude's reading level names to IDs
    const levelIds = new Set<string>(
      (enrichment?.reading_levels || [])
        .map((name: string) => readingLevels.find(l => l.name === name)?.id)
        .filter(Boolean) as string[]
    )
    setAddLevelIds(levelIds)

    // Map Claude's category names to IDs
    const catIds = new Set<string>(
      (enrichment?.categories || [])
        .map((name: string) => categories.find(c => c.name === name)?.id)
        .filter(Boolean) as string[]
    )
    setAddCategoryIds(catIds)

    setAddForm({
      title: book.title || '',
      author: book.author || '',
      isbn: book.isbn || '',
      publisher: book.publisher || '', illustrator: book.illustrator || enrichment?.illustrator || '', publication_date: book.publicationDate || '', is_non_fiction: !!enrichment?.non_fiction,
      page_count: book.pageCount ? String(book.pageCount) : '',
      book_type: enrichment?.book_type || '',
      series_number: enrichment?.book_number ? String(enrichment.book_number) : '',
      reading_level_id: '',
      tags: (enrichment?.tags || []).join(', '),
      description: enrichment?.description || '',
      age_min: enrichment?.age_min != null ? String(enrichment.age_min) : '',
      age_max: enrichment?.age_max != null ? String(enrichment.age_max) : '',
    })
  }

  // ── Add book ───────────────────────────────────────────────────────────────

  async function handleAddBook() {
    if (fetchLoading) { setError('Still looking the book up. One moment, then add it.'); return }
    if (!addForm.title.trim() || !addForm.author.trim()) { setError('Title and author are required.'); return }
    const same = bookWithIsbn(addForm.isbn)
    if (same && !allowDuplicate) { setError(`"${same.title}" with this ISBN is already in the library — open it and add a copy instead, or tick "Add as a new book anyway".`); return }
    setAddingBook(true); setError(null)

    let seriesId: string | null = null
    // Resolve main series
    let mainSeriesId = addMainSeriesId
    if (addNewSeriesMode && addNewSeriesName.trim()) {
      const data = await createSeriesViaApi({ name: addNewSeriesName.trim() })
      if (!data) { setAddingBook(false); return }
      setSeriesList(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      mainSeriesId = data.id
    }

    if (mainSeriesId) {
      const subName = addSubSeriesName.trim()
      const subNum = addSubSeriesNumber.trim() ? Number(addSubSeriesNumber.trim()) : null
      if (subName || subNum !== null) {
        // Check if matching sub-series already exists
        const existing = seriesList.find(s =>
          s.parent_series_id === mainSeriesId &&
          (subName ? s.name?.toLowerCase() === subName.toLowerCase() : s.series_number === subNum)
        )
        if (existing) {
          seriesId = existing.id
        } else {
          const data = await createSeriesViaApi({ name: subName || null, parent_series_id: mainSeriesId, series_number: subNum })
          if (!data) { setAddingBook(false); return }
          setSeriesList(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
          seriesId = data.id
        }
      } else {
        seriesId = mainSeriesId
      }
    }

    const tags = addForm.tags.split(',').map(t => t.trim()).filter(Boolean)
    const seriesNum = addForm.series_number.trim() ? Number(addForm.series_number.trim()) : null

    let internalId: string
    if (addLabel.trim()) {
      const code = normaliseCopyLabel(addLabel)
      if (!code) { setError('That copy label doesn’t look right — it should be like CUR-0042.'); setAddingBook(false); return }
      if (await labelInUse(code)) { setError(`${code} is already on another book. Use the next label.`); setAddingBook(false); return }
      internalId = code
    } else internalId = await nextCopyId()
    const res = await fetch('/api/admin/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        internalId,
        coverBase64: fetchedCoverBase64 || null,
        book: {
          title: addForm.title.trim(), author: addForm.author.trim(),
          isbn: addForm.isbn.trim() || null,
          publisher: addForm.publisher.trim() || null, illustrator: addForm.illustrator.trim() || null, publication_date: addForm.publication_date.trim() || null, is_non_fiction: addForm.is_non_fiction,
          page_count: addForm.page_count.trim() ? Number(addForm.page_count.trim()) : null,
          book_type: addForm.book_type.trim() || null,
          series_id: seriesId, series_number: seriesId ? seriesNum : null,
          reading_level_id: addForm.reading_level_id || null,
          search_tags: tags.length > 0 ? tags : null,
          description: addForm.description.trim() || null,
          age_min: addForm.age_min.trim() ? Number(addForm.age_min.trim()) : null,
          age_max: addForm.age_max.trim() ? Number(addForm.age_max.trim()) : null,
          is_active: true,
        },
      }),
    })
    const json = await res.json()
    if (json.error) { setError(`Add book failed: ${json.error}`); setAddingBook(false); return }
    const newBook = json.book
    const newCopy = json.copy
    if (json.copyError) setError(`Book added, but copy creation failed: ${json.copyError}`)

    let finalBook = { ...newBook }

    // cover was already uploaded server-side if fetchedCoverBase64 was passed
    // handle manually selected cover file
    if (addCoverFile && !fetchedCoverBase64) {
      const base64 = await fileToBase64(addCoverFile)
      const r = await fetch('/api/admin/books', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: newBook.id, bucket: 'book-covers', base64, field: 'cover_image_url' }) })
      const u = await r.json()
      if (u.publicUrl) finalBook = { ...finalBook, cover_image_url: u.publicUrl }
    }

    if (addLevelIds.size > 0) {
      const rows = [...addLevelIds].map(lid => ({ book_id: newBook.id, reading_level_id: lid }))
      await supabase.from('book_reading_levels').insert(rows)
      setLevelAssignments(prev => ({ ...prev, [newBook.id]: new Set(addLevelIds) }))
    }
    if (addCategoryIds.size > 0) {
      const rows = [...addCategoryIds].map(cid => ({ book_id: newBook.id, category_id: cid }))
      await supabase.from('book_categories').insert(rows)
      setAssignments(prev => ({ ...prev, [newBook.id]: new Set(addCategoryIds) }))
    }
    setBooks(prev => [...prev, finalBook].sort((a, b) => a.title.localeCompare(b.title)))
    if (newCopy) setCopies(prev => ({ ...prev, [newBook.id]: [newCopy] }))

    // Open new book in detail panel, with a clear "added" message
    setJustAdded({ id: finalBook.id, title: finalBook.title, code: newCopy?.internal_id ?? null })
    setSelectedBook(finalBook)
    setPanelMode('detail')
    setExpandedCopyId(null)
    setEditMainSeriesId(seriesId || '')
    setNewSeriesMode(false); setNewSeriesName('')
    setNewSubSeriesMode(false); setNewSubSeriesName(''); setNewSubSeriesNumber('')
    setDetailsForm({
      title: finalBook.title || '', author: finalBook.author || '',
      isbn: finalBook.isbn || '',
      publisher: finalBook.publisher || '', illustrator: finalBook.illustrator || '', publication_date: finalBook.publication_date || '', is_non_fiction: !!finalBook.is_non_fiction,
      page_count: finalBook.page_count != null ? String(finalBook.page_count) : '',
      book_type: finalBook.book_type || '',
      series_id: seriesId || '',
      series_number: finalBook.series_number != null ? String(finalBook.series_number) : '',
      reading_level_id: finalBook.reading_level_id || '',
      tags: (finalBook.search_tags || []).join(', '),
      description: finalBook.description || '',
      age_min: finalBook.age_min != null ? String(finalBook.age_min) : '',
      age_max: finalBook.age_max != null ? String(finalBook.age_max) : '',
    })

    resetAddForm()
    setAddingBook(false)
  }

  // empty the add form (after adding, or "Clear and start again" when a lookup found the wrong book)
  function resetAddForm() {
    lookupIdRef.current++   // a lookup still running won't refill the form
    setFetchLoading(false); setFetchError(null)
    setAddForm({ title: '', author: '', isbn: '', publisher: '', illustrator: '', publication_date: '', is_non_fiction: false, page_count: '', book_type: '', series_number: '', reading_level_id: '', tags: '', description: '', age_min: '', age_max: '' })
    setAddMainSeriesId('')
    setAddNewSeriesMode(false); setAddNewSeriesName('')
    setAddSubSeriesName(''); setAddSubSeriesNumber('')
    setAddCoverFile(null)
    if (addCoverRef.current) addCoverRef.current.value = ''
    setFetchQuery(''); setFetchedCoverBase64(null); setFetchResults([]); setAddLabel(''); setAllowDuplicate(false)
    setAddLevelIds(new Set()); setAddCategoryIds(new Set())
    setDescNeedsCheck(false); setCoverMayBeOther(false); setSuggestions([])
  }

  // ── Collectible generation ─────────────────────────────────────────────────

  async function generateCollectible(book: Book, mode: 'new' | 'retry' | 'revise', feedbackText?: string, customPrompt?: string) {
    startGenerating(book.id)
    setShowCollectibleFeedback(false)
    setCollectibleFeedback('')
    const res = await fetch('/api/admin/generate-collectible', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookId: book.id,
        mode,
        previousResponseId: book.collectible_openai_response_id,
        feedback: feedbackText,
        customPrompt,
      }),
    })
    const json = await res.json()
    if (res.ok) {
      const updated: Book = {
        ...book,
        collectible_status: 'awaiting_approval',
        collectible_name: json.collectible_name,
        collectible_concept: json.collectible_concept,
        collectible_lore: json.collectible_lore,
        collectible_image_url: json.collectible_image_url,
        collectible_openai_response_id: json.collectible_openai_response_id,
        collectible_version: json.collectible_version,
        collectible_source_moment: json.collectible_source_moment || null,
        collectible_research: json.collectible_research ? JSON.stringify(json.collectible_research) : null,
      }
      setBooks(prev => prev.map(b => b.id === book.id ? updated : b))
      setSelectedBook(prev => prev?.id === book.id ? updated : prev)
    } else {
      setError(`Collectible generation failed: ${json.error}`)
    }
    stopGenerating(book.id)
  }

  async function collectibleStepCall(book: Book, step: 'generate' | 'draw' | 'polish', extra: Record<string, unknown>) {
    setCollectibleStep(step); startGenerating(book.id); setError(null)
    try {
      const res = await fetch('/api/admin/generate-collectible', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: book.id, step, ...extra }),
      })
      const json = await res.json().catch(() => ({ error: 'The server took too long — try again.' }))
      if (!res.ok) { setError(`Collectible: ${json.error || 'something went wrong'}`); return }
      let updated: Book = book
      updated = {
        ...book, collectible_status: 'awaiting_approval', collectible_name: json.collectible_name, collectible_concept: json.collectible_concept,
        collectible_lore: json.collectible_lore, collectible_image_url: json.collectible_image_url, collectible_openai_response_id: json.collectible_openai_response_id,
        collectible_version: json.collectible_version, collectible_source_moment: json.collectible_source_moment || null,
        collectible_research: json.collectible_research ? JSON.stringify(json.collectible_research) : book.collectible_research,
      }
      setBooks(prev => prev.map(b => b.id === book.id ? updated : b)); setSelectedBook(prev => prev?.id === book.id ? updated : prev)   // only if that book is still open
    } finally { stopGenerating(book.id); setCollectibleStep(null) }
  }

  async function approveCollectible(bookId: string) {
    const res = await fetch('/api/admin/generate-collectible', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, action: 'approve' }),
    })
    if (res.ok) {
      setBooks(prev => prev.map(b => b.id === bookId ? { ...b, collectible_status: 'approved' } : b))
      setSelectedBook(prev => prev?.id === bookId ? { ...prev, collectible_status: 'approved' } : prev)
    }
  }

  async function rejectCollectible(bookId: string) {
    const res = await fetch('/api/admin/generate-collectible', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, action: 'reject' }),
    })
    if (res.ok) {
      const back = (books.find(b => b.id === bookId)?.collectible_options || []).length > 0
      const reset = { collectible_status: back ? 'options' : null, collectible_name: null, collectible_concept: null, collectible_lore: null, collectible_image_url: null, collectible_openai_response_id: null, collectible_version: null, collectible_source_moment: null, collectible_research: null }
      setBooks(prev => prev.map(b => b.id === bookId ? { ...b, ...reset } : b))
      setSelectedBook(prev => prev?.id === bookId ? { ...prev, ...reset } : prev)
    }
  }

  // ── Copies ─────────────────────────────────────────────────────────────────

  async function addCopy(bookId: string) {
    setAddingCopy(true); setError(null)
    let internalId: string
    if (copyLabel.trim()) {
      const code = normaliseCopyLabel(copyLabel)
      if (!code) { setError('That copy label doesn’t look right — it should be like CUR-0042.'); setAddingCopy(false); return }
      if (await labelInUse(code)) { setError(`${code} is already on another book. Use the next label.`); setAddingCopy(false); return }
      internalId = code
    } else internalId = await nextCopyId()
    const { data, error: e } = await supabase.from('book_copies')
      .insert({ book_id: bookId, internal_id: internalId, status: 'available' })
      .select('id, book_id, internal_id, status, created_at').single()
    if (e) { setError(`Add copy failed: ${e.message}`); setAddingCopy(false); return }
    setCopies(prev => ({ ...prev, [bookId]: [...(prev[bookId] || []), data] }))
    setAddingCopy(false); setCopyLabel(''); setAddingCopyOf(null)
    // anyone waiting on this book (Notify Me) hears it's back
    fetch('/api/admin/notify-me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookIds: [bookId] }) }).catch(() => {})
  }

  async function archiveCopy(copyId: string, bookId: string) {
    const { error: e } = await supabase.from('book_copies').update({ status: 'retired' }).eq('id', copyId)
    if (e) { setError(`Archive failed: ${e.message}`); return }
    setCopies(prev => ({ ...prev, [bookId]: (prev[bookId] || []).map(c => c.id === copyId ? { ...c, status: 'retired' } : c) }))
  }

  async function deleteBook(bookId: string) {
    const res = await fetch('/api/admin/books', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: bookId }) })
    const json = await res.json()
    if (json.error) { setError(`Delete failed: ${json.error}`); return }
    setBooks(prev => prev.filter(b => b.id !== bookId))
    closePanel()
  }

  async function toggleCopyLoans(copyId: string) {
    if (expandedCopyId === copyId) { setExpandedCopyId(null); return }
    setExpandedCopyId(copyId)
    if (copyLoans[copyId]) return
    setLoadingLoans(copyId)
    const { data, error: e } = await supabase
      .from('loans')
      .select('id, status, created_at, returned_at, child_profiles(name)')
      .eq('book_copy_id', copyId)
      .order('created_at', { ascending: false })
    if (e) { setError(`Loans load failed: ${e.message}`); setLoadingLoans(null); return }
    setCopyLoans(prev => ({ ...prev, [copyId]: (data || []).map((l: any) => ({ id: l.id, status: l.status, created_at: l.created_at, returned_at: l.returned_at, child_name: (l.child_profiles as any)?.name || null })) }))
    setLoadingLoans(null)
  }

  // ── Utils ──────────────────────────────────────────────────────────────────

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const filtered = books.filter(b =>
    (!onlyNoCover || !b.cover_image_url) && (!onlyNoAsset || b.collectible_status !== 'approved') && (
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    b.author.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => sortNewest ? (b.created_at || '').localeCompare(a.created_at || '') : a.title.localeCompare(b.title))

  if (loading) return <div style={{ padding: '32px', fontSize: '14px', color: '#6b6b6b' }}>Loading…</div>

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Left: book list ────────────────────────────────────────────── */}
      <div style={{
        width: panelMode ? '340px' : '100%', flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        borderRight: panelMode ? '1px solid #e5e5e5' : 'none',
        overflow: 'hidden',
      }}>
        {/* Toolbar */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e5e5', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ flex: 1, fontWeight: 700, fontSize: '15px', color: '#1a1a1a' }}>Books</span>
          <a href="/admin/books/labels" style={{ fontSize: '13px', fontWeight: 600, color: '#1a2f51', textDecoration: 'none', padding: '8px 12px', border: '1px solid #e5e5e5', borderRadius: '8px', marginRight: '8px' }}>🏷 Print labels</a>
          <Btn onClick={() => { setSelectedBook(null); setPanelMode('add') }}>+ Add Book</Btn>
        </div>
        {/* Search */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e5e5' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input style={{ ...inp, flex: 1 }} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
            <select style={{ ...inp, width: 'auto' }} value={sortNewest ? 'new' : 'az'} onChange={e => setSortNewest(e.target.value === 'new')}>
              <option value="az">A–Z</option>
              <option value="new">Newest first</option>
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '12px', color: '#4a4a4a', cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyNoCover} onChange={e => setOnlyNoCover(e.target.checked)} />
            Only books without a cover ({books.filter(b => !b.cover_image_url).length})
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '12px', color: '#4a4a4a', cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyNoAsset} onChange={e => setOnlyNoAsset(e.target.checked)} />
            Only books without an approved collectible ({books.filter(b => b.collectible_status !== 'approved').length})
          </label>
        </div>
        {/* Error bar */}
        {error && (
          <div style={{ margin: '8px 16px', padding: '8px 12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#dc2626', fontSize: '12px' }}>
            ⚠ {error}
          </div>
        )}
        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.map(book => {
            const bc = copies[book.id] || []
            const active = bc.filter(c => c.status !== 'retired')
            const avail = active.filter(c => c.status === 'available').length
            const out = active.filter(c => c.status === 'checked_out' || c.status === 'active').length
            const isSelected = selectedBook?.id === book.id && panelMode === 'detail'

            let copyLine = 'No copies'
            if (active.length === 1) copyLine = `1 copy — ${avail ? 'available' : out ? 'out' : active[0].status}`
            else if (active.length > 1) {
              const parts = []
              if (avail) parts.push(`${avail} available`)
              if (out) parts.push(`${out} out`)
              copyLine = `${active.length} copies${parts.length ? ' — ' + parts.join(' · ') : ''}`
            }

            return (
              <div
                key={book.id}
                onClick={() => openBook(book)}
                style={{
                  display: 'flex', gap: '12px', padding: '10px 16px', cursor: 'pointer',
                  backgroundColor: isSelected ? '#f5f5f5' : 'transparent',
                  borderLeft: isSelected ? '3px solid #1a1a1a' : '3px solid transparent',
                }}
              >
                <div style={{ width: '36px', height: '54px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, backgroundColor: '#e8e8e8' }}>
                  {book.cover_image_url && <HoverCover src={book.cover_image_url} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</p>
                  <p style={{ margin: '1px 0 4px', fontSize: '12px', color: '#6b6b6b' }}>{book.author}</p>
                  <p style={{ margin: 0, fontSize: '11px', color: active.length === 0 ? '#dc2626' : '#9b9b9b' }}>{copyLine}</p>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <p style={{ textAlign: 'center', color: '#9b9b9b', fontSize: '13px', padding: '40px 16px' }}>No books found.</p>
          )}
        </div>
      </div>

      {/* ── Right: detail / add panel ──────────────────────────────────── */}
      {panelMode && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Panel header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <span style={{ flex: 1, fontWeight: 700, fontSize: '15px', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {panelMode === 'add' ? 'Add New Book' : (selectedBook?.title || '')}
              {panelMode !== 'add' && selectedBook?.created_at && <span style={{ display: 'block', fontWeight: 400, fontSize: '12px', color: '#9b9b9b', marginTop: '2px' }}>Added {fmtDate(selectedBook.created_at)}</span>}
            </span>
            <button onClick={closePanel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', color: '#9b9b9b', padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}>×</button>
          </div>

          <div ref={panelScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

            {scanFor && (
              <EnvelopeScanner
                title={scanFor === 'isbn' ? 'Scan the ISBN barcode (back of the book)' : 'Scan the CUR label'}
                placeholder={scanFor === 'isbn' ? 'e.g. 9780747532699' : 'e.g. CUR-0042'}
                onClose={() => setScanFor(null)}
                onCode={code => {
                  const target = scanFor
                  setScanFor(null)
                  if (target === 'isbn') { setFetchQuery(code); lookUpOrOpen(code, true) }
                  else if (target === 'addLabel') setAddLabel(code)
                  else setCopyLabel(code)
                }} />
            )}

            {/* ── ADD BOOK FORM ── */}
            {panelMode === 'add' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '580px' }}>

                {/* Search bar */}
                <div style={{ backgroundColor: '#f7f7f7', borderRadius: '10px', padding: '14px' }}>
                  <label style={lbl}>Search by title or ISBN</label>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px', position: 'relative' }}>
                    <input
                      style={{ ...inp, flex: 1 }}
                      placeholder="e.g. Harry Potter or 9780747532699"
                      value={fetchQuery}
                      onChange={e => { setFetchQuery(e.target.value); setSuggestOpen(true) }}
                      onFocus={() => setSuggestOpen(true)}
                      onBlur={() => setTimeout(() => setSuggestOpen(false), 200)}
                      onKeyDown={e => { if (e.key === 'Escape') setSuggestOpen(false); if (e.key === 'Enter' && fetchQuery.trim()) { setSuggestOpen(false); const q = fetchQuery.trim(); lookUpOrOpen(q, /^\d[\d\-]{8,}$/.test(q)) } }}
                    />
                    {suggestOpen && suggestions.length > 0 && !fetchLoading && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', zIndex: 50, backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: '420px', overflowY: 'auto' }}>
                        {suggestions.map(sg => (
                          <button key={sg.isbn} type="button" onMouseDown={e => e.preventDefault()} onClick={() => pickSuggestion(sg.isbn)}
                            style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%', padding: '8px 10px', border: 'none', borderBottom: '1px solid #f0f0f0', backgroundColor: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                            {sg.thumbnail ? <img src={sg.thumbnail} alt="" style={{ width: '30px', height: '45px', objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }} /> : <div style={{ width: '30px', height: '45px', borderRadius: '3px', backgroundColor: '#eee', flexShrink: 0 }} />}
                            <div style={{ minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>{sg.title}</p>
                              <p style={{ margin: '1px 0 0', fontSize: '12px', color: '#6b6b6b' }}>{[sg.author, sg.year, sg.publisher].filter(Boolean).join(' · ')}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    <Btn variant="secondary" onClick={() => setScanFor('isbn')}>📷 Scan</Btn>
                    <Btn
                      onClick={() => { const q = fetchQuery.trim(); if (q) lookUpOrOpen(q, /^\d[\d\-]{8,}$/.test(q)) }}
                      disabled={fetchLoading || !fetchQuery.trim()}
                    >
                      {fetchLoading ? 'Fetching…' : 'Fetch'}
                    </Btn>
                  </div>
                  {fetchError && <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#dc2626' }}>{fetchError}</p>}
                  {(() => {
                    const isbn = (addForm.isbn || fetchQuery).replace(/[^0-9X]/gi, '')
                    const already = isbn.length >= 10 ? books.find(b => (b.isbn || '').replace(/[^0-9X]/gi, '') === isbn) : null
                    return already ? (
                      <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '8px', backgroundColor: '#fff7e6', border: '1px solid #f3d18a', fontSize: '13px', color: '#1a1a1a' }}>
                        <strong>{already.title}</strong> is already in the library.{' '}
                        <button onClick={() => openBook(already)} style={{ background: 'none', border: 'none', padding: 0, color: '#1a2f51', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>Open it to add another copy</button>
                      </div>
                    ) : null
                  })()}
                  {fetchResults.length > 0 && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 600, color: '#6b6b6b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pick the right edition</p>
                      {fetchResults.map(r => (
                        <button key={r.volumeId} onClick={() => fetchBookInfo('', false, r.volumeId)}
                          style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e5e5', backgroundColor: '#ffffff', cursor: 'pointer', textAlign: 'left' }}>
                          {r.thumbnailUrl && <img src={r.thumbnailUrl.replace('http://', 'https://')} alt="" style={{ width: '28px', height: '42px', objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }} />}
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</p>
                            <p style={{ margin: '1px 0 0', fontSize: '12px', color: '#6b6b6b' }}>{r.author}{r.pageCount ? ` · ${r.pageCount}pp` : ''}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {fetchedCoverBase64 && (
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img src={fetchedCoverBase64} alt="cover" style={{ width: '36px', height: '54px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e5e5e5' }} />
                      <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>Cover fetched ✓</span>
                      <button onClick={() => setFetchedCoverBase64(null)} style={{ background: 'none', border: 'none', color: '#9b9b9b', cursor: 'pointer', fontSize: '12px', marginLeft: '4px' }}>remove</button>
                    </div>
                  )}
                  {!fetchedCoverBase64 && coverMayBeOther && (
                    <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#b45309', fontWeight: 600 }}>⚠ The cover found wasn't in English, so it was left out. Please photograph your copy below.</p>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div><label style={lbl}>Title *</label><input style={inp} value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))} /></div>
                  <div><label style={lbl}>Author *</label><input style={inp} value={addForm.author} onChange={e => setAddForm(f => ({ ...f, author: e.target.value }))} /></div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div><label style={lbl}>Illustrator</label><input style={inp} value={addForm.illustrator} onChange={e => setAddForm(f => ({ ...f, illustrator: e.target.value }))} /></div>
                  <div><label style={lbl}>Publisher</label><input style={inp} value={addForm.publisher} onChange={e => setAddForm(f => ({ ...f, publisher: e.target.value }))} /></div>
                  <div><label style={lbl}>Publication date</label><input style={inp} placeholder="e.g. 2004" value={addForm.publication_date} onChange={e => setAddForm(f => ({ ...f, publication_date: e.target.value }))} /></div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1a1a1a', cursor: 'pointer' }}>
                  <input type="checkbox" checked={addForm.is_non_fiction} onChange={e => setAddForm(f => ({ ...f, is_non_fiction: e.target.checked }))} />
                  Non-fiction <span style={{ color: '#9b9b9b' }}>(admin only — "non-fiction" in the search finds it)</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div><label style={lbl}>ISBN</label><input style={inp} value={addForm.isbn} onChange={e => setAddForm(f => ({ ...f, isbn: e.target.value }))} /></div>
                  <div>
                    <label style={lbl}>Age groups</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '2px' }}>
                      {readingLevels.map(level => {
                        const isOn = addLevelIds.has(level.id)
                        return (
                          <button key={level.id} type="button"
                            onClick={() => setAddLevelIds(prev => {
                              const next = new Set(prev)
                              isOn ? next.delete(level.id) : next.add(level.id)
                              return next
                            })}
                            style={{ padding: '4px 10px', borderRadius: '999px', border: '1px solid #e5e5e5', fontSize: '12px', fontWeight: 500, cursor: 'pointer', backgroundColor: isOn ? '#1a1a1a' : '#f7f7f7', color: isOn ? '#fff' : '#4a4a4a' }}>
                            {level.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                  <div><label style={lbl}>Pages</label><input style={inp} type="number" placeholder="256" value={addForm.page_count} onChange={e => setAddForm(f => ({ ...f, page_count: e.target.value }))} /></div>
                  <div>
                    <label style={lbl}>Book Type</label>
                    <select style={inp} value={addForm.book_type} onChange={e => setAddForm(f => ({ ...f, book_type: e.target.value }))}>
                      <option value="">Not set</option>
                      {['Picture Book','Board Book','Flap Book','Early Reader','Chapter Book','Illustrated Book','Graphic Novel','Novel'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div><label style={lbl}>Age from</label><input style={inp} type="number" placeholder="7" value={addForm.age_min} onChange={e => setAddForm(f => ({ ...f, age_min: e.target.value }))} /></div>
                  <div><label style={lbl}>Age to</label><input style={inp} type="number" placeholder="10" value={addForm.age_max} onChange={e => setAddForm(f => ({ ...f, age_max: e.target.value }))} /></div>
                </div>

                {/* Series */}
                <div>
                  <label style={lbl}>Series Name</label>
                  {!addNewSeriesMode ? (
                    <select style={inp} value={addMainSeriesId} onChange={e => {
                      if (e.target.value === '__new__') { setAddNewSeriesMode(true); setAddMainSeriesId(''); return }
                      setAddMainSeriesId(e.target.value)
                    }}>
                      <option value="">Not part of a series</option>
                      {seriesList.filter(s => !s.parent_series_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      <option value="__new__">+ Add new series…</option>
                    </select>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input style={inp} placeholder="New series name" value={addNewSeriesName} onChange={e => setAddNewSeriesName(e.target.value)} />
                      <button onClick={() => { setAddNewSeriesMode(false); setAddNewSeriesName('') }} style={{ background: 'none', border: 'none', color: '#9b9b9b', cursor: 'pointer', fontSize: '17px' }}>×</button>
                    </div>
                  )}
                </div>
                {(addMainSeriesId || addNewSeriesMode) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={lbl}>Sub-series No.</label>
                      <input style={inp} type="number" placeholder="e.g. 3" value={addSubSeriesNumber} onChange={e => setAddSubSeriesNumber(e.target.value)} />
                    </div>
                    <div>
                      <label style={lbl}>Sub-series Name</label>
                      <input style={inp} placeholder="e.g. The Dark Realm" value={addSubSeriesName} onChange={e => setAddSubSeriesName(e.target.value)} />
                    </div>
                    <div>
                      <label style={lbl}>Book Number</label>
                      <input style={inp} type="number" placeholder="1" value={addForm.series_number} onChange={e => setAddForm(f => ({ ...f, series_number: e.target.value }))} />
                    </div>
                  </div>
                )}

                <div><label style={lbl}>Tags (comma separated)</label><input style={inp} placeholder="dragons, friendship, funny" value={addForm.tags} onChange={e => setAddForm(f => ({ ...f, tags: e.target.value }))} /></div>

                <div>
                  <label style={lbl}>Description</label>
                  <textarea style={{ ...inp, minHeight: '80px', resize: 'vertical' }} placeholder="A short description of the book…" value={addForm.description} onChange={e => { setDescNeedsCheck(false); setAddForm(f => ({ ...f, description: e.target.value })) }} />
                  {descNeedsCheck && addForm.title && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#b45309' }}>⚠ No publisher blurb was found for this book, so the AI had less to go on. Please check the description against the back cover.</p>}
                </div>

                <div>
                  <label style={lbl}>Categories</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                    {categories.map(cat => {
                      const isOn = addCategoryIds.has(cat.id)
                      return (
                        <button key={cat.id} type="button"
                          onClick={() => setAddCategoryIds(prev => {
                            const next = new Set(prev)
                            isOn ? next.delete(cat.id) : next.add(cat.id)
                            return next
                          })}
                          style={{ padding: '5px 13px', borderRadius: '999px', border: '1px solid #e5e5e5', fontSize: '12px', fontWeight: 500, cursor: 'pointer', backgroundColor: isOn ? '#1a1a1a' : '#f7f7f7', color: isOn ? '#fff' : '#4a4a4a' }}>
                          {cat.name}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div><label style={lbl}>Cover image {fetchedCoverBase64 ? '(replace)' : ''}</label><CoverPicker onPicked={url => { setFetchedCoverBase64(url); setCoverMayBeOther(false) }} /></div>

                <div style={{ backgroundColor: '#f7f7f7', borderRadius: '10px', padding: '14px' }}>
                  <label style={lbl}>Copy label (the CUR sticker on this book)</label>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    <input style={{ ...inp, flex: 1 }} placeholder="Scan or type, e.g. CUR-0042" value={addLabel}
                      onChange={e => setAddLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && addLabel.trim()) handleAddBook() }} />
                    <Btn variant="secondary" onClick={() => setScanFor('addLabel')}>📷 Scan</Btn>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#6b6b6b' }}>Left empty, the next free number is used — print that label afterwards.</p>
                </div>
                {error && <p style={{ color: '#dc2626', fontSize: '13px', margin: 0 }}>⚠ {error}</p>}
                {bookWithIsbn(addForm.isbn) && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#6b6b6b', cursor: 'pointer' }}>
                    <input type="checkbox" checked={allowDuplicate} onChange={e => setAllowDuplicate(e.target.checked)} />
                    Add as a new book anyway (only for a genuinely different edition)
                  </label>
                )}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Btn onClick={handleAddBook} disabled={addingBook || fetchLoading} style={{ flex: 1 }}>{addingBook ? 'Adding…' : fetchLoading ? 'Looking it up…' : 'Add Book'}</Btn>
                  {(addForm.title || addForm.isbn || fetchedCoverBase64 || fetchLoading || fetchQuery) && !addingBook && (
                    <Btn variant="secondary" onClick={() => { resetAddForm(); panelScrollRef.current?.scrollTo({ top: 0 }) }}>✕ Clear and start again</Btn>
                  )}
                </div>
              </div>
            )}

            {/* ── BOOK DETAIL ── */}
            {panelMode === 'detail' && selectedBook && detailsForm && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '620px' }}>

                {justAdded?.id === selectedBook.id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '10px 12px', borderRadius: '8px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '13px', color: '#166534' }}>
                    <span style={{ flex: 1 }}>✓ <strong>{justAdded.title}</strong> added{justAdded.code ? ` with copy ${justAdded.code}` : ''}.</span>
                    <Btn onClick={() => { setJustAdded(null); setSelectedBook(null); setPanelMode('add') }} style={{ fontSize: '12px', padding: '6px 12px' }}>+ Add the next book</Btn>
                  </div>
                )}
                {/* Cover + uploads */}
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ width: '72px', height: '108px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, backgroundColor: '#e8e8e8', position: 'relative' }}>
                    {selectedBook.cover_image_url && <HoverCover src={selectedBook.cover_image_url} />}
                    {uploadingCoverFor === selectedBook.id && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>…</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                    <div>
                      <label style={lbl}>{selectedBook.cover_image_url ? 'Cover — change it:' : 'Cover — add one:'}</label>
                      <CoverPicker busy={uploadingCoverFor === selectedBook.id} onPicked={url => uploadCoverDataUrl(url, selectedBook.id)} />
                    </div>
                  </div>
                </div>

                {/* Book details */}
                <div>
                  <p style={secHead}>Book details</p>
                  {error && <p style={{ color: '#dc2626', fontSize: '13px', margin: '0 0 8px', padding: '8px 12px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>⚠ {error}</p>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div><label style={lbl}>Title</label><input style={inp} value={detailsForm.title} onChange={e => setDetailsForm(f => f && ({ ...f, title: e.target.value }))} /></div>
                      <div><label style={lbl}>Author</label><input style={inp} value={detailsForm.author} onChange={e => setDetailsForm(f => f && ({ ...f, author: e.target.value }))} /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                      <div><label style={lbl}>Illustrator</label><input style={inp} value={detailsForm.illustrator} onChange={e => setDetailsForm(f => f && ({ ...f, illustrator: e.target.value }))} /></div>
                      <div><label style={lbl}>Publisher</label><input style={inp} value={detailsForm.publisher} onChange={e => setDetailsForm(f => f && ({ ...f, publisher: e.target.value }))} /></div>
                      <div><label style={lbl}>Publication date</label><input style={inp} placeholder="e.g. 2004" value={detailsForm.publication_date} onChange={e => setDetailsForm(f => f && ({ ...f, publication_date: e.target.value }))} /></div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1a1a1a', cursor: 'pointer' }}>
                      <input type="checkbox" checked={detailsForm.is_non_fiction} onChange={e => setDetailsForm(f => f && ({ ...f, is_non_fiction: e.target.checked }))} />
                      Non-fiction <span style={{ color: '#9b9b9b' }}>(admin only — "non-fiction" in the search finds it)</span>
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div><label style={lbl}>ISBN</label><input style={inp} value={detailsForm.isbn} onChange={e => setDetailsForm(f => f && ({ ...f, isbn: e.target.value }))} /></div>
                      <div>
                        <label style={lbl}>Age groups</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '2px' }}>
                          {readingLevels.map(level => {
                            const isOn = (levelAssignments[selectedBook.id] || new Set()).has(level.id)
                            const isSaving = savingLevel === `${selectedBook.id}-${level.id}`
                            return (
                              <button key={level.id} onClick={() => toggleReadingLevel(selectedBook.id, level.id)} disabled={!!savingLevel}
                                style={{ padding: '4px 10px', borderRadius: '999px', border: '1px solid #e5e5e5', fontSize: '12px', fontWeight: 500, cursor: savingLevel ? 'default' : 'pointer', backgroundColor: isOn ? '#1a1a1a' : '#f7f7f7', color: isOn ? '#fff' : '#4a4a4a', opacity: isSaving ? 0.5 : 1 }}>
                                {isSaving ? '…' : level.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                      <div><label style={lbl}>Pages</label><input style={inp} type="number" value={detailsForm.page_count} onChange={e => setDetailsForm(f => f && ({ ...f, page_count: e.target.value }))} /></div>
                      <div>
                        <label style={lbl}>Book Type</label>
                        <select style={inp} value={detailsForm.book_type} onChange={e => setDetailsForm(f => f && ({ ...f, book_type: e.target.value }))}>
                          <option value="">Not set</option>
                          {['Picture Book','Board Book','Flap Book','Early Reader','Chapter Book','Illustrated Book','Graphic Novel','Novel'].map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div><label style={lbl}>Age from</label><input style={inp} type="number" placeholder="7" value={detailsForm.age_min} onChange={e => setDetailsForm(f => f && ({ ...f, age_min: e.target.value }))} /></div>
                      <div><label style={lbl}>Age to</label><input style={inp} type="number" placeholder="10" value={detailsForm.age_max} onChange={e => setDetailsForm(f => f && ({ ...f, age_max: e.target.value }))} /></div>
                    </div>

                    {/* Series — Row 1: Series Name | Book Number */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={lbl}>Series Name</label>
                        {!newSeriesMode ? (
                          <select style={inp} value={editMainSeriesId} onChange={e => {
                            if (e.target.value === '__new__') { setNewSeriesMode(true); return }
                            setEditMainSeriesId(e.target.value)
                            setDetailsForm(f => f && ({ ...f, series_id: e.target.value }))
                            setNewSubSeriesMode(false); setNewSubSeriesName(''); setNewSubSeriesNumber('')
                          }}>
                            <option value="">Not part of a series</option>
                            {seriesList.filter(s => !s.parent_series_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            <option value="__new__">+ Add new series…</option>
                          </select>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <input style={{ ...inp, flex: 1 }} placeholder="New series name" value={newSeriesName} onChange={e => setNewSeriesName(e.target.value)} />
                            <button onClick={() => { setNewSeriesMode(false); setNewSeriesName('') }} style={{ background: 'none', border: 'none', color: '#9b9b9b', cursor: 'pointer', fontSize: '17px' }}>×</button>
                          </div>
                        )}
                      </div>
                      <div>
                        <label style={lbl}>Book Number</label>
                        <input style={inp} type="number" placeholder="1" value={detailsForm.series_number} onChange={e => setDetailsForm(f => f && ({ ...f, series_number: e.target.value }))} />
                      </div>
                    </div>
                    {/* Series — Row 2: Sub-series | Sub-series No. */}
                    {!!editMainSeriesId && !newSeriesMode && (
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={lbl}>Sub-series <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                          {!newSubSeriesMode ? (
                            <select style={inp}
                              value={seriesList.filter(s => s.parent_series_id === editMainSeriesId).some(s => s.id === detailsForm.series_id) ? detailsForm.series_id : ''}
                              onChange={e => {
                                if (e.target.value === '__new__') { setNewSubSeriesMode(true); return }
                                setDetailsForm(f => f && ({ ...f, series_id: e.target.value || editMainSeriesId }))
                              }}>
                              <option value="">None</option>
                              {seriesList.filter(s => s.parent_series_id === editMainSeriesId).sort((a, b) => (a.series_number ?? 0) - (b.series_number ?? 0)).map(s => (
                                <option key={s.id} value={s.id}>Series {s.series_number}{s.name ? `: ${s.name}` : ''}</option>
                              ))}
                              <option value="__new__">+ Add new…</option>
                            </select>
                          ) : (
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <input style={{ ...inp, flex: 1 }} placeholder="Sub-series name" value={newSubSeriesName} onChange={e => setNewSubSeriesName(e.target.value)} />
                              <button onClick={() => { setNewSubSeriesMode(false); setNewSubSeriesName(''); setNewSubSeriesNumber('') }} style={{ background: 'none', border: 'none', color: '#9b9b9b', cursor: 'pointer', fontSize: '17px' }}>×</button>
                            </div>
                          )}
                        </div>
                        <div>
                          <label style={lbl}>Sub-series No. <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                          <input style={inp} type="number" placeholder="" value={newSubSeriesNumber} onChange={e => setNewSubSeriesNumber(e.target.value)} />
                        </div>
                      </div>
                    )}

                    <div><label style={lbl}>Tags (comma separated)</label><input style={inp} value={detailsForm.tags} onChange={e => setDetailsForm(f => f && ({ ...f, tags: e.target.value }))} /></div>

                    <div>
                      <label style={lbl}>Description</label>
                      <textarea style={{ ...inp, minHeight: '80px', resize: 'vertical' }} value={detailsForm.description} onChange={e => setDetailsForm(f => f && ({ ...f, description: e.target.value }))} />
                    </div>
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <p style={secHead}>Categories</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {categories.map(cat => {
                      const isOn = (assignments[selectedBook.id] || new Set()).has(cat.id)
                      const isSaving = saving === `${selectedBook.id}-${cat.id}`
                      return (
                        <button key={cat.id} onClick={() => toggleCategory(selectedBook.id, cat.id)} disabled={!!saving}
                          style={{ padding: '5px 13px', borderRadius: '999px', border: '1px solid #e5e5e5', fontSize: '12px', fontWeight: 500, cursor: saving ? 'default' : 'pointer', backgroundColor: isOn ? '#1a1a1a' : '#f7f7f7', color: isOn ? '#fff' : '#4a4a4a', opacity: isSaving ? 0.5 : 1 }}>
                          {isSaving ? '…' : cat.name}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Collectible */}
                <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <p style={{ ...secHead, marginBottom: 0, flex: 1 }}>Collectible</p>
                    {selectedBook.collectible_status === 'awaiting_approval' && (
                      <a href="/admin/collectibles" style={{ fontSize: '11px', color: '#7c3aed', textDecoration: 'none', fontWeight: 600 }}>View all pending →</a>
                    )}
                  </div>

                  {(() => {
                    const book = selectedBook
                    const isGenerating = generatingCollectibleFor.has(book.id)
                    const status = book.collectible_status

                    if (isGenerating) {
                      return <p style={{ color: '#9b9b9b', fontSize: '13px', margin: 0 }}>{collectibleStep === 'polish' ? 'Polishing at high quality… about a minute' : 'Making it… about 30 seconds'}</p>
                    }

                    if (!status || status === 'generation_failed' || status === 'needs_book_context' || status === 'fact_sheet' || status === 'options') {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {status === 'generation_failed' && <p style={{ color: '#dc2626', fontSize: '12px', margin: 0 }}>Last attempt failed. Try again.</p>}
                          <p style={{ margin: 0, fontSize: '12px', color: '#6b6b6b', lineHeight: 1.5 }}>The AI picks one simple thing from the cover and redraws it in the Curious style (about 30 seconds).</p>
                          <label style={lbl}>Your idea (optional)</label>
                          <input value={collectibleSuggestion} onChange={e => setCollectibleSuggestion(e.target.value)} style={inp}
                            placeholder='e.g. "a mad penguin" or "a spoilt child picking its nose"'
                            onKeyDown={e => { if (e.key === 'Enter') collectibleStepCall(book, 'generate', { suggestion: collectibleSuggestion }) }} />
                          <Btn onClick={() => collectibleStepCall(book, 'generate', { suggestion: collectibleSuggestion })} style={{ alignSelf: 'flex-start' }}>Generate collectible</Btn>
                        </div>
                      )
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                          {/* Collectible image */}
                          <div style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#f7f0ff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {book.collectible_image_url
                              ? <HoverCover src={book.collectible_image_url} square />
                              : <span style={{ fontSize: '28px' }}>✦</span>}
                          </div>

                          {/* Metadata */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: '#7c3aed' }}>{book.collectible_name || '—'}</span>
                              {book.collectible_version && <span style={{ fontSize: '10px', color: '#9b9b9b' }}>v{book.collectible_version}</span>}
                              <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '999px', backgroundColor: status === 'approved' ? '#dcfce7' : status === 'awaiting_approval' ? '#ede9fe' : '#f3f4f6', color: status === 'approved' ? '#16a34a' : status === 'awaiting_approval' ? '#7c3aed' : '#9b9b9b' }}>
                                {status === 'approved' ? 'Approved' : status === 'awaiting_approval' ? 'Awaiting approval' : status}
                              </span>
                            </div>
                            {book.collectible_concept && <p style={{ margin: '0 0 3px', fontSize: '12px', color: '#4a4a4a', lineHeight: 1.4 }}>{book.collectible_concept}</p>}
                            <LoreEditor book={book} onSaved={(lore, live) => {
                              setBooks(prev => prev.map(b => b.id === book.id ? { ...b, collectible_lore: lore, collectible_lore_live: live } : b))
                              setSelectedBook(prev => prev?.id === book.id ? { ...prev, collectible_lore: lore, collectible_lore_live: live } : prev)
                            }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '11px', color: '#6b6b6b' }}>
                              Arrives in:
                              {(['creature', 'thing'] as const).map(k => {
                                const on = (book.collectible_kind || 'thing') === k
                                return (
                                  <button key={k} type="button" onClick={async () => {
                                    await fetch('/api/admin/books', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: book.id, collectible_kind: k }) })
                                    setBooks(prev => prev.map(b => b.id === book.id ? { ...b, collectible_kind: k } : b))
                                    setSelectedBook(prev => prev?.id === book.id ? { ...prev, collectible_kind: k } : prev)
                                  }} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '999px', cursor: 'pointer', border: '1px solid ' + (on ? '#7c3aed' : '#e5e5e5'), backgroundColor: on ? '#ede9fe' : '#fff', color: on ? '#7c3aed' : '#6b6b6b', fontWeight: on ? 700 : 400 }}>
                                    {k === 'creature' ? '🥚 an egg' : '🎁 a parcel'}
                                  </button>
                                )
                              })}
                            </div>
                            {book.collectible_source_moment && (
                              <div style={{ marginTop: '8px', padding: '7px 10px', backgroundColor: '#f9fafb', borderRadius: '6px', borderLeft: '3px solid #e5e5e5' }}>
                                <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: 700, color: '#9b9b9b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Source moment</p>
                                <p style={{ margin: 0, fontSize: '11px', color: '#4a4a4a', lineHeight: 1.4 }}>{book.collectible_source_moment}</p>
                              </div>
                            )}
                            {book.collectible_research && (() => {
                              try {
                                const urls: string[] = JSON.parse(book.collectible_research)
                                if (!urls.length) return null
                                return (
                                  <div style={{ marginTop: '6px' }}>
                                    <p style={{ margin: '0 0 3px', fontSize: '10px', fontWeight: 700, color: '#9b9b9b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Research</p>
                                    {urls.map((url, i) => (
                                      <a key={i} href={url} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: '10px', color: '#7c3aed', wordBreak: 'break-all', lineHeight: 1.4, marginBottom: '2px' }}>{url}</a>
                                    ))}
                                  </div>
                                )
                              } catch { return null }
                            })()}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {status === 'awaiting_approval' && (
                            <Btn onClick={() => approveCollectible(book.id)} style={{ backgroundColor: '#7c3aed', color: '#fff' }}>✓ Approve</Btn>
                          )}
                          <Btn variant="secondary" onClick={() => collectibleStepCall(book, 'generate', {})} disabled={isGenerating}>↻ Another idea</Btn>
                          <Btn variant="secondary" onClick={() => { setShowCollectibleFeedback(s => !s); setCollectibleFeedback('') }}>✦ Tweak This</Btn>
                          <Btn variant="secondary" onClick={() => collectibleStepCall(book, 'polish', {})}>✨ Polish (high quality)</Btn>
                          <Btn variant="secondary" onClick={() => rejectCollectible(book.id)} style={{ color: '#dc2626' }}>✕ Reject</Btn>
                        </div>

                        {showCollectibleFeedback && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <p style={{ margin: 0, fontSize: '11px', color: '#9b9b9b' }}>Keep the concept, refine the execution — e.g. "make the box turquoise" or "the penguins need to be crazier"</p>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input
                                value={collectibleFeedback}
                                onChange={e => setCollectibleFeedback(e.target.value)}
                                placeholder='e.g. "Make the box turquoise and the penguins wilder"'
                                style={{ ...inp, flex: 1 }}
                                onKeyDown={e => { if (e.key === 'Enter' && collectibleFeedback.trim()) { const note = collectibleFeedback.trim(); setShowCollectibleFeedback(false); setCollectibleFeedback(''); collectibleStepCall(book, 'draw', { idea: { collectible_name: book.collectible_name, concept: book.collectible_concept, lore: book.collectible_lore || '', source_moment: book.collectible_source_moment || '' }, direction: note }) } }}
                              />
                              <Btn onClick={() => { const note = collectibleFeedback.trim(); if (!note) return; setShowCollectibleFeedback(false); setCollectibleFeedback(''); collectibleStepCall(book, 'draw', { idea: { collectible_name: book.collectible_name, concept: book.collectible_concept, lore: book.collectible_lore || '', source_moment: book.collectible_source_moment || '' }, direction: note }) }} disabled={!collectibleFeedback.trim()}>Send</Btn>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>

                {/* Copies */}
                <div>
                  {addingCopyOf === selectedBook.id && (
                    <div style={{ marginBottom: '12px', padding: '10px 12px', borderRadius: '8px', backgroundColor: '#fff7e6', border: '1px solid #f3d18a', fontSize: '13px', color: '#1a1a1a' }}>
                      This book is already in the library. <strong>Scan the new copy's CUR label</strong> (or type it) and press Enter to add it.
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <p style={{ ...secHead, marginBottom: 0, flex: 1 }}>
                      Copies ({(copies[selectedBook.id] || []).filter(c => c.status !== 'retired').length})
                    </p>
                    <input ref={copyLabelRef} style={{ ...inp, width: '150px', fontSize: '12px', padding: '5px 8px', marginRight: '6px', boxShadow: addingCopyOf === selectedBook.id ? '0 0 0 3px #fde68a' : undefined }} placeholder="CUR label" value={copyLabel}
                      onChange={e => setCopyLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && copyLabel.trim()) addCopy(selectedBook.id) }} />
                    <Btn variant="secondary" onClick={() => setScanFor('copyLabel')} style={{ fontSize: '12px', padding: '5px 10px', marginRight: '6px' }}>📷</Btn>
                    <Btn variant="secondary" onClick={() => addCopy(selectedBook.id)} disabled={addingCopy} style={{ fontSize: '12px', padding: '5px 10px' }}>
                      {addingCopy ? 'Adding…' : '+ Add copy'}
                    </Btn>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(copies[selectedBook.id] || []).length === 0 && (
                      <p style={{ color: '#9b9b9b', fontSize: '13px', margin: 0 }}>No copies yet. Add one above.</p>
                    )}
                    {(copies[selectedBook.id] || []).map(copy => {
                      const isExpanded = expandedCopyId === copy.id
                      const loans = copyLoans[copy.id]
                      const isLoadingThis = loadingLoans === copy.id
                      const canArchive = copy.status !== 'retired' && copy.status !== 'checked_out' && copy.status !== 'active'

                      return (
                        <div key={copy.id} style={{ border: '1px solid #e5e5e5', borderRadius: '8px', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px' }}>
                            <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: '13px', color: '#1a1a1a', minWidth: '60px' }}>{copy.internal_id}</span>
                            <StatusDot status={copy.status} />
                            {copy.created_at && <span style={{ fontSize: '11px', color: '#9b9b9b' }}>added {fmtDate(copy.created_at)}</span>}
                            <div style={{ flex: 1 }} />
                            {copy.internal_id && <a href={'/admin/books/labels?codes=' + encodeURIComponent(copy.internal_id)} title='Print a label for this copy' style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid #e5e5e5', borderRadius: '8px', color: '#1a2f51', textDecoration: 'none', fontWeight: 600 }}>🏷 Print</a>}
                            <Btn variant="secondary" onClick={() => toggleCopyLoans(copy.id)} style={{ fontSize: '11px', padding: '4px 10px' }}>
                              {isLoadingThis ? '…' : `Loans ${isExpanded ? '▲' : '▼'}`}
                            </Btn>
                            {canArchive && (
                              <Btn variant="secondary" onClick={() => archiveCopy(copy.id, selectedBook.id)} style={{ fontSize: '11px', padding: '4px 10px', color: '#9b9b9b' }}>
                                Archive
                              </Btn>
                            )}
                          </div>

                          {isExpanded && (
                            <div style={{ borderTop: '1px solid #e5e5e5', backgroundColor: '#fafafa', padding: '10px 14px' }}>
                              {!loans ? (
                                <p style={{ margin: 0, fontSize: '13px', color: '#9b9b9b' }}>Loading…</p>
                              ) : loans.length === 0 ? (
                                <p style={{ margin: 0, fontSize: '13px', color: '#9b9b9b' }}>No loans recorded for this copy.</p>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {loans.map(loan => (
                                    <div key={loan.id} style={{ display: 'grid', gridTemplateColumns: '140px 120px 16px 1fr', gap: '8px', fontSize: '12px', color: '#4a4a4a', alignItems: 'center' }}>
                                      <span style={{ fontWeight: 600 }}>{loan.child_name || 'Unknown'}</span>
                                      <span style={{ color: '#9b9b9b' }}>{fmtDate(loan.created_at)}</span>
                                      <span style={{ color: '#d4d4d4', textAlign: 'center' }}>→</span>
                                      <span style={{ color: loan.returned_at ? '#9b9b9b' : '#d97706', fontWeight: loan.returned_at ? 400 : 600 }}>
                                        {loan.returned_at ? fmtDate(loan.returned_at) : 'Current loan'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {error && <p style={{ color: '#dc2626', fontSize: '13px', margin: 0 }}>⚠ {error}</p>}

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Btn onClick={saveDetails} disabled={savingDetails} style={savedOk ? { backgroundColor: '#16a34a' } : {}}>
                    {savingDetails ? 'Saving…' : savedOk ? 'Saved ✓' : 'Save Book Details'}
                  </Btn>
                  {!confirmDelete ? (
                    <button onClick={() => setConfirmDelete(true)}
                      style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '12px', cursor: 'pointer', padding: '4px 0', textDecoration: 'underline' }}>
                      Delete book
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#dc2626' }}>Are you sure?</span>
                      <Btn variant="secondary" onClick={() => { deleteBook(selectedBook.id); setConfirmDelete(false) }}
                        style={{ fontSize: '12px', padding: '4px 10px', color: '#dc2626' }}>Yes, delete</Btn>
                      <button onClick={() => setConfirmDelete(false)}
                        style={{ background: 'none', border: 'none', color: '#9b9b9b', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

