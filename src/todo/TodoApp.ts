import { addDays, formatDayLabel, toDayKey } from './dates';
import { api } from './api';
import type { AuthUser } from './AuthScreen';
import type { DayKey, Todo } from './types';

type ListRef = { ownerId: string; email: string; label: string };

export class TodoApp {
  private user: AuthUser;
  private root: HTMLElement;
  private viewDay: DayKey;
  private activeOwnerId: string;
  private lists: { mine: ListRef; shared: ListRef[] } | null = null;
  private todos: Todo[] = [];
  private shares: { email: string }[] = [];
  private showShare = false;
  private error = '';
  private loading = true;

  constructor(root: HTMLElement, user: AuthUser) {
    this.root = root;
    this.user = user;
    this.viewDay = toDayKey();
    this.activeOwnerId = user.id;
    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    try {
      this.lists = await api.lists();
      this.activeOwnerId = this.lists.mine.ownerId;
      await this.reloadTodos();
      if (this.isMine()) {
        const { shares } = await api.shares();
        this.shares = shares;
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to load';
    } finally {
      this.loading = false;
      this.render();
    }
  }

  private isMine(): boolean {
    return this.activeOwnerId === this.user.id;
  }

  private activeLabel(): string {
    if (!this.lists) return 'Dayroll';
    if (this.isMine()) return this.lists.mine.label;
    return this.lists.shared.find((l) => l.ownerId === this.activeOwnerId)?.label ?? 'Shared list';
  }

  private todosForView(): { open: Todo[]; done: Todo[] } {
    const forDay = this.todos.filter((t) => t.day === this.viewDay);
    return {
      open: forDay.filter((t) => !t.completed),
      done: forDay.filter((t) => t.completed),
    };
  }

  private async reloadTodos(): Promise<void> {
    const today = toDayKey();
    const { todos } = await api.todos(this.activeOwnerId, today);
    this.todos = todos;
  }

  private async addTodo(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      const todo = await api.createTodo(this.activeOwnerId, trimmed, this.viewDay);
      this.todos = [todo, ...this.todos];
      this.error = '';
      this.render();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Could not add';
      this.render();
    }
  }

  private async toggleTodo(id: string): Promise<void> {
    const current = this.todos.find((t) => t.id === id);
    if (!current) return;
    try {
      const updated = await api.updateTodo(this.activeOwnerId, id, { completed: !current.completed });
      this.todos = this.todos.map((t) => (t.id === id ? updated : t));
      this.render();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Could not update';
      this.render();
    }
  }

  private async deleteTodo(id: string): Promise<void> {
    try {
      await api.deleteTodo(this.activeOwnerId, id);
      this.todos = this.todos.filter((t) => t.id !== id);
      this.render();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Could not delete';
      this.render();
    }
  }

  private shiftDay(delta: number): void {
    this.viewDay = addDays(this.viewDay, delta);
    if (this.viewDay === toDayKey()) {
      void this.refreshToday();
      return;
    }
    this.render();
  }

  private async refreshToday(): Promise<void> {
    this.viewDay = toDayKey();
    try {
      await this.reloadTodos();
      this.error = '';
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Could not refresh';
    }
    this.render();
  }

  private async switchList(ownerId: string): Promise<void> {
    this.activeOwnerId = ownerId;
    this.showShare = false;
    this.loading = true;
    this.render();
    try {
      await this.reloadTodos();
      if (this.isMine()) {
        const { shares } = await api.shares();
        this.shares = shares;
      }
      this.error = '';
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Could not switch list';
    } finally {
      this.loading = false;
      this.render();
    }
  }

  private async addShare(email: string): Promise<void> {
    try {
      await api.addShare(email);
      const { shares } = await api.shares();
      this.shares = shares;
      this.error = '';
      this.render();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Could not share';
      this.render();
    }
  }

  private async removeShare(email: string): Promise<void> {
    try {
      await api.removeShare(email);
      this.shares = this.shares.filter((s) => s.email !== email);
      this.render();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Could not remove share';
      this.render();
    }
  }

  private async logout(): Promise<void> {
    await api.logout();
    window.location.reload();
  }

