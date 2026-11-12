import {
  createHabit,
  deleteHabit,
  listCheckins,
  listHabits,
  seedIfFirstRun,
  setCheckin,
  updateHabit,
} from '../db/repo'
import type { Habit } from '../db/types'
import { addMonths, formatLongDate, monthDays, monthTitle, todayISO } from '../lib/date'
import { DEFAULT_COLOR, DEFAULT_ICON, HABIT_COLORS, HABIT_ICONS } from '../lib/palette'

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  )
}

function cellKey(habitId: string, date: string): string {
  return `${habitId}|${date}`
}

export class App {
  private readonly root: HTMLElement
  private year: number
  private month: number

  private habits: Habit[] = []
  private doneKeys = new Set<string>()

  private editing: Habit | null = null
  private draftIcon: string = DEFAULT_ICON
  private draftColor: string = DEFAULT_COLOR

  private matrix!: HTMLElement
  private empty!: HTMLElement
  private matrixWrap!: HTMLElement
  private monthTitleEl!: HTMLElement
  private sheet!: HTMLDialogElement
  private form!: HTMLFormElement
  private nameInput!: HTMLInputElement
  private sheetTitle!: HTMLElement
  private deleteButton!: HTMLButtonElement
  private iconGrid!: HTMLElement
  private colorGrid!: HTMLElement

  constructor(root: HTMLElement) {
    this.root = root
    const today = new Date()
    this.year = today.getFullYear()
    this.month = today.getMonth()
  }

  async start(): Promise<void> {
    await seedIfFirstRun()
    this.renderShell()
    this.bindEvents()
    await this.refresh({ scrollToToday: true })
  }

  private renderShell(): void {
    this.root.innerHTML = `
      <div class="app">
        <header class="topbar">
          <h1 class="brand">Hábitos</h1>
          <button class="today-btn" type="button" data-today>Hoy</button>
        </header>

        <div class="monthbar">
          <button class="icon-btn" type="button" data-nav="-1" aria-label="Mes anterior">‹</button>
          <h2 id="month-title" class="month-title"></h2>
          <button class="icon-btn" type="button" data-nav="1" aria-label="Mes siguiente">›</button>
        </div>

        <main class="matrix-wrap" id="matrix-wrap">
          <div class="matrix" id="matrix" aria-label="Hábitos por días"></div>
          <div class="empty" id="empty" hidden>
            <p class="empty-icon" aria-hidden="true">🗓️</p>
            <h2>Tu matriz está vacía</h2>
            <p>Añade un hábito y empieza a marcar días.</p>
            <button class="btn primary" type="button" data-add>Crear hábito</button>
          </div>
        </main>

        <p class="hint">Toca un día para marcarlo. Desliza para ver el mes completo.</p>

        <button class="fab" type="button" data-add aria-label="Añadir hábito">+</button>

        <dialog class="sheet" id="sheet" aria-labelledby="sheet-title">
          <form class="sheet-form" id="habit-form" novalidate>
            <header class="sheet-head">
              <h2 id="sheet-title">Nuevo hábito</h2>
              <button class="icon-btn" type="button" data-close aria-label="Cerrar">✕</button>
            </header>

            <label class="field">
              <span>Nombre</span>
              <input
                id="habit-name"
                type="text"
                maxlength="32"
                placeholder="Leer"
                autocomplete="off"
                required
              />
            </label>

            <fieldset class="field">
              <legend>Icono</legend>
              <div class="icon-grid" id="icon-grid"></div>
            </fieldset>

            <fieldset class="field">
              <legend>Color</legend>
              <div class="color-grid" id="color-grid"></div>
            </fieldset>

            <div class="sheet-actions">
              <button class="btn danger" type="button" id="habit-delete" hidden>Eliminar</button>
              <button class="btn primary" type="submit">Guardar</button>
            </div>
          </form>
        </dialog>
      </div>
    `

    const byId = <T extends HTMLElement>(id: string): T => {
      const element = this.root.querySelector<T>(`#${id}`)
      if (!element) throw new Error(`Falta el elemento #${id}`)
      return element
    }

    this.matrix = byId('matrix')
    this.empty = byId('empty')
    this.matrixWrap = byId('matrix-wrap')
    this.monthTitleEl = byId('month-title')
    this.sheet = byId<HTMLDialogElement>('sheet')
    this.form = byId<HTMLFormElement>('habit-form')
    this.nameInput = byId<HTMLInputElement>('habit-name')
    this.sheetTitle = byId('sheet-title')
    this.deleteButton = byId<HTMLButtonElement>('habit-delete')
    this.iconGrid = byId('icon-grid')
    this.colorGrid = byId('color-grid')
  }

