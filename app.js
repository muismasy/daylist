/* ===========================
   Daylist v2.0 — Smart Daily To-Do List
   =========================== */

(function () {
  'use strict';

  // ───── State ─────
  const STATE_KEY = 'daylist_tasks';
  const STREAK_KEY = 'daylist_streak';
  const HISTORY_KEY = 'daylist_history';
  const SETTINGS_KEY = 'daylist_settings';
  
  let tasks = JSON.parse(localStorage.getItem(STATE_KEY) || '[]');
  let settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{"dark":false,"notif":true}');
  let selectedDate = todayStr();
  let activeCategory = 'all';
  let editingId = null;
  let weeklyChart = null;

  // Realtime date tracking
  let currentToday = todayStr();
  setInterval(() => {
    const newToday = todayStr();
    if (newToday !== currentToday) {
      currentToday = newToday;
      $('header-date').textContent = formatHeaderDate(new Date());
      renderCalendar();
      if (selectedDate === currentToday) renderTasks();
    }
  }, 60000);

  // ───── Helpers ─────
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function $(id) { return document.getElementById(id); }
  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return document.querySelectorAll(sel); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function saveTasks() { localStorage.setItem(STATE_KEY, JSON.stringify(tasks)); }
  function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
  
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  }

  function escHtml(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function pad(n) { return String(n).padStart(2, '0'); }

  // ───── Smart Parser ─────
  function smartParseTime(text) {
    const patterns = [
      { re: /jam\s+(\d{1,2})\s*(?:\.(\d{1,2}))?\s*(pagi|siang|sore|malam)/i, handler: (m) => {
          let h = parseInt(m[1]); const min = m[2] ? parseInt(m[2]) : 0; const p = m[3].toLowerCase();
          if (p === 'siang' && h < 12) h += 12; if (p === 'sore' && h < 12) h += 12;
          if (p === 'malam' && h < 12) h += 12; if (p === 'pagi' && h === 12) h = 0;
          return pad(h) + ':' + pad(min);
      }},
      { re: /jam\s+(\d{1,2})(?:[:.](\d{1,2}))?/i, handler: (m) => { return pad(parseInt(m[1])) + ':' + pad(m[2] ? parseInt(m[2]) : 0); }},
      { re: /pukul\s+(\d{1,2})(?:[:.](\d{1,2}))?/i, handler: (m) => { return pad(parseInt(m[1])) + ':' + pad(m[2] ? parseInt(m[2]) : 0); }},
      { re: /(\d{1,2})[:.](\d{2})\s*(am|pm)/i, handler: (m) => {
          let h = parseInt(m[1]); const min = parseInt(m[2]);
          if (m[3].toLowerCase() === 'pm' && h < 12) h += 12;
          if (m[3].toLowerCase() === 'am' && h === 12) h = 0;
          return pad(h) + ':' + pad(min);
      }}
    ];
    for (const p of patterns) { const m = text.match(p.re); if (m) return p.handler(m); }
    return null;
  }

  // ───── Theme & Settings ─────
  function applyTheme() {
    if (settings.dark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      const mt = $('meta-theme'); if (mt) mt.setAttribute('content', '#0F1117');
    } else {
      document.documentElement.removeAttribute('data-theme');
      const mt = $('meta-theme'); if (mt) mt.setAttribute('content', '#F5F7FA');
    }
    const sd = $('setting-dark'); if(sd) sd.checked = settings.dark;
    const sn = $('setting-notif'); if(sn) sn.checked = settings.notif;
  }

  // ───── View Router ─────
  function switchView(viewId, skipNavUpdate) {
    qsa('.view').forEach(v => v.classList.remove('active'));
    $(viewId).classList.add('active');
    const nav = $('bottom-nav'), fab = $('fab-add');
    if (viewId === 'view-add' || viewId === 'view-edit') {
      if(nav) nav.style.display = 'none'; 
      if(fab) fab.style.display = 'none';
    } else {
      if(nav) nav.style.display = ''; 
      if(fab) fab.style.display = '';
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
  const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  function formatHeaderDate(date) {
    const d = new Date(date);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  // ───── Calendar Strip ─────
  let calendarOffset = 0;
  function renderCalendar() {
    const strip = $('calendar-strip');
    if(!strip) return;
    strip.innerHTML = '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() + calendarOffset - 3);

    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const isToday = dateStr === currentToday;
      const isSelected = dateStr === selectedDate;
      const hasTasks = tasks.some(t => t.date === dateStr);

      const el = document.createElement('div');
      el.className = 'cal-day' + (isToday ? ' today' : '') + (isSelected ? ' selected' : '') + (hasTasks ? ' has-tasks' : '');
      el.dataset.date = dateStr;
      el.innerHTML = `<span class="cal-day-name">${DAYS_SHORT[d.getDay()]}</span><span class="cal-day-num">${d.getDate()}</span>`;
      el.addEventListener('click', () => { selectedDate = dateStr; renderCalendar(); renderTasks(); });
      strip.appendChild(el);
    }
  }

  // ───── Drag and Drop ─────
  let draggedTaskId = null;
  function handleDragStart(e) {
    draggedTaskId = e.target.closest('.task-card').dataset.id;
    e.target.closest('.task-card').classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedTaskId);
  }
  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const card = e.target.closest('.task-card');
    if (card && card.dataset.id !== draggedTaskId) {
      card.classList.add('drag-over');
    }
  }
  function handleDragLeave(e) {
    const card = e.target.closest('.task-card');
    if (card) card.classList.remove('drag-over');
  }
  function handleDrop(e) {
    e.preventDefault();
    const dropTarget = e.target.closest('.task-card');
    if (dropTarget) dropTarget.classList.remove('drag-over');
    if (!draggedTaskId || !dropTarget || draggedTaskId === dropTarget.dataset.id) return;

    const fromIdx = tasks.findIndex(t => t.id === draggedTaskId);
    const toIdx = tasks.findIndex(t => t.id === dropTarget.dataset.id);
    if (fromIdx > -1 && toIdx > -1) {
      const [movedTask] = tasks.splice(fromIdx, 1);
      tasks.splice(toIdx, 0, movedTask);
      saveTasks();
      renderTasks();
    }
    draggedTaskId = null;
  }
  function handleDragEnd(e) {
    e.target.closest('.task-card').classList.remove('dragging');
    qsa('.task-card').forEach(c => c.classList.remove('drag-over'));
    draggedTaskId = null;
  }

  // ───── Subtask Logic ─────
  let currentSubtasks = [];
  function renderSubtaskInputArea(containerId) {
    const list = $(containerId === 'add' ? 'add-subtask-list' : 'edit-subtask-list');
    if(!list) return;
    list.innerHTML = '';
    currentSubtasks.forEach((st, idx) => {
      const item = document.createElement('div');
      item.className = 'subtask-item' + (st.done ? ' done-sub' : '');
      item.innerHTML = `
        <div class="subtask-check ${st.done ? 'checked' : ''}" data-idx="${idx}"></div>
        <span>${escHtml(st.title)}</span>
        <button type="button" class="subtask-remove" data-idx="${idx}">&times;</button>
      `;
      list.appendChild(item);
    });
  }
  function addSubtask(containerId) {
    const input = $(containerId === 'add' ? 'add-subtask-input' : 'edit-subtask-input');
    const val = input.value.trim();
    if (val) {
      currentSubtasks.push({ title: val, done: false });
      input.value = '';
      renderSubtaskInputArea(containerId);
    }
  }

  // ───── Render Tasks ─────
  function renderTasks(filterText) {
    const list = $('task-list'), empty = $('empty-state');
    if(!list || !empty) return;
    list.innerHTML = '';

    let filtered = tasks.filter(t => t.date === selectedDate);
    if (activeCategory !== 'all') filtered = filtered.filter(t => t.category === activeCategory);
    if (filterText) {
      const q = filterText.toLowerCase();
      filtered = filtered.filter(t => t.title.toLowerCase().includes(q));
    }

    filtered.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return (a.time || '99:99').localeCompare(b.time || '99:99');
    });

    if (filtered.length === 0) empty.classList.remove('hidden');
    else empty.classList.add('hidden');

    filtered.forEach(task => {
      const card = document.createElement('div');
      card.className = 'task-card' + (task.done ? ' done' : '');
      card.dataset.id = task.id;
      // Make card draggable if not done
      if (!task.done) card.draggable = true;

      const prioColors = { penting: '#FF4757', sedang: '#FFA502', santai: '#2ED573' };
      const bellSVG = task.notif ? `<svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>` : '';
      
      let subtaskHtml = '';
      if (task.subtasks && task.subtasks.length > 0) {
        const d = task.subtasks.filter(s => s.done).length;
        const tot = task.subtasks.length;
        const pct = (d/tot)*100;
        subtaskHtml = `
          <div class="task-subtask-progress" style="margin-top:6px;">
            <div class="subtask-bar"><div class="subtask-bar-fill" style="width:${pct}%"></div></div>
            <span>${d}/${tot}</span>
          </div>`;
      }

      let notesHtml = '';
      if (task.notes) {
        notesHtml = `<p class="task-notes-preview">${escHtml(task.notes)}</p>`;
      }

      const catEmojiMap = { kerja:'💼 Kerja', pribadi:'👤 Pribadi', belanja:'🛒 Belanja', belajar:'📚 Belajar', lainnya:'⭐ Lainnya' };
      const catHtml = task.category ? `<span class="task-category cat-${task.category}">${catEmojiMap[task.category] || task.category}</span>` : '';
      const repHtml = (task.repeat && task.repeat !== 'none') ? `<span class="task-repeat-badge">🔁 ${task.repeat==='daily'?'Harian':'Mingguan'}</span>` : '';

      card.innerHTML = `
        <div class="drag-handle"><span></span><span></span><span></span></div>
        <div class="task-checkbox ${task.done ? 'checked' : ''}" data-id="${task.id}"></div>
        <div class="task-content">
          <p class="task-title">${escHtml(task.title)}</p>
          <div class="task-meta">
            ${catHtml}
            <span class="task-priority ${task.priority}"><span class="task-priority-dot" style="background:${prioColors[task.priority]||prioColors.sedang}"></span>${capitalize(task.priority)}</span>
            ${repHtml}
          </div>
          ${notesHtml}
          ${subtaskHtml}
        </div>
        <div class="task-right">
          ${task.time ? `<span class="task-time">${task.time}</span>` : ''}
          <div style="display:flex;gap:6px;align-items:center;">
            ${!task.done ? `<button type="button" class="task-pomo-btn" data-id="${task.id}" aria-label="Pomodoro">⏱️</button>` : ''}
            ${task.notif ? `<span class="task-bell">${bellSVG}</span>` : ''}
          </div>
        </div>
      `;

      card.querySelector('.task-checkbox').addEventListener('click', (e) => { e.stopPropagation(); toggleDone(task.id); });
      const pomoBtn = card.querySelector('.task-pomo-btn');
      if (pomoBtn) pomoBtn.addEventListener('click', (e) => { e.stopPropagation(); openPomo(task); });
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.drag-handle') && !e.target.closest('.task-checkbox') && !e.target.closest('.task-pomo-btn')) openEdit(task.id);
      });

      // Drag events
      if (!task.done) {
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('dragleave', handleDragLeave);
        card.addEventListener('drop', handleDrop);
        card.addEventListener('dragend', handleDragEnd);
      }

      list.appendChild(card);
    });
    renderCalendar();
  }

  // ───── Toggle Done & Repeat Logic ─────
  function toggleDone(id) {
    const t = tasks.find(t => t.id === id);
    if (t) {
      t.done = !t.done;
      // Handle repeat
      if (t.done && t.repeat && t.repeat !== 'none') {
        const nextDate = new Date(t.date);
        if (t.repeat === 'daily') nextDate.setDate(nextDate.getDate() + 1);
        else if (t.repeat === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
        
        const nextDateStr = nextDate.toISOString().slice(0, 10);
        // Check if already exists to prevent duplicate on toggle loop
        const exists = tasks.some(x => x.title === t.title && x.date === nextDateStr && !x.done);
        if (!exists) {
          tasks.push({ ...t, id: uid(), done: false, date: nextDateStr, createdAt: Date.now() });
          toast('🔁 Task dijadwalkan ulang');
        }
      }
      saveTasks(); updateHistory(); renderTasks();
      if (t.done) { toast('✅ Task selesai!'); checkAchievements(); }
    }
  }

  // ───── Add Task ─────
  function openAdd() {
    switchView('view-add');
    $('input-title').value = ''; $('input-time').value = ''; $('input-notes').value = '';
    $('input-notif').checked = settings.notif; $('smart-hint').textContent = '';
    
    qsa('#view-add .priority-btn').forEach(b => b.classList.remove('selected'));
    const pBtn = qs('#view-add .priority-btn[data-priority="sedang"]');
    if(pBtn) pBtn.classList.add('selected');
    
    qsa('#add-category-btns .category-btn').forEach(b => b.classList.remove('selected'));
    const cBtn = qs('#add-category-btns .category-btn[data-cat="kerja"]');
    if(cBtn) cBtn.classList.add('selected');
    
    qsa('#add-repeat-btns .repeat-btn').forEach(b => b.classList.remove('selected'));
    const rBtn = qs('#add-repeat-btns .repeat-btn[data-repeat="none"]');
    if(rBtn) rBtn.classList.add('selected');
    
    currentSubtasks = []; renderSubtaskInputArea('add');
    setTimeout(() => $('input-title').focus(), 300);
  }

  function saveTask() {
    const title = $('input-title').value.trim();
    if (!title) { toast('⚠️ Judul tidak boleh kosong'); return; }
    
    const priBtn = qs('#view-add .priority-btn.selected');
    const priority = priBtn ? priBtn.dataset.priority : 'sedang';
    
    const catBtn = qs('#add-category-btns .category-btn.selected');
    const category = catBtn ? catBtn.dataset.cat : 'kerja';
    
    const repBtn = qs('#add-repeat-btns .repeat-btn.selected');
    const repeat = repBtn ? repBtn.dataset.repeat : 'none';

    const task = {
      id: uid(), title, time: $('input-time').value || '',
      priority, category, repeat, notes: $('input-notes').value.trim(),
      subtasks: [...currentSubtasks], notif: $('input-notif').checked,
      done: false, date: selectedDate, createdAt: Date.now()
    };

    tasks.push(task); saveTasks(); scheduleNotification(task);
    switchView('view-tasks'); renderTasks(); toast('✨ Task ditambahkan!');
    checkAchievements();
  }

  // ───── Edit Task ─────
  function openEdit(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    editingId = id; switchView('view-edit');
    $('edit-title').value = task.title; $('edit-time').value = task.time || '';
    $('edit-notes').value = task.notes || ''; $('edit-notif').checked = task.notif;
    
    qsa('#edit-priority-btns .priority-btn').forEach(b => b.classList.toggle('selected', b.dataset.priority === task.priority));
    qsa('#edit-category-btns .category-btn').forEach(b => b.classList.toggle('selected', b.dataset.cat === task.category));
    qsa('#edit-repeat-btns .repeat-btn').forEach(b => b.classList.toggle('selected', b.dataset.repeat === (task.repeat||'none')));
    
    currentSubtasks = task.subtasks ? JSON.parse(JSON.stringify(task.subtasks)) : [];
    renderSubtaskInputArea('edit');
  }

  function updateTask() {
    const t = tasks.find(t => t.id === editingId);
    if (!t) return;
    t.title = $('edit-title').value.trim();
    if (!t.title) { toast('⚠️ Judul tidak boleh kosong'); return; }
    t.time = $('edit-time').value || ''; t.notes = $('edit-notes').value.trim();
    t.notif = $('edit-notif').checked;
    
    const priBtn = qs('#edit-priority-btns .priority-btn.selected');
    t.priority = priBtn ? priBtn.dataset.priority : t.priority;
    
    const catBtn = qs('#edit-category-btns .category-btn.selected');
    t.category = catBtn ? catBtn.dataset.cat : t.category;
    
    const repBtn = qs('#edit-repeat-btns .repeat-btn.selected');
    t.repeat = repBtn ? repBtn.dataset.repeat : 'none';
    
    t.subtasks = [...currentSubtasks];

    saveTasks(); scheduleNotification(t);
    switchView('view-tasks'); renderTasks(); toast('📝 Task diperbarui!');
  }

  function deleteTask() {
    if (confirm('Hapus task ini?')) {
      tasks = tasks.filter(t => t.id !== editingId);
      saveTasks(); switchView('view-tasks'); renderTasks(); toast('🗑️ Task dihapus');
    }
  }

  // ───── Pomodoro Timer ─────
  let pomoInterval = null;
  let pomoTimeLeft = 25 * 60;
  let pomoState = 'idle'; // idle, running, paused
  const POMO_MAX = 25 * 60;

  function openPomo(task) {
    const ptn = $('pomo-task-name'); if(ptn) ptn.textContent = task.title;
    const po = $('pomo-overlay'); if(po) po.classList.add('open');
    resetPomo();
  }
  function closePomo() {
    const po = $('pomo-overlay'); if(po) po.classList.remove('open');
    clearInterval(pomoInterval);
    pomoState = 'idle';
  }
  function updatePomoUI() {
    const m = Math.floor(pomoTimeLeft / 60); const s = pomoTimeLeft % 60;
    const pt = $('pomo-time'); if(pt) pt.textContent = `${pad(m)}:${pad(s)}`;
    const offset = 534 - (pomoTimeLeft / POMO_MAX) * 534;
    const prf = $('pomo-ring-fg'); if(prf) prf.style.strokeDashoffset = offset;
    const ps = $('pomo-start'); 
    if(ps) ps.textContent = pomoState === 'running' ? 'Jeda' : (pomoTimeLeft < POMO_MAX ? 'Lanjut' : 'Mulai');
  }
  function togglePomo() {
    if (pomoState === 'running') {
      clearInterval(pomoInterval); pomoState = 'paused';
    } else {
      pomoState = 'running';
      pomoInterval = setInterval(() => {
        pomoTimeLeft--; updatePomoUI();
        if (pomoTimeLeft <= 0) {
          clearInterval(pomoInterval); pomoState = 'idle';
          if ('Notification' in window && Notification.permission === 'granted') {
             new Notification('Pomodoro Selesai!', { body: 'Waktunya istirahat.', icon: 'icons/icon-192.png' });
          }
          toast('🍅 Sesi Pomodoro selesai!'); checkAchievements(true);
        }
      }, 1000);
    }
    updatePomoUI();
  }
  function resetPomo() {
    clearInterval(pomoInterval); pomoTimeLeft = POMO_MAX; pomoState = 'idle'; updatePomoUI();
  }

  // ───── Export / Import ─────
  function exportData() {
    const data = { tasks, settings, history: JSON.parse(localStorage.getItem(HISTORY_KEY)||'{}'), streak: localStorage.getItem(STREAK_KEY)||'0' };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `daylist-backup-${todayStr()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast('📤 Data berhasil diexport');
  }
  function importData(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.tasks) {
          tasks = data.tasks; saveTasks();
          if (data.settings) { settings = data.settings; saveSettings(); applyTheme(); }
          if (data.history) localStorage.setItem(HISTORY_KEY, JSON.stringify(data.history));
          if (data.streak) localStorage.setItem(STREAK_KEY, data.streak);
          renderTasks(); renderStats(); toast('📥 Data berhasil diimport');
        } else throw new Error('Format salah');
      } catch (err) { toast('❌ Gagal import data'); }
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  // ───── History, Heatmap & Streak ─────
  function updateHistory() {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}');
    const today = todayStr(); const todayTasks = tasks.filter(t => t.date === today);
    history[today] = { total: todayTasks.length, done: todayTasks.filter(t => t.done).length };
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    updateStreak(history);
  }
  function updateStreak(history) {
    let streak = 0; const d = new Date();
    while (true) {
      const ds = d.toISOString().slice(0, 10); const h = history[ds];
      if (h && h.total > 0 && h.done === h.total) { streak++; d.setDate(d.getDate() - 1); }
      else if (ds === todayStr()) { d.setDate(d.getDate() - 1); continue; }
      else break;
    }
    localStorage.setItem(STREAK_KEY, streak);
  }
  function renderHeatmap() {
    const grid = $('heatmap-grid'); if (!grid) return;
    grid.innerHTML = ''; const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}');
    const today = new Date();
    for (let i = 90; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const h = history[ds] || { done: 0 };
      const cell = document.createElement('div');
      cell.className = 'heatmap-cell';
      if (h.done > 0 && h.done <= 2) cell.classList.add('l1');
      else if (h.done > 2 && h.done <= 4) cell.classList.add('l2');
      else if (h.done > 4 && h.done <= 6) cell.classList.add('l3');
      else if (h.done > 6) cell.classList.add('l4');
      cell.title = `${ds}: ${h.done} task selesai`;
      grid.appendChild(cell);
    }
  }

  // ───── Achievements ─────
  function checkAchievements(pomoDone) {
    const doneCount = tasks.filter(t => t.done).length;
    const streak = parseInt(localStorage.getItem(STREAK_KEY) || '0');
    let ach = JSON.parse(localStorage.getItem('daylist_achievements') || '{"first":false,"pomo":false,"streak7":false,"task10":false}');
    
    if (doneCount >= 1 && !ach.first) { ach.first = true; toast('🏆 Pencapaian: Task Pertama!'); }
    if (doneCount >= 10 && !ach.task10) { ach.task10 = true; toast('🏆 Pencapaian: 10 Task Selesai!'); }
    if (streak >= 7 && !ach.streak7) { ach.streak7 = true; toast('🏆 Pencapaian: 7 Hari Beruntun!'); }
    if (pomoDone && !ach.pomo) { ach.pomo = true; toast('🏆 Pencapaian: Master Fokus!'); }
    
    localStorage.setItem('daylist_achievements', JSON.stringify(ach));
    const vs = $('view-stats');
    if (vs && vs.classList.contains('active')) renderAchievements();
  }
  function renderAchievements() {
    const grid = $('achievements-grid'); if (!grid) return;
    const ach = JSON.parse(localStorage.getItem('daylist_achievements') || '{}');
    const items = [
      { id: 'first', icon: '🐣', name: 'Mulai Melangkah', desc: 'Selesaikan 1 task' },
      { id: 'task10', icon: '🎯', name: 'Si Produktif', desc: 'Selesaikan 10 task' },
      { id: 'streak7', icon: '🔥', name: 'Konsisten', desc: '7 hari beruntun' },
      { id: 'pomo', icon: '🍅', name: 'Master Fokus', desc: 'Selesaikan 1 pomodoro' }
    ];
    grid.innerHTML = items.map(i => `
      <div class="achievement-card ${ach[i.id] ? 'unlocked' : 'locked'}">
        <div class="achievement-icon">${i.icon}</div>
        <div class="achievement-name">${i.name}</div>
        <div class="achievement-desc">${i.desc}</div>
      </div>
    `).join('');
  }

  // ───── Stats ─────
  function renderStats() {
    const allTasks = tasks; const done = allTasks.filter(t => t.done).length;
    const total = allTasks.length; const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    
    const sd = $('stat-done'); if(sd) sd.textContent = done;
    const sp = $('stat-pending'); if(sp) sp.textContent = total - done;
    const sprod = $('stat-productivity'); if(sprod) sprod.textContent = pct + '%';
    const sc = $('streak-count'); if(sc) sc.textContent = localStorage.getItem(STREAK_KEY) || '0';
    
    renderHeatmap(); renderAchievements();
    
    // Weekly Chart
    const ctx = $('weekly-chart'); if (!ctx) return;
    const labels = [], dataCompleted = [], dataTotal = [], today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      labels.push(DAYS_SHORT[d.getDay()]);
      const dayTasks = tasks.filter(t => t.date === d.toISOString().slice(0, 10));
      dataTotal.push(dayTasks.length); dataCompleted.push(dayTasks.filter(t => t.done).length);
    }
    if (weeklyChart) weeklyChart.destroy();
    if(typeof Chart !== 'undefined') {
      weeklyChart = new Chart(ctx, {
        type: 'line', data: { labels, datasets: [
          { label: 'Selesai', data: dataCompleted, borderColor: '#4A6CF7', backgroundColor: 'rgba(74,108,247,0.1)', fill: true, tension: 0.4, borderWidth: 3, pointBackgroundColor: '#4A6CF7', pointBorderColor: '#fff', pointRadius: 5 },
          { label: 'Total', data: dataTotal, borderColor: '#B0B5C3', backgroundColor: 'rgba(176,181,195,0.05)', fill: true, borderDash: [6, 4], borderWidth: 2, tension: 0.4, pointBackgroundColor: '#B0B5C3', pointBorderColor: '#fff', pointRadius: 4 }
        ]},
        options: { 
          responsive: true, maintainAspectRatio: true,
          plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle' } } },
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { grid: { display: false } } } 
        }
      });
    }
  }

  // ───── Notifications ─────
  function requestNotifPermission() { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }
  function scheduleNotification(task) {
    if (!task.notif || !task.time || !('Notification' in window) || Notification.permission !== 'granted') return;
    const [h, m] = task.time.split(':').map(Number);
    const target = new Date(task.date); target.setHours(h, m, 0, 0);
    const delay = target.getTime() - Date.now();
    if (delay > 0) setTimeout(() => new Notification('Daylist', { body: task.title, icon: 'icons/icon-192.png', tag: task.id }), delay);
  }

  // ───── Event Listeners & Init ─────
  function init() {
    applyTheme();
    $('header-date').textContent = formatHeaderDate(new Date());
    renderCalendar(); renderTasks();

    qsa('.nav-item').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
    const fa = $('fab-add'); if(fa) fa.addEventListener('click', openAdd);
    const bba = $('btn-back-add'); if(bba) bba.addEventListener('click', () => switchView('view-tasks'));
    const bbe = $('btn-back-edit'); if(bbe) bbe.addEventListener('click', () => switchView('view-tasks'));
    const bs = $('btn-save'); if(bs) bs.addEventListener('click', saveTask);
    const bu = $('btn-update'); if(bu) bu.addEventListener('click', updateTask);
    const bdt = $('btn-delete-task'); if(bdt) bdt.addEventListener('click', deleteTask);

    // Smart parsers & Selection btns
    const it = $('input-title');
    if(it) it.addEventListener('input', (e) => {
      const parsed = smartParseTime(e.target.value);
      if (parsed) { $('input-time').value = parsed; $('smart-hint').textContent = `⏰ Waktu otomatis: ${parsed}`; }
      else $('smart-hint').textContent = '';
    });

    ['priority', 'category', 'repeat'].forEach(type => {
      qsa(`#view-add .${type}-btn`).forEach(btn => btn.addEventListener('click', () => { qsa(`#view-add .${type}-btn`).forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); }));
      qsa(`#view-edit .${type}-btn`).forEach(btn => btn.addEventListener('click', () => { qsa(`#view-edit .${type}-btn`).forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); }));
    });

    // Subtasks events
    const asb = $('add-subtask-btn'); if(asb) asb.addEventListener('click', () => addSubtask('add'));
    const esb = $('edit-subtask-btn'); if(esb) esb.addEventListener('click', () => addSubtask('edit'));
    const asi = $('add-subtask-input'); if(asi) asi.addEventListener('keypress', e => { if(e.key==='Enter') addSubtask('add'); });
    const esi = $('edit-subtask-input'); if(esi) esi.addEventListener('keypress', e => { if(e.key==='Enter') addSubtask('edit'); });
    ['add', 'edit'].forEach(mode => {
      const sl = $(`${mode}-subtask-list`);
      if(sl) sl.addEventListener('click', e => {
        const idx = e.target.dataset.idx;
        if (idx === undefined) return;
        if (e.target.classList.contains('subtask-check')) { currentSubtasks[idx].done = !currentSubtasks[idx].done; renderSubtaskInputArea(mode); }
        if (e.target.classList.contains('subtask-remove')) { currentSubtasks.splice(idx, 1); renderSubtaskInputArea(mode); }
      });
    });

    // Category Filter
    qsa('.cat-chip').forEach(btn => btn.addEventListener('click', () => {
      qsa('.cat-chip').forEach(b => b.classList.remove('active')); btn.classList.add('active');
      activeCategory = btn.dataset.cat; renderTasks();
    }));

    // Search & Cal
    const bsr = $('btn-search'); if(bsr) bsr.addEventListener('click', () => { $('search-bar').classList.toggle('open'); if($('search-bar').classList.contains('open')) $('search-input').focus(); });
    const bsc = $('search-close'); if(bsc) bsc.addEventListener('click', () => { $('search-bar').classList.remove('open'); $('search-input').value = ''; renderTasks(); });
    const ssi = $('search-input'); if(ssi) ssi.addEventListener('input', e => renderTasks(e.target.value));
    const cl = $('cal-left'); if(cl) cl.addEventListener('click', () => { calendarOffset -= 7; renderCalendar(); });
    const cr = $('cal-right'); if(cr) cr.addEventListener('click', () => { calendarOffset += 7; renderCalendar(); });

    // Settings
    const sdd = $('setting-dark'); if(sdd) sdd.addEventListener('change', e => { settings.dark = e.target.checked; saveSettings(); applyTheme(); });
    const snn = $('setting-notif'); if(snn) snn.addEventListener('change', e => { settings.notif = e.target.checked; saveSettings(); if(e.target.checked) requestNotifPermission(); });
    const bex = $('btn-export'); if(bex) bex.addEventListener('click', exportData);
    const bimp = $('btn-import'); if(bimp) bimp.addEventListener('click', () => $('import-file').click());
    const imf = $('import-file'); if(imf) imf.addEventListener('change', importData);
    const bca = $('btn-clear-all'); if(bca) bca.addEventListener('click', () => {
      if (confirm('Hapus semua data?')) { tasks = []; saveTasks(); localStorage.removeItem(STREAK_KEY); localStorage.removeItem(HISTORY_KEY); localStorage.removeItem('daylist_achievements'); renderTasks(); toast('🗑️ Semua data dihapus'); }
    });

    // Pomodoro
    const pc = $('pomo-close'); if(pc) pc.addEventListener('click', closePomo);
    const psta = $('pomo-start'); if(psta) psta.addEventListener('click', togglePomo);
    const prs = $('pomo-reset'); if(prs) prs.addEventListener('click', resetPomo);

    requestNotifPermission(); tasks.forEach(t => { if (!t.done) scheduleNotification(t); });
    updateHistory();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

})();
