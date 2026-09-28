'use client'

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

type Theme = 'system' | 'light' | 'dark'
const choices: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'system', label: 'System', icon: Monitor }, { value: 'light', label: 'Light', icon: Sun }, { value: 'dark', label: 'Dark', icon: Moon },
]
function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}
export function AppearanceSettings() {
  const [theme, setTheme] = useState<Theme>('system')
  useEffect(() => { const saved = (localStorage.getItem('concierge-theme') as Theme | null) ?? 'system'; setTheme(saved); applyTheme(saved) }, [])
  function select(value: Theme) { setTheme(value); localStorage.setItem('concierge-theme', value); applyTheme(value) }
  return <div className="grid grid-cols-3 gap-2">{choices.map(({ value, label, icon: Icon }) => <button type="button" key={value} onClick={() => select(value)} className={cn('flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-semibold transition', theme === value ? 'border-primary bg-primary-subtle text-primary' : 'bg-background hover:bg-muted')}><Icon className="h-5 w-5" />{label}</button>)}</div>
}