  private bindEvents(): void {
    const form = this.form
    const sheet = this.sheet

    this.root.addEventListener('click', (event) => {
      const target = event.target as HTMLElement

      if (target.closest('[data-add]')) {
        this.openEditor(null)
        return
      }

      if (target.closest('[data-today]')) {
        const today = new Date()
        this.year = today.getFullYear()
        this.month = today.getMonth()
        void this.refresh({ scrollToToday: true })
        return
      }

      const nav = target.closest<HTMLElement>('[data-nav]')
      if (nav) {
        const delta = Number(nav.dataset.nav)
        const next = addMonths(this.year, this.month, delta)
        this.year = next.year
        this.month = next.month
        void this.refresh()
        return
      }

      if (target.closest('[data-close]')) {
        sheet.close()
        return
      }

      const editButton = target.closest<HTMLElement>('[data-edit]')
      if (editButton) {
        const habit = this.habits.find((item) => item.id === editButton.dataset.edit)
        if (habit) this.openEditor(habit)
        return
      }

      const iconOption = target.closest<HTMLElement>('[data-icon]')
      if (iconOption) {
        this.draftIcon = iconOption.dataset.icon ?? this.draftIcon
        this.renderPickers()
        return
      }

      const colorOption = target.closest<HTMLElement>('[data-color]')
      if (colorOption) {
        this.draftColor = colorOption.dataset.color ?? this.draftColor
        this.renderPickers()
        return
      }

      const cell = target.closest<HTMLButtonElement>('button.cell')
      if (cell && !cell.disabled) void this.toggleCell(cell)
    })

    form.addEventListener('submit', (event) => {
      event.preventDefault()
      void this.saveHabit()
    })

    this.deleteButton.addEventListener('click', () => {
      void this.removeHabit()
    })

    sheet.addEventListener('click', (event) => {
      if (event.target === sheet) sheet.close()
    })
  }

  private async refresh(options: { scrollToToday?: boolean } = {}): Promise<void> {
    const days = monthDays(this.year, this.month)
    const from = days[0]?.iso ?? ''
    const to = days[days.length - 1]?.iso ?? ''

    const [habits, checkins] = await Promise.all([listHabits(), listCheckins(from, to)])

    this.habits = habits
    this.doneKeys = new Set(
      checkins.filter((checkin) => checkin.done).map((checkin) => cellKey(checkin.habitId, checkin.date)),
    )

    this.monthTitleEl.textContent = monthTitle(this.year, this.month)
    this.renderMatrix()

    if (options.scrollToToday) {
      this.scrollToToday()
    }
  }

  private renderMatrix(): void {
    const days = monthDays(this.year, this.month)
    const today = todayISO()
    const hasHabits = this.habits.length > 0

    this.matrix.hidden = !hasHabits
    this.empty.hidden = hasHabits

    if (!hasHabits) {
      this.matrix.innerHTML = ''
      return
    }

    this.matrix.style.setProperty('--days', String(days.length))

    let html = '<div class="corner" aria-hidden="true"></div>'

    for (const day of days) {
      const classes = ['day-head']
      if (day.iso === today) classes.push('today')
      if (day.iso > today) classes.push('future')

      html += `
        <div class="${classes.join(' ')}" aria-label="${escapeHtml(formatLongDate(day.iso))}">
          <span class="dw">${day.letter}</span>
          <span class="dn">${day.day}</span>
        </div>
      `
    }

    for (const habit of this.habits) {
      html += `
        <div class="habit-name" style="--c:${habit.color}">
          <span class="habit-icon" aria-hidden="true">${habit.icon}</span>
          <button
            class="habit-label"
            type="button"
            data-edit="${habit.id}"
            title="Editar ${escapeHtml(habit.name)}"
          >${escapeHtml(habit.name)}</button>
        </div>
      `

      for (const day of days) {
        const done = this.doneKeys.has(cellKey(habit.id, day.iso))
        const isFuture = day.iso > today
        const classes = ['cell']
        if (done) classes.push('done')
        if (day.iso === today) classes.push('today')
        if (isFuture) classes.push('future')

        html += `
          <button
            class="${classes.join(' ')}"
            type="button"
            style="--c:${habit.color}"
            data-habit="${habit.id}"
            data-date="${day.iso}"
            aria-pressed="${done}"
            aria-label="${escapeHtml(`${habit.name}, ${formatLongDate(day.iso)}: ${done ? 'hecho' : 'no hecho'}`)}"
            ${isFuture ? 'disabled' : ''}
          ></button>
        `
      }
    }

    this.matrix.innerHTML = html
  }

