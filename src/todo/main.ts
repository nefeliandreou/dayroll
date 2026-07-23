import { AuthScreen } from './AuthScreen';
import { TodoApp } from './TodoApp';
import { api } from './api';
import './styles.css';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app root');

async function boot() {
  try {
    const user = await api.me();
    new TodoApp(root, user);
  } catch {
    const auth = new AuthScreen(root, (user) => {
      new TodoApp(root, user);
    });
    auth.render('login');
  }
}

void boot();
