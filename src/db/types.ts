export type Habit = {
  id: string
  name: string
  icon: string
  color: string
  sortOrder: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export type Checkin = {
  habitId: string
  /** YYYY-MM-DD en hora local */
  date: string
  done: boolean
  updatedAt: string
}