  private scrollToToday(): void {
    const today = todayISO()
    requestAnimationFrame(() => {
      const cell = this.matrixWrap.querySelector<HTMLElement>(`[data-date="${today}"]`)
      if (!cell) {
        this.matrixWrap.scrollLeft = 0
        return
      }
      const habitColumn = 116
      this.matrixWrap.scrollLeft = Math.max(0, cell.offsetLeft - habitColumn - 8)
    })
  }

  private async toggleCell(cell: HTMLButtonElement): Promise<void> {
    const habitId = cell.dataset.habit
    const date = cell.dataset.date
    if (!habitId || !date) return

    const habit = this.habits.find((item) => item.id === habitId)
    if (!habit) return

    const key = cellKey(habitId, date)
    const next = !this.doneKeys.has(key)

    if (next) this.doneKeys.add(key)
    else this.doneKeys.delete(key)

    cell.classList.toggle('done', next)
    cell.setAttribute('aria-pressed', String(next))
    cell.setAttribute(
      'aria-label',
      `${habit.name}, ${formatLongDate(date)}: ${next ? 'hecho' : 'no hecho'}`,
    )

    try {
      await setCheckin(habitId, date, next)
    } catch (error) {
      console.error('No se pudo guardar el día', error)
      if (next) this.doneKeys.delete(key)
      else this.doneKeys.add(key)
      cell.classList.toggle('done', !next)
      cell.setAttribute('aria-pressed', String(!next))
    }
  }

  private openEditor(habit: Habit | null): void {
    this.editing = habit
    this.sheetTitle.textContent = habit ? 'Editar hábito' : 'Nuevo hábito'
    this.nameInput.value = habit?.name ?? ''
    this.draftIcon = habit?.icon ?? DEFAULT_ICON
    this.draftColor = habit?.color ?? DEFAULT_COLOR
    this.deleteButton.hidden = habit === null
    this.renderPickers()
    this.sheet.showModal()
    requestAnimationFrame(() => this.nameInput.focus())
  }

  private renderPickers(): void {
    this.iconGrid.innerHTML = HABIT_ICONS.map(
      (icon) => `
        <button
          class="icon-option"
          type="button"
          data-icon="${icon}"
          aria-pressed="${icon === this.draftIcon}"
          aria-label="Icono ${icon}"
        >${icon}</button>
      `,
    ).join('')

    this.colorGrid.innerHTML = HABIT_COLORS.map(
      (color) => `
        <button
          class="color-option"
          type="button"
          data-color="${color}"
          style="--c:${color}"
          aria-pressed="${color === this.draftColor}"
          aria-label="Color ${color}"
        ></button>
      `,
    ).join('')
  }

  private async saveHabit(): Promise<void> {
    const name = this.nameInput.value.trim()
    if (!name) {
      this.nameInput.focus()
      this.nameInput.reportValidity()
      return
    }

    if (this.editing) {
      await updateHabit(this.editing, { name, icon: this.draftIcon, color: this.draftColor })
    } else {
      await createHabit({ name, icon: this.draftIcon, color: this.draftColor })
    }

    this.sheet.close()
    await this.refresh()
  }

  private async removeHabit(): Promise<void> {
    const habit = this.editing
    if (!habit) return

    const confirmed = window.confirm(
      `¿Eliminar 「${habit.name}」 y todo su historial? Esta acción no se puede deshacer.`,
    )
    if (!confirmed) return

    await deleteHabit(habit.id)
    this.sheet.close()
    await this.refresh()
  }
}
