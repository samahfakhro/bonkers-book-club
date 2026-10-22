'use client'
// The avatar pictures families can choose from (one shared set for children and parents).
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type AvatarOption = { id: string; name: string; image_url: string }

let cached: Promise<AvatarOption[]> | null = null

export function loadAvatars(): Promise<AvatarOption[]> {
  cached ??= Promise.resolve(supabase.from('avatars').select('id, name, image_url').eq('is_active', true).order('display_order'))
    .then(({ data }) => (data || []) as AvatarOption[])
  return cached
}

export function useAvatars() {
  const [list, setList] = useState<AvatarOption[]>([])
  useEffect(() => { loadAvatars().then(setList) }, [])
  return list
}

// small helper so pages can pass "maybe an avatar" around like before
export const avatarRef = (id?: string | null) => (id ? { id } : null)
