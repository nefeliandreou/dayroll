import { api } from './api';

export type AuthUser = { id: string; email: string };

export class AuthScreen {
  constructor(
    private root: HTMLElement,
    private onAuthed: (user: AuthUser) => void
  ) {}

  render(mode: 'login' | 'register' = 'login', error = ''): void {
    const isLogin = mode === 'login';
    this.root.innerHTML = `
      <div class="dayroll dayroll--auth">
        <header class="dayroll__hero">
          <p class="dayroll__brand">Dayroll</p>
          <h1 class="dayroll__title">${isLogin ? 'Sign in' : 'Create account'}</h1>
          <p class="dayroll__lede">Your list stays private. Share it only with people you choose.</p>
        </header>
        <section class="dayroll__panel">
          <form class="auth-form" data-form="auth">
            <label>
              <span>Email</span>
              <input name="email" type="email" required autocomplete="email" />
            </label>
            <label>
              <span>Password</span>
              <input name="password" type="password" required minlength="8" autocomplete="${isLogin ? 'current-password' : 'new-password'}" />
            </label>
            ${error ? `<p class="auth-error" role="alert">${escapeHtml(error)}</p>` : ''}
            <button type="submit" class="dayroll__add-btn auth-submit">${isLogin ? 'Sign in' : 'Create account'}</button>
          </form>
          <p class="auth-switch">
            ${
              isLogin
                ? `No account? <button type="button" data-mode="register">Create one</button>`
                : `Have an account? <button type="button" data-mode="login">Sign in</button>`
            }
          </p>
        </section>
      </div>
    `;

    this.root.querySelector('[data-mode="register"]')?.addEventListener('click', () => this.render('register'));
    this.root.querySelector('[data-mode="login"]')?.addEventListener('click', () => this.render('login'));

    const form = this.root.querySelector<HTMLFormElement>('[data-form="auth"]');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const email = String(fd.get('email') || '');
      const password = String(fd.get('password') || '');
      const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (btn) btn.disabled = true;
      try {
        const user = isLogin ? await api.login(email, password) : await api.register(email, password);
        this.onAuthed(user);
      } catch (err) {
        this.render(mode, err instanceof Error ? err.message : 'Something went wrong');
      }
    });
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
