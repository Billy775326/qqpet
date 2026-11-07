import type { PetInfo, Settings, StudyInfo } from '../../shared/save'
import type { Good } from './data/goods'

type Mode = Settings['careTrainingMode']
const subject = (g: Good): keyof StudyInfo => g.id.split('-')[1] as keyof StudyInfo
const phase = (g: Good): number => ['xx', 'zx', 'dx', 'yjs', 'xwzj'].indexOf(g.id.split('-')[0])
const available = (g: Good, progress: StudyInfo): boolean => progress[subject(g)] - g.classNumUp! < g.classNum!

/** A pending exam holds the focused subject; balanced lessons stay at the lowest school. */
export function selectCareStudy(courses: Good[], progress: StudyInfo, mode: Mode, preferred: keyof StudyInfo): Good | undefined {
  const unfinished = courses.filter(g => phase(g) >= 0 && phase(g) < 4)
  if (!unfinished.length) {
    const extra = courses.filter(g => phase(g) === 4 && available(g, progress))
    return mode === 'balanced'
      ? extra.sort((a, b) => progress[subject(a)] - progress[subject(b)])[0]
      : extra.find(g => subject(g) === preferred) ?? extra[0]
  }
  if (mode === 'balanced') {
    const lowest = Math.min(...unfinished.map(phase))
    return unfinished.find(g => phase(g) === lowest && available(g, progress))
  }
  const pivot = courses.findIndex(g => subject(g) === preferred)
  const ordered = pivot < 0 ? courses : [...courses.slice(pivot), ...courses.slice(0, pivot)]
  const target = ordered.find(g => phase(g) >= 0 && phase(g) < 4)
  return target && available(target, progress) ? target : undefined
}

/** Eligibility is checked by the caller; balanced shifts favor gains in the weakest attributes. */
export function selectCareWork(jobs: Good[], stats: Pick<PetInfo, 'intel' | 'charm' | 'strong'>, mode: Mode, preferred: string): Good | undefined {
  const candidates = jobs.filter(g => Number.isFinite(g.useTime) && g.useTime! > 0)
  if (mode === 'focused' && preferred) return candidates.find(g => g.id === preferred)
  const attributes = ['intel', 'charm', 'strong'] as const
  const lowest = Math.min(...attributes.map(k => stats[k]))
  const weakest = attributes.filter(k => stats[k] === lowest)
  const gain = (g: Good): number => weakest.reduce((n, k) => n + (g[k] ?? 0), 0) / g.useTime!
  const income = (g: Good): number => (g.yb ?? 0) / g.useTime!
  return candidates.sort((a, b) =>
    (mode === 'balanced' ? gain(b) - gain(a) : 0) || income(b) - income(a),
  )[0]
}
