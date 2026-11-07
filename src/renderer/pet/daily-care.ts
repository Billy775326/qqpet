import { amusePet } from '../ui/face'
import { CARE_NEEDS, performCare } from './care'
import { selectCareStudy, selectCareWork } from './care-policy'
import { canStudyCourse, study, studyGoods, travel, work, workBlocked, workGoods } from './jobs'
import { machine } from './pet'
import { busy, info, save } from './store'
import { claim, dailyTasks } from './tasks'

/** Called by the existing growth tick: real actions retain their normal duration and effects. */
export function runDailyCare(): boolean {
  if (!save.settings.careAutoDaily || !info.sweetHeart || info.sweetHeartOverTime <= Date.now() / 1000 || save.settings.paused || info.health !== 5) return false
  if (busy() || !machine.automationReady || document.documentElement.classList.contains('qqpet-cursor-hit') || document.querySelector('.box, .boxFrame, .modal')) return false
  const daily = dailyTasks()
  const ready = daily.find(t => !t.take && t.done >= t.num)
  if (ready) return claim(ready.tab, ready.index) !== false
  for (const task of daily) {
    if (task.take || task.done >= task.num) continue
    const need = CARE_NEEDS.find(n => ({ food: 'Eat', clean: 'Clean', toy: 'Toy' }[n.type]) === task.obj)
    if (need) {
      if (performCare(need)) return true
      continue
    }
    if (task.obj === 'Amusing' && amusePet()) return true
    if (info.mood <= 0) continue
    if (task.obj === 'Study') {
      const course = selectCareStudy(studyGoods(), save.studyInfo, save.settings.careTrainingMode ?? 'focused', save.settings.careStudySubject ?? 'chinese')
      if (course && canStudyCourse(course) && study(course, { automatic: true })) return true
    } else if (task.obj === 'Work') {
      const job = selectCareWork(workGoods().filter(g => !workBlocked(g)), info, save.settings.careTrainingMode ?? 'focused', save.settings.careWorkId ?? '')
      if (job && work(job, { automatic: true })) return true
    } else if (task.obj === 'Travel1') {
      travel({ automatic: true })
      return true
    }
    // Minigame counters advance only through the existing manual game callbacks.
  }
  return false
}
