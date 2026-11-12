import { getAll, put, remove, STORE_CHECKINS, STORE_HABITS } from './db'
import type { Checkin, Habit } from './types'
import { HABIT_COLORS, HABIT_ICONS } from '../lib/palette'

const SEED_KEY = 'habitos:seeded'

function nowISO(): string {
  return new Date().toISOString()
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function checkinKey(habitId: string, date: string): string {
  return `${habitId}|${date}`
}

export async function listHabits(): Promise<Habit[]> {
  const habits = await getAll<Habit>(STORE_HABITS)
  return habits
    .filter((habit) => habit.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
}

export async function createHabit(input: { name: string; icon: string; color: string }): Promise<Habit> {
  const habits = await listHabits()
  const lastOrder = habits.length > 0 ? habits[habits.length - 1].sortOrder : -1
  const habit: Habit = {
    id: newId(),
    name: input.name.trim(),
    icon: input.icon,
    color: input.color,
    sortOrder: lastOrder + 1,
    active: true,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }
  await put(STORE_HABITS, habit)
  return habit
}

export async function updateHabit(
  habit: Habit,
  changes: Pick<Habit, 'name' | 'icon' | 'color'>,
): Promise<Habit> {
  const updated: Habit = {
    ...habit,
    ...changes,
    name: changes.name.trim(),
    updatedAt: nowISO(),
  }
  await put(STORE_HABITS, updated)
  return updated
}

export async function deleteHabit(habitId: string): Promise<void> {
  const checkins = await getAll<Checkin>(STORE_CHECKINS)
  await Promise.all(
    checkins.filter((checkin) => checkin.habitId === habitId).map((checkin) =>
      remove(STORE_CHECKINS, [checkin.habitId, checkin.date]),
    ),
  )
  await remove(STORE_HABITS, habitId)
}

export async function listCheckins(from: string, to: string): Promise<Checkin[]> {
  const checkins = await getAll<Checkin>(STORE_CHECKINS)
  return checkins.filter((checkin) => checkin.date >= from && checkin.date <= to)
}

/**
 * Nunca se borra la fila: se guarda done=false.
 * Así el día queda "sin hacer" de forma explícita y luego el sync lo propaga sin ambigüedad.
 */
export async function setCheckin(habitId: string, date: string, done: boolean): Promise<Checkin> {
  const checkin: Checkin = { habitId, date, done, updatedAt: nowISO() }
  await put(STORE_CHECKINS, checkin)
  return checkin
}

/** Tres hábitos de arranque para que la matriz no aparezca vacía la primera vez. */
export async function seedIfFirstRun(): Promise<void> {
  if (localStorage.getItem(SEED_KEY)) return
  localStorage.setItem(SEED_KEY, '1')

  const habits = await getAll<Habit>(STORE_HABITS)
  if (habits.length > 0) return

  await createHabit({ name: 'Leer', icon: HABIT_ICONS[0], color: HABIT_COLORS[6] })
  await createHabit({ name: 'Entrenar', icon: HABIT_ICONS[1], color: HABIT_COLORS[1] })
  await createHabit({ name: 'Aprender', icon: HABIT_ICONS[2], color: HABIT_COLORS[4] })
}
