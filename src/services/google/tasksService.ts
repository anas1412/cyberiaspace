/**
 * Google Tasks Service
 */

const TASKS_API_URL = 'https://tasks.googleapis.com/tasks/v1';

export const tasksService = {
  ensureTaskList: async (token: string, title: string = 'Cyberia Tasks') => {
    try {
      const res = await fetch(`${TASKS_API_URL}/users/@me/lists`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        console.error('[Google Tasks] Failed to fetch lists:', err);
        throw new Error(`Failed to fetch lists: ${err.error?.message || res.statusText}`);
      }
      
      const data = await res.json();
      const list = data.items?.find((l: any) => l.title === title);
      if (list) return list.id;

      const createRes = await fetch(`${TASKS_API_URL}/users/@me/lists`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title })
      });
      
      if (!createRes.ok) {
        const err = await createRes.json();
        console.error('[Google Tasks] Failed to create list:', err);
        throw new Error(`Failed to create list: ${err.error?.message || createRes.statusText}`);
      }

      const newList = await createRes.json();
      return newList.id;
    } catch (err) {
      console.error('[Google Tasks] Error in ensureTaskList:', err);
      throw err;
    }
  },

  syncTasks: async (token: string, listId: string | undefined | null, tasks: { text: string; done: boolean }[]) => {
    if (!listId) return false;

    try {
      // 1. Get existing tasks in the list to avoid duplicates
      const res = await fetch(`${TASKS_API_URL}/lists/${listId}/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch tasks');
      
      const existing = await res.json();
      const existingTasks = existing.items || [];

      // 2. Sync loop
      for (const task of tasks) {
        if (!task.text.trim()) continue;

        const exists = existingTasks.find((t: any) => t.title === task.text);
        
        if (!exists) {
          // Create new task
          await fetch(`${TASKS_API_URL}/lists/${listId}/tasks`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              title: task.text,
              status: task.done ? 'completed' : 'needsAction'
            })
          });
        } else if ((exists.status === 'completed') !== task.done) {
          // Update status if it changed in Cyberia
          await fetch(`${TASKS_API_URL}/lists/${listId}/tasks/${exists.id}`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              status: task.done ? 'completed' : 'needsAction'
            })
          });
        }
      }
      return true;
    } catch (err) {
      console.error('[Google Tasks] Sync error:', err);
      return false;
    }
  },

  deleteTaskList: async (token: string, listId: string) => {
    const response = await fetch(`${TASKS_API_URL}/users/@me/lists/${listId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) return true;
      throw new Error('Tasks Delete Failed');
    }
    return true;
  }
};
