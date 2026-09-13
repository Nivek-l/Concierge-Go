import 'server-only'

import { cache } from 'react'

import { logError } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import type { CityRow, TaskCategoryRow } from '@/types/database'

/**
 * Reference data — cities and categories.
 *
 * Both are small, rarely change and are needed on nearly every page, so they
 * are request-cached. They are readable without a session (the landing page
 * and /services use them).
 */

export const getCities = cache(async (): Promise<CityRow[]> => {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('cities')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) throw error
    return (data ?? []) as CityRow[]
  } catch (error) {
    logError('reference.getCities', error)
    return []
  }
})

export const getLiveCities = cache(async (): Promise<CityRow[]> => {
  const cities = await getCities()
  return cities.filter((city) => city.is_live)
})

export const getCityBySlug = cache(async (slug: string): Promise<CityRow | null> => {
  const cities = await getCities()
  return cities.find((city) => city.slug === slug) ?? null
})

export const getCategories = cache(async (): Promise<TaskCategoryRow[]> => {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('task_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return (data ?? []) as TaskCategoryRow[]
  } catch (error) {
    logError('reference.getCategories', error)
    return []
  }
})

export const getCategoryBySlug = cache(async (slug: string): Promise<TaskCategoryRow | null> => {
  const categories = await getCategories()
  return categories.find((category) => category.slug === slug) ?? null
})

/** Lookup maps for joining rows without a second query. */
export const getReferenceMaps = cache(async () => {
  const [cities, categories] = await Promise.all([getCities(), getCategories()])
  return {
    cities,
    categories,
    cityById: new Map(cities.map((city) => [city.id, city])),
    cityBySlug: new Map(cities.map((city) => [city.slug, city])),
    categoryById: new Map(categories.map((category) => [category.id, category])),
    categoryBySlug: new Map(categories.map((category) => [category.slug, category])),
  }
})