  private render(): void {
    const today = toDayKey();
    const { open, done } = this.todosForView();
    const isToday = this.viewDay === today;
    const label = formatDayLabel(this.viewDay, today);
    const listOptions = this.lists
      ? [this.lists.mine, ...this.lists.shared]
          .map(
            (l) =>
              `<option value="${l.ownerId}" ${l.ownerId === this.activeOwnerId ? 'selected' : ''}>${escapeHtml(l.label)}</option>`
          )
          .join('')
      : '';

    this.root.innerHTML = `
      <div class="dayroll">
        <header class="dayroll__hero">
          <div class="dayroll__top">
            <p class="dayroll__brand">Dayroll</p>
            <button type="button" class="linkish" data-action="logout">Sign out</button>
          </div>
          <h1 class="dayroll__title">What carries forward</h1>
          <p class="dayroll__lede">Signed in as ${escapeHtml(this.user.email)}</p>
        </header>

        <section class="dayroll__panel" aria-label="Daily list">
          <div class="list-switch">
            <label>
              <span class="visually-hidden">Active list</span>
              <select data-action="switch-list">${listOptions}</select>
            </label>
            ${
              this.isMine()
                ? `<button type="button" class="ghost-btn" data-action="toggle-share">${this.showShare ? 'Hide sharing' : 'Share list'}</button>`
                : `<p class="shared-note">You can edit this shared list.</p>`
            }
          </div>

          ${this.showShare && this.isMine() ? this.renderSharePanel() : ''}
          ${this.error ? `<p class="auth-error" role="alert">${escapeHtml(this.error)}</p>` : ''}
          ${this.loading ? `<p class="dayroll__empty">Loading…</p>` : ''}

          <div class="dayroll__daybar">
            <button type="button" class="dayroll__nav" data-action="prev" aria-label="Previous day">‹</button>
            <div class="dayroll__daymeta">
              <p class="dayroll__daylabel">${escapeHtml(label)}</p>
              <p class="dayroll__daydate">${escapeHtml(this.viewDay)} · ${escapeHtml(this.activeLabel())}</p>
            </div>
            <button type="button" class="dayroll__nav" data-action="next" aria-label="Next day">›</button>
          </div>
          ${
            isToday
              ? ''
              : `<button type="button" class="dayroll__today" data-action="today">Back to today</button>`
          }

          <form class="dayroll__add" data-form="add">
            <label class="visually-hidden" for="todo-input">New task</label>
            <input
              id="todo-input"
              name="text"
              type="text"
              maxlength="200"
              placeholder="${isToday ? 'Add something for today…' : 'Add something for this day…'}"
              autocomplete="off"
            />
            <button type="submit" class="dayroll__add-btn">Add</button>
          </form>

          <div class="dayroll__lists">
            ${renderList('Open', open, false)}
            ${done.length ? renderList('Done', done, true) : ''}
            ${
              !this.loading && open.length === 0 && done.length === 0
                ? `<p class="dayroll__empty">Nothing here yet. Add a task above.</p>`
                : ''
            }
          </div>
        </section>
      </div>
    `;

    this.bind();
  }

  private renderSharePanel(): string {
    const rows = this.shares
      .map(
        (s) => `
        <li class="share-row">
          <span>${escapeHtml(s.email)}</span>
          <button type="button" class="linkish" data-unshare="${escapeHtml(s.email)}">Remove</button>
        </li>`
      )
      .join('');

    return `
      <div class="share-panel">
        <p class="share-copy">People you share with can view and edit this list after they create an account with that email.</p>
        <form class="share-form" data-form="share">
          <input name="email" type="email" required placeholder="friend@email.com" />
          <button type="submit" class="dayroll__add-btn">Share</button>
        </form>
        <ul class="share-list">${rows || '<li class="dayroll__empty">Not shared with anyone yet.</li>'}</ul>
      </div>
    `;
  }

  private bind(): void {
    this.root.querySelector('[data-action="prev"]')?.addEventListener('click', () => this.shiftDay(-1));
    this.root.querySelector('[data-action="next"]')?.addEventListener('click', () => this.shiftDay(1));
    this.root.querySelector('[data-action="today"]')?.addEventListener('click', () => void this.refreshToday());
    this.root.querySelector('[data-action="logout"]')?.addEventListener('click', () => void this.logout());
    this.root.querySelector('[data-action="toggle-share"]')?.addEventListener('click', () => {
      this.showShare = !this.showShare;
      this.render();
    });

    const select = this.root.querySelector<HTMLSelectElement>('[data-action="switch-list"]');
    select?.addEventListener('change', () => void this.switchList(select.value));

    const form = this.root.querySelector<HTMLFormElement>('[data-form="add"]');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector<HTMLInputElement>('input[name="text"]');
      if (!input) return;
      void this.addTodo(input.value).then(() => input.focus());
    });

    const shareForm = this.root.querySelector<HTMLFormElement>('[data-form="share"]');
    shareForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = shareForm.querySelector<HTMLInputElement>('input[name="email"]');
      if (!input) return;
      void this.addShare(input.value);
    });

    this.root.querySelectorAll<HTMLElement>('[data-toggle]').forEach((el) => {
      el.addEventListener('click', () => void this.toggleTodo(el.dataset.toggle!));
    });
    this.root.querySelectorAll<HTMLElement>('[data-delete]').forEach((el) => {
      el.addEventListener('click', () => void this.deleteTodo(el.dataset.delete!));
    });
    this.root.querySelectorAll<HTMLElement>('[data-unshare]').forEach((el) => {
      el.addEventListener('click', () => void this.removeShare(el.dataset.unshare!));
    });
  }
}

function renderList(title: string, todos: Todo[], completed: boolean): string {
  if (todos.length === 0 && !completed) {
    return `<div class="dayroll__group"><h2 class="dayroll__group-title">${title}</h2><p class="dayroll__empty">All clear for this day.</p></div>`;
  }
  if (todos.length === 0) return '';

  const items = todos
    .map((t) => {
      const rolled =
        t.rolledCount > 0 && !t.completed
          ? `<span class="dayroll__rolled">carried ×${t.rolledCount}</span>`
          : '';
      return `
        <li class="dayroll__item ${completed ? 'is-done' : ''}">
          <button
            type="button"
            class="dayroll__check"
            data-toggle="${t.id}"
            aria-pressed="${t.completed}"
            aria-label="${t.completed ? 'Mark incomplete' : 'Mark complete'}"
          ></button>
          <div class="dayroll__body">
            <span class="dayroll__text">${escapeHtml(t.text)}</span>
            ${rolled}
          </div>
          <button type="button" class="dayroll__delete" data-delete="${t.id}" aria-label="Delete task">×</button>
        </li>
      `;
    })
    .join('');

  return `
    <div class="dayroll__group">
      <h2 class="dayroll__group-title">${title}</h2>
      <ul class="dayroll__list">${items}</ul>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
