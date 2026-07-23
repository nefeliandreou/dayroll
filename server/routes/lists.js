import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { query } from '../db.js';
import { isValidEmail, normalizeEmail, requireAuth } from '../util.js';
import { applyRollover, toDayKey } from '../rollover.js';

export const listsRouter = Router();
listsRouter.use(requireAuth);

function mapTodo(row) {
  return {
    id: row.id,
    text: row.text,
    completed: row.completed,
    day: row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day).slice(0, 10),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    completedAt: row.completed_at
      ? row.completed_at instanceof Date
        ? row.completed_at.toISOString()
        : row.completed_at
      : null,
    rolledCount: row.rolled_count,
  };
}

async function canAccessList(userId, userEmail, ownerId) {
  if (userId === ownerId) return true;
  const result = await query(
    `SELECT 1 FROM list_shares
     WHERE owner_id = $1 AND shared_with_email = $2
     LIMIT 1`,
    [ownerId, normalizeEmail(userEmail)]
  );
  return result.rowCount > 0;
}

async function getUserEmail(userId) {
  const result = await query('SELECT email FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.email ?? null;
}

listsRouter.get('/', async (req, res) => {
  try {
    const userId = req.session.userId;
    const email = normalizeEmail(req.session.email || (await getUserEmail(userId)));

    const mine = await query('SELECT id, email FROM users WHERE id = $1', [userId]);
    const shared = await query(
      `SELECT u.id, u.email
       FROM list_shares s
       JOIN users u ON u.id = s.owner_id
       WHERE s.shared_with_email = $1
       ORDER BY u.email`,
      [email]
    );

    res.json({
      mine: { ownerId: mine.rows[0].id, email: mine.rows[0].email, label: 'My Dayroll' },
      shared: shared.rows.map((r) => ({
        ownerId: r.id,
        email: r.email,
        label: `${r.email}'s Dayroll`,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load lists' });
  }
});

listsRouter.get('/me/shares', async (req, res) => {
  try {
    const result = await query(
      `SELECT shared_with_email, created_at
       FROM list_shares WHERE owner_id = $1
       ORDER BY shared_with_email`,
      [req.session.userId]
    );
    res.json({
      shares: result.rows.map((r) => ({
        email: r.shared_with_email,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load shares' });
  }
});

listsRouter.post('/me/shares', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Enter a valid email' });
    }
    if (email === normalizeEmail(req.session.email)) {
      return res.status(400).json({ error: 'You already own this list' });
    }

    await query(
      `INSERT INTO list_shares (id, owner_id, shared_with_email)
       VALUES ($1, $2, $3)
       ON CONFLICT (owner_id, shared_with_email) DO NOTHING`,
      [randomUUID(), req.session.userId, email]
    );

    res.status(201).json({ email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not share list' });
  }
});

listsRouter.delete('/me/shares/:email', async (req, res) => {
  try {
    const email = normalizeEmail(req.params.email);
    await query(`DELETE FROM list_shares WHERE owner_id = $1 AND shared_with_email = $2`, [
      req.session.userId,
      email,
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not remove share' });


listsRouter.get('/:ownerId/todos', async (req, res) => {
  try {
    const { ownerId } = req.params;
    const userId = req.session.userId;
    const email = normalizeEmail(req.session.email || (await getUserEmail(userId)));
    const today = String(req.query.today || toDayKey());

    if (!(await canAccessList(userId, email, ownerId))) {
      return res.status(403).json({ error: 'No access to this list' });
    }

    const result = await query(
      `SELECT id, text, completed, day, created_at, completed_at, rolled_count
       FROM todos WHERE owner_id = $1
       ORDER BY completed ASC, created_at DESC`,
      [ownerId]
    );

    const todos = result.rows.map(mapTodo);
    const rolled = applyRollover(todos, today);

    const changed = rolled.filter((t, i) => t.day !== todos[i].day || t.rolledCount !== todos[i].rolledCount);
    for (const t of changed) {
      await query(
        `UPDATE todos SET day = $1, rolled_count = $2 WHERE id = $3 AND owner_id = $4`,
        [t.day, t.rolledCount, t.id, ownerId]
      );
    }

    res.json({ todos: rolled });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load todos' });
  }
});

listsRouter.post('/:ownerId/todos', async (req, res) => {
  try {
    const { ownerId } = req.params;
    const userId = req.session.userId;
    const email = normalizeEmail(req.session.email || (await getUserEmail(userId)));

    if (!(await canAccessList(userId, email, ownerId))) {
      return res.status(403).json({ error: 'No access to this list' });
    }

    const text = String(req.body?.text || '').trim();
    const day = String(req.body?.day || toDayKey());
    if (!text) return res.status(400).json({ error: 'Text is required' });

    const id = randomUUID();
    const createdAt = new Date().toISOString();
    await query(
      `INSERT INTO todos (id, owner_id, text, completed, day, created_at, completed_at, rolled_count)
       VALUES ($1, $2, $3, FALSE, $4, $5, NULL, 0)`,
      [id, ownerId, text, day, createdAt]
    );

    res.status(201).json({
      id,
      text,
      completed: false,
      day,
      createdAt,
      completedAt: null,
      rolledCount: 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create todo' });
  }
});

listsRouter.patch('/:ownerId/todos/:todoId', async (req, res) => {
  try {
    const { ownerId, todoId } = req.params;
    const userId = req.session.userId;
    const email = normalizeEmail(req.session.email || (await getUserEmail(userId)));

    if (!(await canAccessList(userId, email, ownerId))) {
      return res.status(403).json({ error: 'No access to this list' });
    }

    const existing = await query(
      `SELECT id, text, completed, day, created_at, completed_at, rolled_count
       FROM todos WHERE id = $1 AND owner_id = $2`,
      [todoId, ownerId]
    );
    if (existing.rowCount === 0) return res.status(404).json({ error: 'Todo not found' });

    const current = mapTodo(existing.rows[0]);
    const completed =
      typeof req.body?.completed === 'boolean' ? req.body.completed : current.completed;
    const text = req.body?.text != null ? String(req.body.text).trim() : current.text;
    const day = req.body?.day != null ? String(req.body.day) : current.day;

    if (!text) return res.status(400).json({ error: 'Text is required' });

    let completedAt = current.completedAt;
    if (completed && !current.completed) completedAt = new Date().toISOString();
    if (!completed) completedAt = null;

    const updated = await query(
      `UPDATE todos
       SET text = $1, completed = $2, day = $3, completed_at = $4
       WHERE id = $5 AND owner_id = $6
       RETURNING id, text, completed, day, created_at, completed_at, rolled_count`,
      [text, completed, day, completedAt, todoId, ownerId]
    );

    res.json(mapTodo(updated.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update todo' });
  }
});

listsRouter.delete('/:ownerId/todos/:todoId', async (req, res) => {
  try {
    const { ownerId, todoId } = req.params;
    const userId = req.session.userId;
    const email = normalizeEmail(req.session.email || (await getUserEmail(userId)));

    if (!(await canAccessList(userId, email, ownerId))) {
      return res.status(403).json({ error: 'No access to this list' });
    }

    const result = await query(`DELETE FROM todos WHERE id = $1 AND owner_id = $2`, [todoId, ownerId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Todo not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete todo' });
  }
});
