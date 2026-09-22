'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Book = {
  id: string; title: string; author: string
  cover_image_url: string | null; discovery_asset_url: string | null
  isbn: string | null; page_count: number | null; book_type: string | null
  series_id: string | null; series_number: number | null
  reading_level_id: string | null; search_tags: string[] | null
  description: string | null; age_min: number | null; age_max: number | null
  collectible_status: string | null; collectible_name: string | null
  collectible_concept: string | null; collectible_lore: string | null
  collectible_image_url: string | null; collectible_openai_response_id: string | null
  collectible_version: number | null
}

type Category = { id: string; name: string }
type ReadingLevel = { id: string; name: string }
type Series = { id: string; name: string; parent_series_id: string | null; series_number: number | null }
type BookCopy = { id: string; book_id: string; internal_id: string; status: string }
type LoanEntry = { id: string; status: string; created_at: string; returned_at: string | null; child_name: string | null }

type DetailsForm = {
  isbn: string; page_count: string; book_type: string
  series_id: string; series_number: string
  reading_level_id: string
  tags: string; description: string
  age_min: string; age_max: string
}

// â”€â”€â”€ Shared styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ BNK ID generator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function generateBNKId(): Promise<string> {
  const { data } = await supabase.from('book_copies').select('internal_id')
  const nums = (data || [])
    .map((c: any) => c.internal_id as string | null)
    .filter((id): id is string => !!id && /^BNK-\d+$/.test(id))
    .map(id => parseInt(id.slice(4), 10))
  return `BNK-${(nums.length > 0 ? Math.max(...nums) : 0) + 1}`
}

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  const [saving, setSaving] = useState<string | null>(null)
  const [savingLevel, setSavingLevel] = useState<string | null>(null)

  // Panel
  const [panelMode, setPanelMode] = useState<null | 'detail' | 'add'>(null)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [detailsForm, setDetailsForm] = useState<DetailsForm | null>(null)
  const [savingDetails, setSavingDetails] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [uploadingCoverFor, setUploadingCoverFor] = useState<string | null>(null)
  const [uploadingAssetFor, setUploadingAssetFor] = useState<string | null>(null)

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

  // Add form
  const [addForm, setAddForm] = useState({ title: '', author: '', isbn: '', page_count: '', book_type: '', series_number: '', reading_level_id: '', tags: '', description: '', age_min: '', age_max: '' })
  const [addMainSeriesId, setAddMainSeriesId] = useState('')
  const [addCoverFile, setAddCoverFile] = useState<File | null>(null)
  const [addAssetFile, setAddAssetFile] = useState<File | null>(null)
  const [addingBook, setAddingBook] = useState(false)
  const [addNewSeriesMode, setAddNewSeriesMode] = useState(false)
  const [addNewSeriesName, setAddNewSeriesName] = useState('')
  const [addSubSeriesName, setAddSubSeriesName] = useState('')
  const [addSubSeriesNumber, setAddSubSeriesNumber] = useState('')
  const addCoverRef = useRef<HTMLInputElement>(null)
  const addAssetRef = useRef<HTMLInputElement>(null)

  // Add form chips
  const [addLevelIds, setAddLevelIds] = useState<Set<string>>(new Set())
  const [addCategoryIds, setAddCategoryIds] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Collectible generation
  const [generatingCollectibleFor, setGeneratingCollectibleFor] = useState<string | null>(null)
  const [collectibleFeedback, setCollectibleFeedback] = useState('')
  const [showCollectibleFeedback, setShowCollectibleFeedback] = useState(false)

  // Fetch / enrich
  const [fetchQuery, setFetchQuery] = useState('')
  const [fetchLoading, setFetchLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [fetchResults, setFetchResults] = useState<any[]>([])
  const [fetchedCoverBase64, setFetchedCoverBase64] = useState<string | null>(null)

  // â”€â”€ Load â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function loadAll() {
    const [
      { data: bookData }, { data: catData }, { data: bcData },
      { data: levelData }, seriesRes, { data: copyData }, { data: brlData }
    ] = await Promise.all([
      supabase.from('books').select('id, title, author, cover_image_url, discovery_asset_url, isbn, page_count, book_type, series_id, series_number, reading_level_id, search_tags, description, age_min, age_max, collectible_status, collectible_name, collectible_concept, collectible_lore, collectible_image_url, collectible_openai_response_id, collectible_version').eq('is_active', true).order('title'),
      supabase.from('categories').select('id, name').order('display_order'),
      supabase.from('book_categories').select('book_id, category_id'),
      supabase.from('reading_levels').select('id, name').order('display_order'),
      fetch('/api/admin/series').then(r => r.json()),
      supabase.from('book_copies').select('id, book_id, internal_id, status'),
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

  // â”€â”€ Category toggle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€ Reading level toggle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€ Book selection / panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function openBook(book: Book) {
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
      isbn: book.isbn || '',
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

  // â”€â”€ Series helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€ Save details â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function saveDetails() {
    if (!detailsForm || !selectedBook) return
    setSavingDetails(true); setError(null)
    const seriesId = await ensureSeries()
    if ((newSeriesMode || newSubSeriesMode) && !seriesId) { setSavingDetails(false); return }
    const tags = detailsForm.tags.split(',').map(t => t.trim()).filter(Boolean)
    const seriesNum = detailsForm.series_number.trim() ? Number(detailsForm.series_number.trim()) : null
    const patchBody = {
      id: selectedBook.id,
      isbn: detailsForm.isbn.trim() || null,
      page_count: detailsForm.page_count.trim() ? Number(detailsForm.page_count.trim()) : null,
      book_type: detailsForm.book_type.trim() || null,
      series_id: seriesId || null,
      series_number: seriesId ? seriesNum : null,
      search_tags: tags.length > 0 ? tags : null,
      description: detailsForm.description.trim() || null,
      age_min: detailsForm.age_min.trim() ? Number(detailsForm.age_min.trim()) : null,
      age_max: detailsForm.age_max.trim() ? Number(detailsForm.age_max.trim()) : null,
    }
    console.log('[saveDetails] PATCH payload:', patchBody)
    const patchRes = await fetch('/api/admin/books', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody),
    })
    const patchJson = await patchRes.json()
    console.log('[saveDetails] PATCH response:', patchJson)
    if (patchJson.error) { console.error('[saveDetails] PATCH error:', patchJson.error); setError(`Save failed: ${patchJson.error}`); setSavingDetails(false); return }
    const updated = {
      ...selectedBook,
      isbn: detailsForm.isbn.trim() || null,
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

  // â”€â”€ Upload helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  async function uploadAsset(file: File, bookId: string) {
    setUploadingAssetFor(bookId); setError(null)
    const base64 = await fileToBase64(file)
    const res = await fetch('/api/admin/books', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: bookId, bucket: 'book-assets', base64, field: 'discovery_asset_url' }) })
    const json = await res.json()
    if (json.error) { setError(`Asset upload failed: ${json.error}`); setUploadingAssetFor(null); return }
    setBooks(prev => prev.map(b => b.id === bookId ? { ...b, discovery_asset_url: json.publicUrl } : b))
    setSelectedBook(prev => prev?.id === bookId ? { ...prev, discovery_asset_url: json.publicUrl } : prev)
    setUploadingAssetFor(null)
  }

  // â”€â”€ Fetch & enrich book â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function fetchBookInfo(query: string, isIsbn: boolean, volumeId?: string) {
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

      if (data.results) {
        if (data.results.length === 0) { setFetchError('No books found. Try a different title or ISBN.') }
        else { setFetchResults(data.results) }
        setFetchLoading(false); return
      }

      // Single book returned â€” fill form
      const { book, enrichment } = data
      applyFetchedBook(book, enrichment)
    } catch {
      setFetchError('Fetch failed. Check your connection and try again.')
    }
    setFetchLoading(false)
  }

  function applyFetchedBook(book: any, enrichment: any) {
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
        // Series not in DB â€” pre-fill new series name
        setAddNewSeriesMode(true)
        setAddNewSeriesName(enrichment.series_name)
      }
    }

    setAddMainSeriesId(mainSeriesId)
    // Pre-fill sub-series fields from enrichment
    setAddSubSeriesName(enrichment?.sub_series_name || '')
    setAddSubSeriesNumber(enrichment?.sub_series_number ? String(enrichment.sub_series_number) : '')
    setFetchedCoverBase64(book.coverBase64 || null)

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

  // â”€â”€ Add book â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function handleAddBook() {
    if (!addForm.title.trim() || !addForm.author.trim()) { setError('Title and author are required.'); return }
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

    const internalId = await generateBNKId()
    const res = await fetch('/api/admin/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        internalId,
        coverBase64: fetchedCoverBase64 || null,
        book: {
          title: addForm.title.trim(), author: addForm.author.trim(),
          isbn: addForm.isbn.trim() || null,
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
    if (addAssetFile) {
      const base64 = await fileToBase64(addAssetFile)
      const r = await fetch('/api/admin/books', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: newBook.id, bucket: 'book-assets', base64, field: 'discovery_asset_url' }) })
      const u = await r.json()
      if (u.publicUrl) finalBook = { ...finalBook, discovery_asset_url: u.publicUrl }
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

    // Open new book in detail panel
    setSelectedBook(finalBook)
    setPanelMode('detail')
    setExpandedCopyId(null)
    setEditMainSeriesId(seriesId || '')
    setNewSeriesMode(false); setNewSeriesName('')
    setNewSubSeriesMode(false); setNewSubSeriesName(''); setNewSubSeriesNumber('')
    setDetailsForm({
      isbn: finalBook.isbn || '',
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

    // Reset add form
    setAddForm({ title: '', author: '', isbn: '', page_count: '', book_type: '', series_number: '', reading_level_id: '', tags: '', description: '', age_min: '', age_max: '' })
    setAddMainSeriesId('')
    setAddNewSeriesMode(false); setAddNewSeriesName('')
    setAddSubSeriesName(''); setAddSubSeriesNumber('')
    setAddCoverFile(null); setAddAssetFile(null)
    if (addCoverRef.current) addCoverRef.current.value = ''
    if (addAssetRef.current) addAssetRef.current.value = ''
    setFetchQuery(''); setFetchedCoverBase64(null); setFetchResults([])
    setAddLevelIds(new Set()); setAddCategoryIds(new Set())
    setAddCategoryIds(new Set())
    setAddingBook(false)
  }

  // â”€â”€ Collectible generation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function generateCollectible(book: Book, mode: 'new' | 'retry' | 'revise', feedbackText?: string) {
    setGeneratingCollectibleFor(book.id)
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
      }
      setBooks(prev => prev.map(b => b.id === book.id ? updated : b))
      setSelectedBook(updated)
    } else {
      setError(`Collectible generation failed: ${json.error}`)
    }
    setGeneratingCollectibleFor(null)
  }

  async function approveCollectible(bookId: string) {
    const res = await fetch('/api/admin/generate-collectible', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId }),
    })
    if (res.ok) {
      setBooks(prev => prev.map(b => b.id === bookId ? { ...b, collectible_status: 'approved' } : b))
      setSelectedBook(prev => prev?.id === bookId ? { ...prev, collectible_status: 'approved' } : prev)
    }
  }

  // â”€â”€ Copies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function addCopy(bookId: string) {
    setAddingCopy(true); setError(null)
    const internalId = await generateBNKId()
    const { data, error: e } = await supabase.from('book_copies')
      .insert({ book_id: bookId, internal_id: internalId, status: 'available' })
      .select('id, book_id, internal_id, status').single()
    if (e) { setError(`Add copy failed: ${e.message}`); setAddingCopy(false); return }
    setCopies(prev => ({ ...prev, [bookId]: [...(prev[bookId] || []), data] }))
    setAddingCopy(false)
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

  // â”€â”€ Utils â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const filtered = books.filter(b =>
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    b.author.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div style={{ padding: '32px', fontSize: '14px', color: '#6b6b6b' }}>Loadingâ€¦</div>

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* â”€â”€ Left: book list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div style={{
        width: panelMode ? '340px' : '100%', flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        borderRight: panelMode ? '1px solid #e5e5e5' : 'none',
        overflow: 'hidden',
      }}>
        {/* Toolbar */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e5e5', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ flex: 1, fontWeight: 700, fontSize: '15px', color: '#1a1a1a' }}>Books</span>
          <Btn onClick={() => { setSelectedBook(null); setPanelMode('add') }}>+ Add Book</Btn>
        </div>
        {/* Search */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e5e5' }}>
          <input style={inp} placeholder="Searchâ€¦" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {/* Error bar */}
        {error && (
          <div style={{ margin: '8px 16px', padding: '8px 12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#dc2626', fontSize: '12px' }}>
            âš  {error}
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
            if (active.length === 1) copyLine = `1 copy â€” ${avail ? 'available' : out ? 'out' : active[0].status}`
            else if (active.length > 1) {
              const parts = []
              if (avail) parts.push(`${avail} available`)
              if (out) parts.push(`${out} out`)
              copyLine = `${active.length} copies${parts.length ? ' â€” ' + parts.join(' Â· ') : ''}`
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
                  {book.cover_image_url && <img src={book.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
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

      {/* â”€â”€ Right: detail / add panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {panelMode && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Panel header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <span style={{ flex: 1, fontWeight: 700, fontSize: '15px', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {panelMode === 'add' ? 'Add New Book' : (selectedBook?.title || '')}
            </span>
            <button onClick={closePanel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', color: '#9b9b9b', padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}>Ã—</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

            {/* â”€â”€ ADD BOOK FORM â”€â”€ */}
            {panelMode === 'add' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '580px' }}>

                {/* Search bar */}
                <div style={{ backgroundColor: '#f7f7f7', borderRadius: '10px', padding: '14px' }}>
                  <label style={lbl}>Search by title or ISBN</label>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    <input
                      style={{ ...inp, flex: 1 }}
                      placeholder="e.g. Harry Potter or 9780747532699"
                      value={fetchQuery}
                      onChange={e => setFetchQuery(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && fetchQuery.trim()) { const q = fetchQuery.trim(); fetchBookInfo(q, /^\d[\d\-]{8,}$/.test(q), undefined) } }}
                    />
                    <Btn
                      onClick={() => { const q = fetchQuery.trim(); if (q) fetchBookInfo(q, /^\d[\d\-]{8,}$/.test(q), undefined) }}
                      disabled={fetchLoading || !fetchQuery.trim()}
                    >
                      {fetchLoading ? 'Fetchingâ€¦' : 'Fetch'}
                    </Btn>
                  </div>
                  {fetchError && <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#dc2626' }}>{fetchError}</p>}
                  {fetchResults.length > 0 && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 600, color: '#6b6b6b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pick the right edition</p>
                      {fetchResults.map(r => (
                        <button key={r.volumeId} onClick={() => fetchBookInfo('', false, r.volumeId)}
                          style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e5e5', backgroundColor: '#ffffff', cursor: 'pointer', textAlign: 'left' }}>
                          {r.thumbnailUrl && <img src={r.thumbnailUrl.replace('http://', 'https://')} alt="" style={{ width: '28px', height: '42px', objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }} />}
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</p>
                            <p style={{ margin: '1px 0 0', fontSize: '12px', color: '#6b6b6b' }}>{r.author}{r.pageCount ? ` Â· ${r.pageCount}pp` : ''}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {fetchedCoverBase64 && (
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img src={fetchedCoverBase64} alt="cover" style={{ width: '36px', height: '54px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e5e5e5' }} />
                      <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>Cover fetched âœ“</span>
                      <button onClick={() => setFetchedCoverBase64(null)} style={{ background: 'none', border: 'none', color: '#9b9b9b', cursor: 'pointer', fontSize: '12px', marginLeft: '4px' }}>remove</button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div><label style={lbl}>Title *</label><input style={inp} value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))} /></div>
                  <div><label style={lbl}>Author *</label><input style={inp} value={addForm.author} onChange={e => setAddForm(f => ({ ...f, author: e.target.value }))} /></div>
                </div>

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
                      {['Picture Book','Early Reader','Chapter Book','Illustrated Book','Graphic Novel','Novel','Flap Book'].map(t => <option key={t}>{t}</option>)}
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
                      <option value="__new__">+ Add new seriesâ€¦</option>
                    </select>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input style={inp} placeholder="New series name" value={addNewSeriesName} onChange={e => setAddNewSeriesName(e.target.value)} />
                      <button onClick={() => { setAddNewSeriesMode(false); setAddNewSeriesName('') }} style={{ background: 'none', border: 'none', color: '#9b9b9b', cursor: 'pointer', fontSize: '17px' }}>Ã—</button>
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
                  <textarea style={{ ...inp, minHeight: '80px', resize: 'vertical' }} placeholder="A short description of the bookâ€¦" value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} />
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div><label style={lbl}>Cover image</label><input ref={addCoverRef} type="file" accept="image/*" onChange={e => setAddCoverFile(e.target.files?.[0] || null)} style={{ fontSize: '13px', color: '#1a1a1a' }} /></div>
                  <div><label style={lbl}>Discovery asset</label><input ref={addAssetRef} type="file" accept="image/*" onChange={e => setAddAssetFile(e.target.files?.[0] || null)} style={{ fontSize: '13px', color: '#1a1a1a' }} /></div>
                </div>

                {error && <p style={{ color: '#dc2626', fontSize: '13px', margin: 0 }}>âš  {error}</p>}
                <Btn onClick={handleAddBook} disabled={addingBook}>{addingBook ? 'Addingâ€¦' : 'Add Book'}</Btn>
              </div>
            )}

            {/* â”€â”€ BOOK DETAIL â”€â”€ */}
            {panelMode === 'detail' && selectedBook && detailsForm && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '620px' }}>

                {/* Cover + uploads */}
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ width: '72px', height: '108px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, backgroundColor: '#e8e8e8', position: 'relative' }}>
                    {selectedBook.cover_image_url && <img src={selectedBook.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    {uploadingCoverFor === selectedBook.id && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>â€¦</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                    <div>
                      <label style={lbl}>Replace cover</label>
                      <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadCover(f, selectedBook.id) }} style={{ fontSize: '12px', color: '#1a1a1a' }} />
                    </div>
                    <div>
                      <label style={lbl}>Discovery asset {selectedBook.discovery_asset_url ? '(replace)' : ''}</label>
                      {selectedBook.discovery_asset_url && <img src={selectedBook.discovery_asset_url} alt="" style={{ width: '28px', height: '28px', objectFit: 'contain', display: 'block', marginBottom: '4px' }} />}
                      <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadAsset(f, selectedBook.id) }} style={{ fontSize: '12px', color: '#1a1a1a' }} />
                      {uploadingAssetFor === selectedBook.id && <span style={{ fontSize: '11px', color: '#9b9b9b' }}>Uploadingâ€¦</span>}
                    </div>
                  </div>
                </div>

                {/* Book details */}
                <div>
                  <p style={secHead}>Book details</p>
                  {error && <p style={{ color: '#dc2626', fontSize: '13px', margin: '0 0 8px', padding: '8px 12px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>âš  {error}</p>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                                {isSaving ? 'â€¦' : level.name}
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
                          {['Picture Book','Early Reader','Chapter Book','Illustrated Book','Graphic Novel','Novel','Flap Book'].map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div><label style={lbl}>Age from</label><input style={inp} type="number" placeholder="7" value={detailsForm.age_min} onChange={e => setDetailsForm(f => f && ({ ...f, age_min: e.target.value }))} /></div>
                      <div><label style={lbl}>Age to</label><input style={inp} type="number" placeholder="10" value={detailsForm.age_max} onChange={e => setDetailsForm(f => f && ({ ...f, age_max: e.target.value }))} /></div>
                    </div>

                    {/* Series â€” Row 1: Series Name | Book Number */}
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
                            <option value="__new__">+ Add new seriesâ€¦</option>
                          </select>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <input style={{ ...inp, flex: 1 }} placeholder="New series name" value={newSeriesName} onChange={e => setNewSeriesName(e.target.value)} />
                            <button onClick={() => { setNewSeriesMode(false); setNewSeriesName('') }} style={{ background: 'none', border: 'none', color: '#9b9b9b', cursor: 'pointer', fontSize: '17px' }}>Ã—</button>
                          </div>
                        )}
                      </div>
                      <div>
                        <label style={lbl}>Book Number</label>
                        <input style={inp} type="number" placeholder="1" value={detailsForm.series_number} onChange={e => setDetailsForm(f => f && ({ ...f, series_number: e.target.value }))} />
                      </div>
                    </div>
                    {/* Series â€” Row 2: Sub-series | Sub-series No. */}
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
                              <option value="__new__">+ Add newâ€¦</option>
                            </select>
                          ) : (
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <input style={{ ...inp, flex: 1 }} placeholder="Sub-series name" value={newSubSeriesName} onChange={e => setNewSubSeriesName(e.target.value)} />
                              <button onClick={() => { setNewSubSeriesMode(false); setNewSubSeriesName(''); setNewSubSeriesNumber('') }} style={{ background: 'none', border: 'none', color: '#9b9b9b', cursor: 'pointer', fontSize: '17px' }}>Ã—</button>
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
                          {isSaving ? 'â€¦' : cat.name}
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
                    const isGenerating = generatingCollectibleFor === book.id
                    const status = book.collectible_status

                    if (isGenerating) {
                      return <p style={{ color: '#9b9b9b', fontSize: '13px', margin: 0 }}>Generating… this takes ~30 seconds</p>
                    }

                    if (!status || status === 'generation_failed') {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {status === 'generation_failed' && <p style={{ color: '#dc2626', fontSize: '12px', margin: 0 }}>Last generation failed.</p>}
                          <Btn onClick={() => generateCollectible(book, 'new')} style={{ alignSelf: 'flex-start' }}>Generate Collectible</Btn>
                        </div>
                      )
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                          {/* Collectible image */}
                          <div style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#f7f0ff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {book.collectible_image_url
                              ? <img src={book.collectible_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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
                            {book.collectible_lore && <p style={{ margin: 0, fontSize: '11px', color: '#9b9b9b', fontStyle: 'italic' }}>"{book.collectible_lore}"</p>}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {status === 'awaiting_approval' && (
                            <Btn onClick={() => approveCollectible(book.id)} style={{ backgroundColor: '#7c3aed', color: '#fff' }}>✓ Approve</Btn>
                          )}
                          <Btn variant="secondary" onClick={() => generateCollectible(book, 'retry')} disabled={isGenerating}>Try Again</Btn>
                          <Btn variant="secondary" onClick={() => setShowCollectibleFeedback(s => !s)}>Change Idea</Btn>
                        </div>

                        {showCollectibleFeedback && (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              value={collectibleFeedback}
                              onChange={e => setCollectibleFeedback(e.target.value)}
                              placeholder='e.g. "Too obvious — find something funnier"'
                              style={{ ...inp, flex: 1 }}
                              onKeyDown={e => { if (e.key === 'Enter' && collectibleFeedback.trim()) generateCollectible(book, 'revise', collectibleFeedback.trim()) }}
                            />
                            <Btn onClick={() => collectibleFeedback.trim() && generateCollectible(book, 'revise', collectibleFeedback.trim())} disabled={!collectibleFeedback.trim()}>Send</Btn>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>

                {/* Copies */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <p style={{ ...secHead, marginBottom: 0, flex: 1 }}>
                      Copies ({(copies[selectedBook.id] || []).filter(c => c.status !== 'retired').length})
                    </p>
                    <Btn variant="secondary" onClick={() => addCopy(selectedBook.id)} disabled={addingCopy} style={{ fontSize: '12px', padding: '5px 10px' }}>
                      {addingCopy ? 'Addingâ€¦' : '+ Add copy'}
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
                            <div style={{ flex: 1 }} />
                            <Btn variant="secondary" onClick={() => toggleCopyLoans(copy.id)} style={{ fontSize: '11px', padding: '4px 10px' }}>
                              {isLoadingThis ? 'â€¦' : `Loans ${isExpanded ? 'â–²' : 'â–¼'}`}
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
                                <p style={{ margin: 0, fontSize: '13px', color: '#9b9b9b' }}>Loadingâ€¦</p>
                              ) : loans.length === 0 ? (
                                <p style={{ margin: 0, fontSize: '13px', color: '#9b9b9b' }}>No loans recorded for this copy.</p>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {loans.map(loan => (
                                    <div key={loan.id} style={{ display: 'grid', gridTemplateColumns: '140px 120px 16px 1fr', gap: '8px', fontSize: '12px', color: '#4a4a4a', alignItems: 'center' }}>
                                      <span style={{ fontWeight: 600 }}>{loan.child_name || 'Unknown'}</span>
                                      <span style={{ color: '#9b9b9b' }}>{fmtDate(loan.created_at)}</span>
                                      <span style={{ color: '#d4d4d4', textAlign: 'center' }}>â†’</span>
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

                {error && <p style={{ color: '#dc2626', fontSize: '13px', margin: 0 }}>âš  {error}</p>}

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Btn onClick={saveDetails} disabled={savingDetails} style={savedOk ? { backgroundColor: '#16a34a' } : {}}>
                    {savingDetails ? 'Savingâ€¦' : savedOk ? 'Saved âœ“' : 'Save Book Details'}
                  </Btn>
                  {!confirmDelete ? (
                    <button onClick={() => setConfirmDelete(true)}
                      style={{ background: 'none', border: 'none', color: '#9b9b9b', fontSize: '12px', cursor: 'pointer', padding: '4px 0' }}>
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

