/* ===========================
   Daylist — Smart Daily To-Do List
   Pure Vanilla JS — No Framework
   =========================== */

(function () {
  'use strict';

  // ───── State ─────
  const STATE_KEY = 'daylist_tasks';
  const STREAK_KEY = 'daylist_streak';
  const HISTORY_KEY = 'daylist_history';
  let tasks = JSON.parse(localStorage.getItem(STATE_KEY) || '[]');
  let selectedDate = todayStr();
  let editingId = null;
  let weeklyChart = null;

  // ───── Helpers ─────
  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }
  function $(id) { return document.getElementById(id); }
  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return document.querySelectorAll(sel); }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function saveTasks() {
    localStorage.setItem(STATE_KEY, JSON.stringify(tasks));
  }

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ───── Smart Parser ─────
  function smartParseTime(text) {
    const patterns = [
      { re: /jam\s+(\d{1,2})\s*(?:\.(\d{1,2}))?\s*(pagi|siang|sore|malam)/i, handler: (m) => {
          let h = parseInt(m[1]);
          const min = m[2] ? parseInt(m[2]) : 0;
          const period = m[3].toLowerCase();
          if (period === 'siang' && h < 12) h += 12;
          if (period === 'sore' && h < 12) h += 12;
          if (period === 'malam' && h < 12) h += 12;
          if (period === 'pagi' && h === 12) h = 0;
          return pad(h) + ':' + pad(min);
        }
      },
      { re: /jam\s+(\d{1,2})(?:[:.](\d{1,2}))?/i, handler: (m) => {
          let h = parseInt(m[1]);
          const min = m[2] ? parseInt(m[2]) : 0;
          return pad(h) + ':' + pad(min);
        }
      },
      { re: /pukul\s+(\d{1,2})(?:[:.](\d{1,2}))?/i, handler: (m) => {
          let h = parseInt(m[1]);
          const min = m[2] ? parseInt(m[2]) : 0;
          return pad(h) + ':' + pad(min);
        }
      },
      { re: /(\d{1,2})[:.](\d{2})\s*(am|pm)/i, handler: (m) => {
          let h = parseInt(m[1]);
          const min = parseInt(m[2]);
          if (m[3].toLowerCase() === 'pm' && h < 12) h += 12;
          if (m[3].toLowerCase() === 'am' && h === 12) h = 0;
          return pad(h) + ':' + pad(min);
        }
      }
    ];
    for (const p of patterns) {
      const m = text.match(p.re);
      if (m) return p.handler(m);
    }
    return null;
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  // ───── View Router ─────
  function switchView(viewId, skipNavUpdate) {
    qsa('.view').forEach(v => v.classList.remove('active'));
    $(viewId).classList.add('active');

    // Show/hide bottom nav and fab
    const nav = $('bottom-nav');
    const fab = $('fab-add');
    if (viewId === 'view-add' || viewId === 'view-edit') {
      nav.style.display = 'none';
      fab.style.display = 'none';
    } else {
      nav.style.display = '';
      fab.style.display = '';
    }

    if (!skipNavUpdate) {
      qsa('.nav-item').forEach(n => n.classList.remove('active'));
      const navBtn = qs(`.nav-item[data-view="${viewId}"]`);
      if (navBtn) navBtn.classList.add('active');
    }

    if (viewId === 'view-stats') renderStats();
  }

  // ───── Date Formatting ─────
  const DAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  function formatHeaderDate(date) {
    const d = new Date(date);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  // ───── Calendar Strip ─────
  let calendarOffset = 0;

  function renderCalendar() {
    const strip = $('calendar-strip');
    strip.innerHTML = '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Show 7 days centered around today + offset
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() + calendarOffset - 3);

    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const isToday = dateStr === todayStr();
      const isSelected = dateStr === selectedDate;
      const hasTasks = tasks.some(t => t.date === dateStr);

      const el = document.createElement('div');
      el.className = 'cal-day' +
        (isToday ? ' today' : '') +
        (isSelected ? ' selected' : '') +
        (hasTasks ? ' has-tasks' : '');
      el.dataset.date = dateStr;
      el.innerHTML = `
        <span class="cal-day-name">${DAYS_SHORT[d.getDay()]}</span>
        <span class="cal-day-num">${d.getDate()}</span>
      `;
      el.addEventListener('click', () => {
        selectedDate = dateStr;
        renderCalendar();
        renderTasks();
      });
      strip.appendChild(el);
    }
  }

  // ───── Render Tasks ─────
  function renderTasks(filterText) {
    const list = $('task-list');
    const empty = $('empty-state');
    list.innerHTML = '';

    let filtered = tasks.filter(t => t.date === selectedDate);
    if (filterText) {
      const q = filterText.toLowerCase();
      filtered = filtered.filter(t => t.title.toLowerCase().includes(q));
    }

    // Sort: undone first, then by time
    filtered.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return (a.time || '99:99').localeCompare(b.time || '99:99');
    });

    if (filtered.length === 0) {
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
    }

    filtered.forEach(task => {
      const card = document.createElement('div');
      card.className = 'task-card' + (task.done ? ' done' : '');
      card.dataset.id = task.id;

      const priorityColors = {
        penting: '#FF4757',
        sedang: '#FFA502',
        santai: '#2ED573'
      };

      const bellSVG = task.notif
        ? `<svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`
        : '';

      card.innerHTML = `
        <div class="task-checkbox ${task.done ? 'checked' : ''}" data-id="${task.id}"></div>
        <div class="task-content">
          <p class="task-title">${escHtml(task.title)}</p>
          <div class="task-meta">
            <span class="task-priority ${task.priority}">
              <span class="task-priority-dot" style="background:${priorityColors[task.priority]}"></span>
              ${capitalize(task.priority)}
            </span>
          </div>
        </div>
        <div class="task-right">
          ${task.time ? `<span class="task-time">${task.time}</span>` : ''}
          ${task.notif ? `<span class="task-bell">${bellSVG}</span>` : ''}
        </div>
      `;

      // Checkbox click
      card.querySelector('.task-checkbox').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDone(task.id);
      });

      // Card click → edit
      card.addEventListener('click', () => openEdit(task.id));

      list.appendChild(card);
    });

    // Update calendar dots
    renderCalendar();
  }

  function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ───── Toggle Done ─────
  function toggleDone(id) {
    const t = tasks.find(t => t.id === id);
    if (t) {
      t.done = !t.done;
      saveTasks();
      updateHistory();
      renderTasks();
      if (t.done) toast('✅ Task selesai!');
    }
  }

  // ───── Add Task ─────
  function openAdd() {
    switchView('view-add');
    $('input-title').value = '';
    $('input-time').value = '';
    $('input-notif').checked = true;
    $('smart-hint').textContent = '';
    // Reset priority
    qsa('#view-add .priority-btn').forEach(b => b.classList.remove('selected'));
    qs('#view-add .priority-btn[data-priority="penting"]').classList.add('selected');
    setTimeout(() => $('input-title').focus(), 300);
  }

  function saveTask() {
    const title = $('input-title').value.trim();
    if (!title) { toast('⚠️ Judul tidak boleh kosong'); return; }

    const selectedPriority = qs('#view-add .priority-btn.selected');
    const priority = selectedPriority ? selectedPriority.dataset.priority : 'sedang';

    const task = {
      id: uid(),
      title,
      time: $('input-time').value || '',
      priority,
      notif: $('input-notif').checked,
      done: false,
      date: selectedDate,
      createdAt: Date.now()
    };

    tasks.push(task);
    saveTasks();
    scheduleNotification(task);
    switchView('view-tasks');
    renderTasks();
    toast('✨ Task ditambahkan!');
  }

  // ───── Edit Task ─────
  function openEdit(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    editingId = id;
    switchView('view-edit');
    $('edit-title').value = task.title;
    $('edit-time').value = task.time || '';
    $('edit-notif').checked = task.notif;
    qsa('#edit-priority-btns .priority-btn').forEach(b => {
      b.classList.toggle('selected', b.dataset.priority === task.priority);
    });
  }

  function updateTask() {
    const t = tasks.find(t => t.id === editingId);
    if (!t) return;
    t.title = $('edit-title').value.trim();
    if (!t.title) { toast('⚠️ Judul tidak boleh kosong'); return; }
    t.time = $('edit-time').value || '';
    t.notif = $('edit-notif').checked;
    const selP = qs('#edit-priority-btns .priority-btn.selected');
    t.priority = selP ? selP.dataset.priority : t.priority;
    saveTasks();
    scheduleNotification(t);
    switchView('view-tasks');
    renderTasks();
    toast('📝 Task diperbarui!');
  }

  function deleteTask() {
    if (confirm('Hapus task ini?')) {
      tasks = tasks.filter(t => t.id !== editingId);
      saveTasks();
      switchView('view-tasks');
      renderTasks();
      toast('🗑️ Task dihapus');
    }
  }

  // ───── Notifications ─────
  function requestNotifPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function scheduleNotification(task) {
    if (!task.notif || !task.time || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const [h, m] = task.time.split(':').map(Number);
    const target = new Date(task.date);
    target.setHours(h, m, 0, 0);
    const delay = target.getTime() - Date.now();
    if (delay <= 0) return;

    setTimeout(() => {
      new Notification('Daylist — Pengingat', {
        body: task.title,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: task.id,
        requireInteraction: true
      });
    }, delay);
  }

  // Schedule all future notifications on load
  function scheduleAllNotifications() {
    tasks.forEach(t => {
      if (!t.done) scheduleNotification(t);
    });
  }

  // ───── History & Streak ─────
  function updateHistory() {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}');
    const today = todayStr();
    const todayTasks = tasks.filter(t => t.date === today);
    const done = todayTasks.filter(t => t.done).length;
    history[today] = { total: todayTasks.length, done };
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    updateStreak(history);
  }

  function updateStreak(history) {
    let streak = 0;
    const d = new Date();
    while (true) {
      const ds = d.toISOString().slice(0, 10);
      const h = history[ds];
      if (h && h.total > 0 && h.done === h.total) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else if (ds === todayStr()) {
        // today might not be complete yet, check if there are tasks
        d.setDate(d.getDate() - 1);
        continue;
      } else {
        break;
      }
    }
    localStorage.setItem(STREAK_KEY, streak);
  }

  // ───── Stats ─────
  function renderStats() {
    const allTasks = tasks;
    const done = allTasks.filter(t => t.done).length;
    const pending = allTasks.filter(t => !t.done).length;
    const total = allTasks.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    $('stat-done').textContent = done;
    $('stat-pending').textContent = pending;
    $('stat-productivity').textContent = pct + '%';
    $('streak-count').textContent = localStorage.getItem(STREAK_KEY) || '0';

    renderWeeklyChart();
  }

  function renderWeeklyChart() {
    const ctx = $('weekly-chart');
    if (!ctx) return;

    const labels = [];
    const dataCompleted = [];
    const dataTotal = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      labels.push(DAYS_SHORT[d.getDay()]);
      const dayTasks = tasks.filter(t => t.date === ds);
      dataTotal.push(dayTasks.length);
      dataCompleted.push(dayTasks.filter(t => t.done).length);
    }

    if (weeklyChart) weeklyChart.destroy();

    weeklyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Selesai',
            data: dataCompleted,
            borderColor: '#4A6CF7',
            backgroundColor: 'rgba(74,108,247,0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointBackgroundColor: '#4A6CF7',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            borderWidth: 3,
          },
          {
            label: 'Total',
            data: dataTotal,
            borderColor: '#B0B5C3',
            backgroundColor: 'rgba(176,181,195,0.05)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#B0B5C3',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            borderWidth: 2,
            borderDash: [6, 4],
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 8,
              font: { family: 'Inter', size: 12, weight: '600' },
              padding: 16,
            }
          },
          tooltip: {
            backgroundColor: '#1A1D26',
            titleFont: { family: 'Inter', size: 13 },
            bodyFont: { family: 'Inter', size: 12 },
            padding: 12,
            cornerRadius: 10,
            displayColors: true,
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
              font: { family: 'Inter', size: 11 },
              color: '#B0B5C3',
            },
            grid: { color: 'rgba(0,0,0,0.04)' },
            border: { display: false },
          },
          x: {
            ticks: {
              font: { family: 'Inter', size: 11, weight: '600' },
              color: '#7C8293',
            },
            grid: { display: false },
            border: { display: false },
          }
        }
      }
    });
  }

  // ───── Event Listeners ─────
  function init() {
    // Header date
    $('header-date').textContent = formatHeaderDate(new Date());

    // Render
    renderCalendar();
    renderTasks();

    // Bottom nav
    qsa('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        switchView(btn.dataset.view);
      });
    });

    // FAB
    $('fab-add').addEventListener('click', openAdd);

    // Back buttons
    $('btn-back-add').addEventListener('click', () => {
      switchView('view-tasks');
    });
    $('btn-back-edit').addEventListener('click', () => {
      switchView('view-tasks');
    });

    // Save / Update / Delete
    $('btn-save').addEventListener('click', saveTask);
    $('btn-update').addEventListener('click', updateTask);
    $('btn-delete-task').addEventListener('click', deleteTask);

    // Priority buttons (Add)
    qsa('#view-add .priority-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        qsa('#view-add .priority-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    // Priority buttons (Edit)
    qsa('#edit-priority-btns .priority-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        qsa('#edit-priority-btns .priority-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    // Smart parser
    $('input-title').addEventListener('input', (e) => {
      const parsed = smartParseTime(e.target.value);
      if (parsed) {
        $('input-time').value = parsed;
        $('smart-hint').textContent = `⏰ Waktu otomatis: ${parsed}`;
      } else {
        $('smart-hint').textContent = '';
      }
    });

    // Search
    $('btn-search').addEventListener('click', () => {
      $('search-bar').classList.toggle('open');
      if ($('search-bar').classList.contains('open')) {
        $('search-input').focus();
      }
    });
    $('search-close').addEventListener('click', () => {
      $('search-bar').classList.remove('open');
      $('search-input').value = '';
      renderTasks();
    });
    $('search-input').addEventListener('input', (e) => {
      renderTasks(e.target.value);
    });

    // Calendar arrows
    $('cal-left').addEventListener('click', () => {
      calendarOffset -= 7;
      renderCalendar();
    });
    $('cal-right').addEventListener('click', () => {
      calendarOffset += 7;
      renderCalendar();
    });

    // Settings
    $('setting-notif').addEventListener('change', (e) => {
      if (e.target.checked) requestNotifPermission();
    });

    $('btn-clear-all').addEventListener('click', () => {
      if (confirm('Hapus semua data? Tindakan ini tidak dapat diurungkan.')) {
        tasks = [];
        saveTasks();
        localStorage.removeItem(STREAK_KEY);
        localStorage.removeItem(HISTORY_KEY);
        renderTasks();
        toast('🗑️ Semua data dihapus');
      }
    });

    // Notifications
    requestNotifPermission();
    scheduleAllNotifications();

    // Update history on load
    updateHistory();

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  // ───── Boot ─────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
