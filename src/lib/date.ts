const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

const WEEKDAYS_LONG = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
]

const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/** Fecha local en formato YYYY-MM-DD (nunca UTC: "hoy" debe ser el día del usuario). */
export function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Mediodía local para esquivar los saltos de hora en los cambios de mes. */
export function fromISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month + delta, 1, 12)
  return { year: date.getFullYear(), month: date.getMonth() }
}

export function monthTitle(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`
}

export type MonthDay = {
  iso: string
  day: number
  /** 0 = lunes ... 6 = domingo */
  weekday: number
  letter: string
}

export function monthDays(year: number, month: number): MonthDay[] {
  const days = new Date(year, month + 1, 0).getDate()
  const result: MonthDay[] = []
  for (let day = 1; day <= days; day++) {
    const date = new Date(year, month, day, 12)
    const weekday = (date.getDay() + 6) % 7
    result.push({
      iso: toISODate(date),
      day,
      weekday,
      letter: WEEKDAYS_SHORT[weekday],
    })
  }
  return result
}

export function formatLongDate(iso: string): string {
  const date = fromISODate(iso)
  const weekday = WEEKDAYS_LONG[(date.getDay() + 6) % 7]
  return `${weekday} ${date.getDate()} de ${MONTHS[date.getMonth()]}`
}
