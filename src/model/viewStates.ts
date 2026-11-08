/**
 * Named saved states: a reproducible snapshot of the study view (explode, visibility, installed set,
 * section). Stored per browser; parsing is defensive because stored data can be stale or edited.
 */
import { parts } from './components'
import { validateInstalledSet } from './assembly'
import { AXES, clampSectionOffset, type SectionSettings } from './cad'

export type ViewState = {
  name: string
  savedAt: string
  explode: number
  hiddenIds: string[]
  isolatedId: string | null
  installedIds: string[]
  section: SectionSettings | null
}

export const VIEW_STATE_STORAGE_KEY = 'telaio.viewStates.v1'
const knownIds = new Set(parts.map((part) => part.id))

export type ParsedViewStates = { states: ViewState[]; warnings: string[] }

/** Parses stored states, dropping malformed entries and unknown component IDs with a warning for each. */
export function parseViewStates(raw: string | null): ParsedViewStates {
  if (!raw) return { states: [], warnings: [] }
  let value: unknown
  try { value = JSON.parse(raw) } catch { return { states: [], warnings: ['Saved states could not be read and were ignored'] } }
  if (!Array.isArray(value)) return { states: [], warnings: ['Saved states had an unexpected format and were ignored'] }
  const warnings: string[] = []
  const states: ViewState[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || typeof (entry as ViewState).name !== 'string' || !(entry as ViewState).name.trim()) { warnings.push('Skipped an unnamed or malformed saved state'); continue }
    const item = entry as Partial<ViewState> & { name: string }
    const ids = (list: unknown, field: string) => {
      const array = Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string') : []
      const unknown = array.filter((id) => !knownIds.has(id))
      if (unknown.length) warnings.push(`"${item.name}": ignored unknown ${field} ${unknown.join(', ')}`)
      return array.filter((id) => knownIds.has(id))
    }
    const installedIds = Array.isArray(item.installedIds) ? ids(item.installedIds, 'installed component(s)') : [...knownIds]
    const section = item.section && AXES.includes(item.section.axis) && Number.isFinite(item.section.offset)
      ? { axis: item.section.axis, offset: clampSectionOffset(item.section.axis, item.section.offset), flip: Boolean(item.section.flip) }
      : null
    states.push({
      name: item.name.trim().slice(0, 60),
      savedAt: typeof item.savedAt === 'string' ? item.savedAt : '',
      explode: Number.isFinite(item.explode) ? Math.min(1, Math.max(0, item.explode as number)) : 0,
      hiddenIds: ids(item.hiddenIds, 'hidden component(s)'),
      isolatedId: typeof item.isolatedId === 'string' && knownIds.has(item.isolatedId) ? item.isolatedId : null,
      installedIds,
      section,
    })
  }
  return { states, warnings }
}

/** A state can be restored only if its installed set satisfies the current prerequisite rules. */
export function restoreErrors(state: ViewState): string[] {
  return validateInstalledSet(state.installedIds)
}

/** Adds or replaces (by name) a state; most recent first. */
export function upsertViewState(states: ViewState[], state: ViewState): ViewState[] {
  return [state, ...states.filter((item) => item.name !== state.name)]
}
