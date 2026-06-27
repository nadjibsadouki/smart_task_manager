(() => {
  'use strict';

  // ==========================
  // Constantes
  // ==========================
  const STORAGE_KEY = 'smartTasks';
  const LEGACY_KEYS = ['tasks', 'taskList', 'stm_tasks_v1'];
  const AUTH_STATE_KEY = 'isLoggedIn';

  // ==========================
  // Utilitaires (robustes)
  // ==========================

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  const safeJSONParse = (raw) => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const normalizeHrefToFile = (href) => {
    if (!href) return '';
    try {
      const url = new URL(href, window.location.origin);
      return url.pathname.split('/').filter(Boolean).pop() || '';
    } catch {
      return href;
    }
  };

  const getCurrentPage = () => {
    const path = window.location.pathname || '';
    return path.split('/').filter(Boolean).pop() || '';
  };

  const getTodayISODateLocal = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Conversion iso (YYYY-MM-DD) -> Date “date-only” sans heure, basée sur UTC midnight.
  const isoDateToUTCDate = (iso) => {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const ms = Date.UTC(y, mo - 1, d);
    const dt = new Date(ms);
    return Number.isFinite(dt.getTime()) ? dt : null;
  };

  const isDueDateBeforeToday = (dueDateISO) => {
    const todayISO = getTodayISODateLocal();
    const todayDt = isoDateToUTCDate(todayISO);
    const dueDt = isoDateToUTCDate(dueDateISO);
    if (!todayDt || !dueDt) return false;
    return dueDt.getTime() < todayDt.getTime();
  };

  const formatDueDateFR = (iso) => {
    const dt = isoDateToUTCDate(iso);
    if (!dt) return String(iso || '');
    try {
      return new Intl.DateTimeFormat('fr-FR').format(dt);
    } catch {
      return String(iso || '');
    }
  };

  const getUID = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

  // ==========================
  // Modèle de tâche
  // ==========================
  const normalizeTask = (t) => {
    if (!t || typeof t !== 'object') return null;

    const idRaw = t.id ?? t._id ?? '';
    const titleRaw = t.title ?? t.name ?? t.taskTitle ?? '';
    const priorityRaw = t.priority;
    const categoryRaw = t.category;

    const statusRaw = t.status ?? t.state ?? '';
    const status =
      statusRaw === 'done' || statusRaw === 'terminée' || statusRaw === 'complete'
        ? 'done'
        : 'todo';

    const dueDateISO = t.dueDateISO ?? t.dueDate ?? t.date ?? t.due_date;
    const createdAtISO = t.createdAtISO ?? t.createdAt ?? t.created_at ?? '';

    const id = String(idRaw || '').trim();
    const title = String(titleRaw || '').trim();
    const priority = priorityRaw;

    if (!id || !title) return null;
    if (!['low', 'medium', 'high'].includes(priority)) return null;

    const dueStr = String(dueDateISO || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueStr)) return null;

    const category = String(categoryRaw || '').trim();

    return {
      id,
      title,
      priority,
      category: category || 'Non classée',
      dueDateISO: dueStr,
      status,
      createdAtISO: createdAtISO ? String(createdAtISO) : new Date().toISOString()
    };
  };

  const loadTasks = () => {
    const tryGet = (key) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return safeJSONParse(raw);
      } catch {
        return null;
      }
    };

    const parsedModern = tryGet(STORAGE_KEY);
    if (parsedModern) {
      const arr = Array.isArray(parsedModern)
        ? parsedModern
        : Array.isArray(parsedModern.tasks)
          ? parsedModern.tasks
          : Array.isArray(parsedModern.taskList)
            ? parsedModern.taskList
            : null;

      if (Array.isArray(arr)) {
        return arr.map(normalizeTask).filter(Boolean);
      }
    }

    for (const key of LEGACY_KEYS) {
      const parsed = tryGet(key);
      if (!parsed) continue;

      const arr = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.tasks)
          ? parsed.tasks
          : Array.isArray(parsed.taskList)
            ? parsed.taskList
            : null;

      if (!Array.isArray(arr)) continue;

      const normalized = arr.map(normalizeTask).filter(Boolean);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      } catch {
        // ignore
      }
      return normalized;
    }

    return [];
  };

  const saveTasks = (tasks) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  };

  // ==========================
  // Navigation (header)
  // ==========================
  function initNavigation() {
    const navList = document.querySelector('.home-nav__list');
    if (!navList) return;

    const currentFile = getCurrentPage() || 'index.html';
    const links = Array.from(navList.querySelectorAll('a[href]'));
    if (!links.length) return;

    links.forEach((a) => {
      if (a.hasAttribute('aria-current')) a.removeAttribute('aria-current');
    });

    let matched = false;
    for (const a of links) {
      const hrefFile = normalizeHrefToFile(a.getAttribute('href'));
      if (hrefFile && hrefFile === currentFile) {
        a.setAttribute('aria-current', 'page');
        matched = true;
      }
    }

    if (!matched && currentFile === 'index.html') {
      for (const a of links) {
        const hrefFile = normalizeHrefToFile(a.getAttribute('href'));
        if (!hrefFile || hrefFile === 'index.html') {
          a.setAttribute('aria-current', 'page');
        }
      }
    }
  }

  // ==========================
  // Auth (simulation)
  // ==========================
  function initAuth() {
    const headerBtn = document.querySelector('#authHeaderBtn');
    if (headerBtn) {
      const isLoggedIn = (() => {
        try {
          return localStorage.getItem(AUTH_STATE_KEY) === 'true';
        } catch {
          return false;
        }
      })();

      const syncHeader = () => {
        if (isLoggedIn) {
          headerBtn.textContent = 'Déconnexion';
          headerBtn.setAttribute('aria-label', 'Déconnexion');
          headerBtn.setAttribute('data-auth-action', 'logout');
          headerBtn.setAttribute('href', '#');
        } else {
          headerBtn.textContent = 'Connexion';
          headerBtn.setAttribute('aria-label', 'Connexion');
          headerBtn.removeAttribute('data-auth-action');
          headerBtn.setAttribute('href', 'auth.html');
        }
      };

      syncHeader();

      headerBtn.addEventListener('click', (e) => {
        const action = headerBtn.getAttribute('data-auth-action');
        if (action !== 'logout') return;
        e.preventDefault();

        try {
          localStorage.removeItem(AUTH_STATE_KEY);
        } catch {
          // ignore
        }
        headerBtn.textContent = 'Connexion';
        headerBtn.setAttribute('aria-label', 'Connexion');
        headerBtn.removeAttribute('data-auth-action');
        headerBtn.setAttribute('href', 'auth.html');
        window.location.href = 'index.html';
      });
    }

    const loginTab = document.querySelector('#authLoginTab');
    const registerTab = document.querySelector('#authRegisterTab');
    const loginPanel = document.querySelector('#authLoginPanel');
    const registerPanel = document.querySelector('#authRegisterPanel');

    const setTab = (mode) => {
      if (!loginTab || !registerTab || !loginPanel || !registerPanel) return;
      const showLogin = mode === 'login';
      loginTab.setAttribute('aria-selected', showLogin ? 'true' : 'false');
      registerTab.setAttribute('aria-selected', showLogin ? 'false' : 'true');
      if (showLogin) {
        loginPanel.removeAttribute('aria-hidden');
        registerPanel.setAttribute('aria-hidden', 'true');
      } else {
        registerPanel.removeAttribute('aria-hidden');
        loginPanel.setAttribute('aria-hidden', 'true');
      }
    };

    if (loginTab && registerTab) {
      setTab('login');
      registerTab.addEventListener('click', () => setTab('register'));
      loginTab.addEventListener('click', () => setTab('login'));
    }

    const modal = document.querySelector('#authTermsModal');
    const overlay = document.querySelector('[data-auth-modal-overlay]');
    const closeBtns = Array.from(document.querySelectorAll('[data-auth-modal-close]'));
    const openLink = document.querySelector('#authTermsLink');

    const openModal = () => {
      if (!modal) return;
      modal.setAttribute('aria-hidden', 'false');
      modal.classList.add('auth-modal--open');
      if (overlay) overlay.classList.add('auth-modal__overlay--open');
      const closeBtn = closeBtns[0];
      if (closeBtn && typeof closeBtn.focus === 'function') closeBtn.focus();
    };

    const closeModal = () => {
      if (!modal) return;
      modal.setAttribute('aria-hidden', 'true');
      modal.classList.remove('auth-modal--open');
      if (overlay) overlay.classList.remove('auth-modal__overlay--open');
    };

    if (openLink) openLink.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
    if (overlay) overlay.addEventListener('click', closeModal);
    closeBtns.forEach((b) => b.addEventListener('click', closeModal));

    const loginForm = document.querySelector('#authLoginForm');
    const registerForm = document.querySelector('#authRegisterForm');

    const markLoggedIn = () => {
      try {
        localStorage.setItem(AUTH_STATE_KEY, 'true');
      } catch {
        // ignore
      }
    };

    const bindSimSubmit = (form) => {
      if (!form) return;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        markLoggedIn();
        window.location.href = 'index.html';
      });
    };

    bindSimSubmit(loginForm);
    bindSimSubmit(registerForm);

    if (getCurrentPage() === 'auth.html') {
      const isLoggedIn = (() => {
        try {
          return localStorage.getItem(AUTH_STATE_KEY) === 'true';
        } catch {
          return false;
        }
      })();
      if (isLoggedIn) window.location.href = 'index.html';
    }
  }

  // ==========================
  // Tâches
  // ==========================
  function initTaches() {
    const taskForm = document.querySelector('#taskForm');
    const taskList = document.querySelector('#taskList');
    const taskInput = document.querySelector('#taskInput');
    const priorityInput = document.querySelector('#priorityInput');
    const dateInput = document.querySelector('#dateInput');
    const categoryInput = document.querySelector('#categoryInput');

    const taskCount = document.querySelector('#taskCount');
    const emptyState = document.querySelector('#emptyState');
    const taskErrorBox = document.querySelector('#taskErrorBox');

    if (!taskList || !taskInput || !priorityInput || !dateInput) return;

    const statTotal = document.querySelector('#statTotal');
    const statTodo = document.querySelector('#statTodo');
    const statDone = document.querySelector('#statDone');

    const addTaskBtn = document.querySelector('#addTaskBtn');

    const ensureDueDateErrorBox = () => {
      if (!dateInput) return null;
      const existing = document.querySelector('#dueDateErrorBox');
      if (existing) return existing;

      const field = dateInput.closest('.form-field') || dateInput.parentElement;
      const box = document.createElement('div');
      box.id = 'dueDateErrorBox';
      box.className = 'due-date-error-box task-error-box';
      box.role = 'alert';
      box.ariaLive = 'assertive';
      box.style.display = 'none';
      box.textContent = '';

      if (field && field.appendChild) field.appendChild(box);
      return box;
    };

    const dueDateErrorBox = ensureDueDateErrorBox();

    const setDueDateError = (msg) => {
      if (!dueDateErrorBox || !dateInput) return;
      if (!msg) {
        dueDateErrorBox.style.display = 'none';
        dueDateErrorBox.textContent = '';
        dateInput.removeAttribute('aria-invalid');
        return;
      }
      dueDateErrorBox.style.display = 'block';
      dueDateErrorBox.textContent = msg;
      dateInput.setAttribute('aria-invalid', 'true');
    };

    const validateDueDate = (opts = { silentIncomplete: true, forceComplete: false }) => {
      const dueDateISO = String(dateInput.value || '').trim();
      if (!dueDateISO) {
        if (!opts.silentIncomplete) setDueDateError('Veuillez choisir une date limite valide.');
        else setDueDateError('');
        return { ok: true };
      }
      const isComplete = /^\d{4}-\d{2}-\d{2}$/.test(dueDateISO);
      if (!isComplete) {
        if (!opts.forceComplete) {
          setDueDateError('');
          return { ok: true };
        }
        setDueDateError('Veuillez choisir une date limite valide.');
        return { ok: false };
      }
      if (isDueDateBeforeToday(dueDateISO)) {
        setDueDateError('La date limite ne peut pas être antérieure à la date d\'aujourd\'hui.');
        return { ok: false };
      }
      setDueDateError('');
      return { ok: true };
    };

    if (dateInput) dateInput.setAttribute('min', getTodayISODateLocal());

    let currentFilter = 'all';

    const setText = (el, text) => {
      if (el) el.textContent = String(text);
    };

    const setError = (msg) => {
      if (!taskErrorBox) return;
      if (!msg) {
        taskErrorBox.style.display = 'none';
        taskErrorBox.textContent = '';
        return;
      }
      taskErrorBox.style.display = 'block';
      taskErrorBox.textContent = msg;
    };

    const priorityLabel = (p) => (p === 'high' ? 'Haute' : p === 'medium' ? 'Moyenne' : 'Faible');

    const render = () => {
      const allTasks = loadTasks();
      const tasks = allTasks
        .filter((t) => (currentFilter === 'todo' ? t.status === 'todo' : currentFilter === 'done' ? t.status === 'done' : true))
        .slice()
        .sort((a, b) => {
          const byDue = String(a.dueDateISO || '').localeCompare(String(b.dueDateISO || ''));
          if (byDue !== 0) return byDue;
          const pr = { high: 0, medium: 1, low: 2 };
          return (pr[a.priority] ?? 9) - (pr[b.priority] ?? 9);
        });

      const total = allTasks.length;
      const done = allTasks.filter((t) => t.status === 'done').length;
      const todo = total - done;

      setText(statTotal, total);
      setText(statTodo, todo);
      setText(statDone, done);
      if (taskCount) setText(taskCount, tasks.length);
      if (emptyState) emptyState.style.display = tasks.length ? 'none' : 'block';

      taskList.innerHTML = '';
      if (!tasks.length) return;

      const frag = document.createDocumentFragment();
      for (const t of tasks) {
        const li = document.createElement('li');
        li.className = 'task-item';
        li.dataset.taskId = t.id;

        const left = document.createElement('div');
        left.className = 'task-item__left';

        const title = document.createElement('div');
        title.className = 'task-item__title';
        title.textContent = t.title;

        const meta = document.createElement('div');
        meta.className = 'task-item__meta';
        meta.textContent = `Priorité: ${priorityLabel(t.priority)} — Date limite: ${formatDueDateFR(t.dueDateISO)}`;

        const actions = document.createElement('div');
        actions.className = 'task-item__actions';

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'task-item__toggle';
        toggleBtn.textContent = t.status === 'done' ? 'Marquer à faire' : 'Marquer terminée';
        toggleBtn.setAttribute('aria-label', toggleBtn.textContent);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'task-item__delete';
        deleteBtn.textContent = 'Supprimer';
        deleteBtn.setAttribute('aria-label', 'Supprimer la tâche');

        toggleBtn.addEventListener('click', () => {
          const tasksAll = loadTasks();
          const next = tasksAll.map((x) => (x.id !== t.id ? x : { ...x, status: x.status === 'done' ? 'todo' : 'done' }));
          saveTasks(next);
          render();
        });

        deleteBtn.addEventListener('click', () => {
          const tasksAll = loadTasks();
          const next = tasksAll.filter((x) => x.id !== t.id);
          saveTasks(next);
          render();
        });

        left.appendChild(title);
        left.appendChild(meta);
        actions.appendChild(toggleBtn);
        actions.appendChild(deleteBtn);
        li.appendChild(left);
        li.appendChild(actions);

        frag.appendChild(li);
      }

      taskList.appendChild(frag);
    };

    const applyFilterFromButtons = () => {
      const btns = Array.from(document.querySelectorAll('.filter-btn[data-filter]'));
      btns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const f = btn.getAttribute('data-filter');
          if (!f) return;
          currentFilter = f;
          render();
          btns.forEach((b) => b.removeAttribute('aria-pressed'));
          btn.setAttribute('aria-pressed', 'true');
        });
      });

      const allBtn = btns.find((b) => b.getAttribute('data-filter') === 'all');
      if (allBtn) allBtn.setAttribute('aria-pressed', 'true');
    };

    if (taskForm) {
      taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        setError('');

        const title = String(taskInput.value || '').trim();
        const priority = priorityInput.value;
        const dueDateISO = dateInput.value;
        const category = categoryInput ? String(categoryInput.value || '').trim() : '';

        dateInput.value = String(dueDateISO || '');
        const dueValidationBeforeSave = validateDueDate({ silentIncomplete: false, forceComplete: true });
        if (!dueValidationBeforeSave.ok) return;

        if (!title) {
          setError('Veuillez saisir un titre de tâche.');
          return;
        }
        if (!['low', 'medium', 'high'].includes(priority)) {
          setError('Veuillez choisir une priorité valide.');
          return;
        }

        const tasksAll = loadTasks();
        tasksAll.push({
          id: getUID(),
          title,
          priority,
          category: category || 'Non classée',
          dueDateISO,
          status: 'todo',
          createdAtISO: new Date().toISOString()
        });

        saveTasks(tasksAll);
        taskInput.value = '';
        setError('');
        render();
      });
    }

    applyFilterFromButtons();
    render();
  }

  // ==========================
  // Analyses
  // ==========================
  function initAnalyses() {
    const cards = Array.from(document.querySelectorAll('.analyses-kpi__card'));
    const valuesEls = cards.map((c) => c.querySelector('.analyses-kpi__value')).filter(Boolean);
    const kpiGrid = document.querySelector('.analyses-kpi__grid');

    const tbody = document.querySelector('.analyses-history__table tbody');
    const recText = document.querySelector('.analyses-recommendations__text');

    const canvasPriorite = document.getElementById('chartPriorite');
    const canvasStatut = document.getElementById('chartStatut');
    const canvasTermineesParJour = document.getElementById('chartTermineesParJour');

    if (!kpiGrid && !tbody && !canvasPriorite && !canvasStatut && !canvasTermineesParJour) return;

    let tasks = [];
    try {
      tasks = loadTasks();
    } catch {
      tasks = [];
    }

    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    const inProgress = total - done;
    const successRate = total ? (done / total) * 100 : 0;
    const highPriority = tasks.filter((t) => t.priority === 'high').length;

    let weeklyProd = 0;
    const todayISO = getTodayISODateLocal();
    const today = isoDateToUTCDate(todayISO);
    if (today) {
      const from = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
      weeklyProd = tasks.filter((t) => {
        if (t.status !== 'done') return false;
        const dt = isoDateToUTCDate(t.dueDateISO);
        if (!dt) return false;
        const ms = dt.getTime();
        return ms >= from.getTime() && ms <= today.getTime();
      }).length;
    }

    const formatPercent = (v) => `${Math.round(clamp(v, 0, 100))}%`;
    const setKPI = (idx, text) => {
      const el = valuesEls[idx];
      if (el) el.textContent = String(text);
    };

    if (total === 0) {
      setKPI(0, '0');
      setKPI(1, '0');
      setKPI(2, '0');
      setKPI(3, '0%');
      setKPI(4, '0');
      setKPI(5, '0');
      if (tbody) tbody.innerHTML = '';
      if (recText) recText.textContent = 'Ajoutez des tâches dans l’onglet Tâches pour voir vos analyses.';
      if (!window.Chart) return;
    }

    if (total > 0) {
      setKPI(0, total);
      setKPI(1, done);
      setKPI(2, inProgress);
      setKPI(3, formatPercent(successRate));
      setKPI(4, highPriority);
      setKPI(5, weeklyProd);

      if (tbody) {
        const priorityRank = { high: 0, medium: 1, low: 2 };
        const rows = tasks
          .slice()
          .sort((a, b) => {
            const byDue = String(b.dueDateISO || '').localeCompare(String(a.dueDateISO || ''));
            if (byDue !== 0) return byDue;
            return (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
          })
          .slice(0, 8)
          .map((t) => {
            const action = t.status === 'done' ? 'Marquer comme terminé' : 'Création / planification';
            const category = t.category ? String(t.category) : 'Non classée';
            const result = t.status === 'done' ? 'Succès' : 'En cours';
            return `<tr><td>${String(t.dueDateISO)}</td><td>${action}</td><td>${category}</td><td>${result}</td></tr>`;
          })
          .join('');

        tbody.innerHTML = rows;
      }

      if (recText) {
        if (total === 0) {
          recText.textContent = 'Aucune tâche n’est encore enregistrée. Commencez par ajouter vos premières tâches dans la page Tâches.';
        } else if (inProgress === 0) {
          recText.textContent = 'Bravo, toutes vos tâches sont terminées. Vous pouvez maintenant préparer vos prochaines priorités ou prendre un temps de récupération.';
        } else {
          const hasHigh = tasks.some((t) => t.status !== 'done' && t.priority === 'high');
          const hasMedium = tasks.some((t) => t.status !== 'done' && t.priority === 'medium');
          if (hasHigh) recText.textContent = 'Commencez par les tâches à priorité haute afin de sécuriser les échéances importantes.';
          else if (hasMedium) recText.textContent = 'Planifiez vos tâches de priorité moyenne dans un créneau clair pour maintenir une progression régulière.';
          else recText.textContent = 'Vos tâches restantes sont de priorité faible. Traitez-les après vos actions principales ou regroupez-les dans une session courte.';
        }
      }
    }

    if (!window.Chart) return;

    const ChartCtor = window.Chart;
    const ensureDestroy = (canvas) => {
      if (!canvas) return;
      const inst = canvas.__chartInstance;
      if (inst && typeof inst.destroy === 'function') {
        try {
          inst.destroy();
        } catch {
          // ignore
        }
      }
      canvas.__chartInstance = null;
    };

    const palette = {
      done: 'rgba(75, 192, 192, 0.95)',
      todo: 'rgba(255, 99, 132, 0.90)',
      high: 'rgba(255, 159, 64, 0.95)',
      medium: 'rgba(54, 162, 235, 0.95)',
      low: 'rgba(153, 102, 255, 0.95)'
    };

    const countsPriorite = { high: 0, medium: 0, low: 0 };
    for (const t of tasks) {
      if (t.priority === 'high') countsPriorite.high += 1;
      else if (t.priority === 'medium') countsPriorite.medium += 1;
      else if (t.priority === 'low') countsPriorite.low += 1;
    }

    if (canvasStatut) {
      ensureDestroy(canvasStatut);
      canvasStatut.__chartInstance = new ChartCtor(canvasStatut, {
        type: 'doughnut',
        data: {
          labels: ['Terminées', 'À faire'],
          datasets: [{
            data: [done, inProgress],
            backgroundColor: [palette.done, palette.todo],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: 'rgba(234,240,255,.95)' } }
          }
        }
      });
    }

    if (canvasPriorite) {
      ensureDestroy(canvasPriorite);
      canvasPriorite.__chartInstance = new ChartCtor(canvasPriorite, {
        type: 'bar',
        data: {
          labels: ['Haute', 'Moyenne', 'Faible'],
          datasets: [{
            label: 'Nombre de tâches',
            data: [countsPriorite.high, countsPriorite.medium, countsPriorite.low],
            backgroundColor: [palette.high, palette.medium, palette.low],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } }
        }
      });
    }

    if (canvasTermineesParJour) {
      ensureDestroy(canvasTermineesParJour);
      const dueDateCounts = new Map();
      for (const t of tasks) {
        if (t.status !== 'done') continue;
        const iso = t.dueDateISO;
        if (!iso) continue;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) continue;
        dueDateCounts.set(iso, (dueDateCounts.get(iso) || 0) + 1);
      }

      const labels = [];
      const values = [];
      const todayDt = isoDateToUTCDate(getTodayISODateLocal());
      if (todayDt) {
        const fmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' });
        for (let i = 13; i >= 0; i--) {
          const d = new Date(todayDt.getTime() - i * 24 * 60 * 60 * 1000);
          const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
          labels.push(fmt.format(d));
          values.push(dueDateCounts.get(iso) || 0);
        }
      }

      canvasTermineesParJour.__chartInstance = new ChartCtor(canvasTermineesParJour, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Tâches terminées',
            data: values
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
    }
  }

  // ==========================
  // IA (backend Flask + Ollama)
  // ==========================
  function initIA() {
    const aiInput = document.querySelector('#aiInput');
    const aiAnalyzeBtn = document.querySelector('#aiAnalyzeBtn');

    const aiPriorityResult = document.querySelector('#aiPriorityResult');
    const aiUrgencyResult = document.querySelector('#aiUrgencyResult');
    const aiAdviceResult = document.querySelector('#aiAdviceResult');
    const aiScoreResult = document.querySelector('#aiScoreResult');
    const aiNoteResult = document.querySelector('#aiNoteResult');

    const aiDailyObjective = document.querySelector('#aiDailyObjective');
    const aiDailyTopPriority = document.querySelector('#aiDailyTopPriority');
    const aiDailyNextAction = document.querySelector('#aiDailyNextAction');
    const aiDailyRisk = document.querySelector('#aiDailyRisk');

    if (!aiInput || !aiAnalyzeBtn) return;

    const setTextSafe = (el, text) => {
      if (el) el.textContent = String(text);
    };

    const setLoading = () => {
      setTextSafe(aiPriorityResult, 'Analyse...');
      setTextSafe(aiUrgencyResult, 'Analyse...');
      setTextSafe(aiAdviceResult, 'Analyse en cours avec Ollama...');
      setTextSafe(aiScoreResult, 'Analyse...');
      setTextSafe(aiNoteResult, 'Analyse en cours avec Ollama...');

      if (aiDailyObjective) setTextSafe(aiDailyObjective, 'Analyse en cours avec Ollama...');
      if (aiDailyTopPriority) setTextSafe(aiDailyTopPriority, '—');
      if (aiDailyNextAction) setTextSafe(aiDailyNextAction, '—');
      if (aiDailyRisk) setTextSafe(aiDailyRisk, '—');
    };

    const setErrorIA = () => {
      setTextSafe(aiPriorityResult, 'Le backend IA ou Ollama n’est pas lancé.');
      setTextSafe(aiUrgencyResult, '—');
      setTextSafe(aiAdviceResult, 'Le backend IA ou Ollama n’est pas lancé.');
      setTextSafe(aiScoreResult, '—');
      setTextSafe(aiNoteResult, 'Le backend IA ou Ollama n’est pas lancé.');

      if (aiDailyObjective) setTextSafe(aiDailyObjective, 'Le backend IA ou Ollama n’est pas lancé.');
      if (aiDailyTopPriority) setTextSafe(aiDailyTopPriority, '—');
      if (aiDailyNextAction) setTextSafe(aiDailyNextAction, '—');
      if (aiDailyRisk) setTextSafe(aiDailyRisk, '—');
    };

    // Valeurs initiales
    setTextSafe(aiPriorityResult, '—');
    setTextSafe(aiUrgencyResult, '—');
    setTextSafe(aiAdviceResult, '—');
    setTextSafe(aiScoreResult, '—');
    setTextSafe(aiNoteResult, '—');

    if (aiDailyObjective) setTextSafe(aiDailyObjective, '—');
    if (aiDailyTopPriority) setTextSafe(aiDailyTopPriority, '—');
    if (aiDailyNextAction) setTextSafe(aiDailyNextAction, '—');
    if (aiDailyRisk) setTextSafe(aiDailyRisk, '—');

    const apiUrl = 'http://127.0.0.1:5000/api/ai/analyze';

    aiAnalyzeBtn.addEventListener('click', async () => {
      const inputText = String(aiInput.value || '');

      if (!inputText.trim()) {
        setTextSafe(aiPriorityResult, 'Veuillez écrire une tâche à analyser.');
        setTextSafe(aiUrgencyResult, '—');
        setTextSafe(aiAdviceResult, '—');
        setTextSafe(aiScoreResult, '—');
        setTextSafe(aiNoteResult, '—');
        if (aiDailyObjective) setTextSafe(aiDailyObjective, '—');
        if (aiDailyTopPriority) setTextSafe(aiDailyTopPriority, '—');
        if (aiDailyNextAction) setTextSafe(aiDailyNextAction, '—');
        if (aiDailyRisk) setTextSafe(aiDailyRisk, '—');
        return;
      }

      setLoading();

      try {
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: inputText })
        });

        if (!resp.ok) {
          setErrorIA();
          return;
        }

        const data = await resp.json();

        const priority = data && data.priority ? String(data.priority) : '—';
        const urgency = data && data.urgency ? String(data.urgency) : '—';
        const advice = data && data.advice ? String(data.advice) : '—';
        const next_action = data && data.next_action ? String(data.next_action) : '—';
        const risk = data && data.risk ? String(data.risk) : '—';
        const daily_summary = data && data.daily_summary ? String(data.daily_summary) : '—';
        const ai_score = data && data.ai_score ? String(data.ai_score) : '—';
        const ai_note = data && data.ai_note ? String(data.ai_note) : '—';

        setTextSafe(aiPriorityResult, priority);
        setTextSafe(aiUrgencyResult, urgency);
        setTextSafe(aiAdviceResult, advice);
        setTextSafe(aiScoreResult, ai_score);
        setTextSafe(aiNoteResult, ai_note);

        if (aiDailyObjective) setTextSafe(aiDailyObjective, daily_summary);
        if (aiDailyTopPriority) setTextSafe(aiDailyTopPriority, priority);
        if (aiDailyNextAction) setTextSafe(aiDailyNextAction, next_action);
        if (aiDailyRisk) setTextSafe(aiDailyRisk, risk);
      } catch {
        setErrorIA();
      }
    });
  }

  // ==========================
  // Focus (mode concentration)
  // ==========================
  function initFocus() {
    const focusMain = document.querySelector('.focus-main');
    if (!focusMain) return;

    // IDs demandés
    const taskListEl = document.querySelector('#focusTaskList');
    const currentTaskEl = document.querySelector('#focusCurrentTask');
    const timerEl = document.getElementById("focusTimer");
    if (!timerEl) console.error("focusTimer introuvable");
    const startBtn = document.querySelector('#focusStartBtn');
    const pauseBtn = document.querySelector('#focusPauseBtn');
    const resetBtn = document.querySelector('#focusResetBtn');
    const finishBtn = document.querySelector('#focusFinishBtn');
    const todayTimeEl = document.querySelector('#focusTodayTime');
    const sessionsCountEl = document.querySelector('#focusSessionsCount');
    const completedCountEl = document.querySelector('#focusCompletedCount');
    const messageEl = document.querySelector('#focusMessage');

    // Infos optionnelles (ajoutées pour l’UI sans toucher au CSS)
    const currentPriorityEl = document.querySelector('#focusCurrentPriority');
    const currentDueEl = document.querySelector('#focusCurrentDue');

    const STORAGE_STATS_KEY = 'focusStats';

    const focusDurationInput = document.querySelector('#focusDurationInput');
    const durationInfoEl = document.querySelector('span[aria-label="Durée de session"]');
    const DEFAULT_DURATION_MIN = 25;

    const clampDurationMinutes = (min) => {
      const n = Number(min);
      if (!Number.isFinite(n)) return DEFAULT_DURATION_MIN;
      return clamp(n, 1, 180);
    };

    const getSessionDurationSeconds = () => {
      const minutes = focusDurationInput ? clampDurationMinutes(focusDurationInput.value) : DEFAULT_DURATION_MIN;
      return Math.round(minutes * 60);
    };

    const renderDurationLabel = () => {
      if (!durationInfoEl) return;
      const minutes = focusDurationInput ? clampDurationMinutes(focusDurationInput.value) : DEFAULT_DURATION_MIN;
      durationInfoEl.textContent = `${minutes} min`;
    };

    renderDurationLabel();

    const formatMMSS = (totalSeconds) => {
      const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      return `${mm}:${ss}`;
    };
    const formatTime = formatMMSS;

    const safeSetText = (el, text) => {
      if (!el) return;
      el.textContent = String(text ?? '');
    };

    const safeSetHTML = (el, html) => {
      if (!el) return;
      el.innerHTML = String(html ?? '');
    };

    const safeParseStats = () => {
      try {
        const raw = localStorage.getItem(STORAGE_STATS_KEY);
        if (!raw) return { version: 1, sessions: 0, completedTasks: 0, timeByDate: {} };
        const parsed = safeJSONParse(raw);
        if (!parsed || typeof parsed !== 'object') return { version: 1, sessions: 0, completedTasks: 0, timeByDate: {} };
        const timeByDate = parsed.timeByDate && typeof parsed.timeByDate === 'object' ? parsed.timeByDate : {};
        return {
          version: 1,
          sessions: Number(parsed.sessions) || 0,
          completedTasks: Number(parsed.completedTasks) || 0,
          timeByDate
        };
      } catch {
        return { version: 1, sessions: 0, completedTasks: 0, timeByDate: {} };
      }
    };

    const saveStats = (stats) => {
      try {
        localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(stats));
      } catch {
        // ignore
      }
    };

    const getNonDoneTasks = () => {
      const all = loadTasks();
      return all.filter((t) => t && t.status !== 'done');
    };

    const renderStats = (stats) => {
      if (!stats) stats = safeParseStats();
      if (todayTimeEl) {
        const todayISO = getTodayISODateLocal();
        const seconds = Number(stats.timeByDate?.[todayISO] || 0);
        todayTimeEl.textContent = formatMMSS(seconds);
      }
      if (sessionsCountEl) safeSetText(sessionsCountEl, stats.sessions ?? 0);
      if (completedCountEl) safeSetText(completedCountEl, stats.completedTasks ?? 0);
    };

    // Session state
    let sessionDurationSeconds = getSessionDurationSeconds();
    let remainingSeconds = sessionDurationSeconds;
    let intervalId = null;
    let isRunning = false;
    let selectedTaskId = null;
    let sessionEnded = false;

    const renderTimer = () => {
      if (!timerEl) return;
      timerEl.textContent = formatTime(remainingSeconds);
    };

    const syncDurationFromInput = () => {
      const minutes = focusDurationInput ? clampDurationMinutes(focusDurationInput.value) : DEFAULT_DURATION_MIN;
      if (focusDurationInput) focusDurationInput.value = String(minutes);
      renderDurationLabel();
      if (!isRunning) {
        sessionDurationSeconds = minutes * 60;
        remainingSeconds = sessionDurationSeconds;
        renderTimer();
      }
    };

    const renderTaskCardEmpty = () => {
      if (currentTaskEl) currentTaskEl.textContent = 'Aucune tâche sélectionnée';
      if (currentPriorityEl) currentPriorityEl.textContent = '—';
      if (currentDueEl) currentDueEl.textContent = '—';
    };

    const renderSelectedTask = (task) => {
      if (!task) {
        renderTaskCardEmpty();
        return;
      }

      if (currentTaskEl) currentTaskEl.textContent = `« ${task.title} »`;
      if (currentPriorityEl) {
        const label = task.priority === 'high' ? 'Haute' : task.priority === 'medium' ? 'Moyenne' : 'Faible';
        currentPriorityEl.textContent = label;
      }
      if (currentDueEl) safeSetText(currentDueEl, formatDueDateFR(task.dueDateISO));
    };

    const renderTaskList = () => {
      if (!taskListEl) return;

      const tasks = getNonDoneTasks();
      safeSetHTML(taskListEl, '');

      if (!tasks.length) {
        safeSetText(taskListEl, '');
        if (messageEl) {
          messageEl.textContent = 'Aucune tâche disponible. Ajoutez d’abord une tâche dans la page Tâches.';
        }
        renderTaskCardEmpty();
        selectedTaskId = null;
        return;
      }

      if (messageEl) messageEl.textContent = '';

      const pr = { high: 0, medium: 1, low: 2 };
      const sorted = tasks
        .slice()
        .sort((a, b) => {
          const byPr = (pr[a.priority] ?? 9) - (pr[b.priority] ?? 9);
          if (byPr !== 0) return byPr;
          return String(a.dueDateISO || '').localeCompare(String(b.dueDateISO || ''));
        });

      const frag = document.createDocumentFragment();
      for (const t of sorted) {
        const li = document.createElement('li');
        li.className = 'focus-task-item';
        li.dataset.taskId = t.id;

        const titleText = document.createElement('span');
        titleText.className = 'focus-task-item__title';
        titleText.textContent = t.title;

        li.appendChild(titleText);

        li.setAttribute('role', 'button');
        li.tabIndex = 0;
        li.setAttribute('aria-label', `Sélectionner la tâche : ${t.title}`);

        const onSelect = () => {
          selectedTaskId = t.id;

          // Met à jour l'état visuel
          const items = Array.from(taskListEl.querySelectorAll('li.focus-task-item'));
          items.forEach((x) => x.classList.remove('is-selected'));
          li.classList.add('is-selected');

          const current = getNonDoneTasks().find((x) => x.id === selectedTaskId);
          renderSelectedTask(current || t);
        };

        li.addEventListener('click', onSelect);
        li.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        });

        frag.appendChild(li);
      }
      taskListEl.appendChild(frag);

      if (selectedTaskId && sorted.some((x) => x.id === selectedTaskId)) {
        const selectedTask = sorted.find((x) => x.id === selectedTaskId);

        // Active l'item sélectionné (visuel)
        const items = Array.from(taskListEl.querySelectorAll('li.focus-task-item'));
        items.forEach((x) => x.classList.remove('is-selected'));
        const selectedItem = items.find((x) => x.dataset.taskId === selectedTaskId);
        if (selectedItem) selectedItem.classList.add('is-selected');

        renderSelectedTask(selectedTask);
      } else {
        selectedTaskId = null;
        renderTaskCardEmpty();
      }
    };

    const stopInterval = () => {
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
      isRunning = false;
    };

    const updateStatsAfterSession = ({ sessionSecondsSpent, completedTask }) => {
      const stats = safeParseStats();
      const todayISO = getTodayISODateLocal();

      stats.sessions = Number(stats.sessions) + 1;

      const seconds = Math.max(0, Number(sessionSecondsSpent) || 0);
      if (!stats.timeByDate || typeof stats.timeByDate !== 'object') stats.timeByDate = {};
      stats.timeByDate[todayISO] = Number(stats.timeByDate[todayISO] || 0) + seconds;

      if (completedTask) {
        stats.completedTasks = Number(stats.completedTasks) + 1;
      }

      saveStats(stats);
      renderStats(stats);
    };

    const endSession = (opts = { userInitiated: false }) => {
      if (sessionEnded) return;
      sessionEnded = true;
      stopInterval();

      // Message demandé
      if (messageEl) messageEl.textContent = 'Session terminée. Bon travail.';

      const tasksNow = getNonDoneTasks().concat(loadTasks().filter((t) => t.status === 'done'));
      const selectedTask = tasksNow.find((t) => t.id === selectedTaskId) || null;

      const confirmMsg = selectedTask
        ? `Votre tâche « ${selectedTask.title} » est-elle terminée ?\n\nCliquez sur OK pour la marquer comme terminée, ou Annuler pour la laisser à faire.`
        : 'Aucune tâche sélectionnée.\n\nVoulez-vous quand même terminer la session ?';

      // Si aucune tâche sélectionnée, on ne force pas le marquage (mais stats session compte quand même)
      const wantsMarkDone = window.confirm(confirmMsg);

      // Temps de focus réellement passé (temps initial - restant)
      const secondsSpent = sessionDurationSeconds - remainingSeconds;

      // Marquage terminé si confirmé et tâche sélectionnée
      let completed = false;
      if (wantsMarkDone && selectedTaskId) {
        try {
          const allTasks = loadTasks();
          const next = allTasks.map((t) => (t.id === selectedTaskId ? { ...t, status: 'done' } : t));
          saveTasks(next);
          completed = true;
        } catch {
          completed = false;
        }
      }

      updateStatsAfterSession({ sessionSecondsSpent: secondsSpent, completedTask: completed });

      // Rafraîchir tâche & minuter
      renderTaskList();
      sessionDurationSeconds = getSessionDurationSeconds();
      remainingSeconds = sessionDurationSeconds;
      renderTimer();
      sessionEnded = false; // autorise de nouvelles sessions
    };

    // Timer controls
    const startTimer = () => {
      if (sessionEnded) sessionEnded = false;
      if (isRunning) return;
      if (remainingSeconds <= 0) {
        sessionDurationSeconds = getSessionDurationSeconds();
        remainingSeconds = sessionDurationSeconds;
      }

      // Empêcher démarrage sans tâche disponible
      const nonDone = getNonDoneTasks();
      if (!nonDone.length) {
        if (messageEl) messageEl.textContent = 'Aucune tâche disponible. Ajoutez d’abord une tâche dans la page Tâches.';
        return;
      }
      const selectedTask = selectedTaskId ? nonDone.find((x) => x.id === selectedTaskId) : null;
      if (!selectedTask) {
        if (messageEl) messageEl.textContent = 'Veuillez sélectionner une tâche avant de commencer.';
        return;
      }

      if (messageEl) messageEl.textContent = '';
      isRunning = true;
      intervalId = window.setInterval(() => {
        if (remainingSeconds <= 0) {
          stopInterval();
          endSession({ userInitiated: false });
          return;
        }
        remainingSeconds -= 1;
        if (remainingSeconds < 0) remainingSeconds = 0;
        renderTimer();

        if (remainingSeconds === 0) {
          stopInterval();
          endSession({ userInitiated: false });
        }
      }, 1000);
    };

    const pauseTimer = () => {
      stopInterval();
    };

    const resetTimer = () => {
      stopInterval();
      sessionDurationSeconds = getSessionDurationSeconds();
      remainingSeconds = sessionDurationSeconds;
      renderTimer();
      sessionEnded = false;
      if (messageEl) messageEl.textContent = '';
    };

    const finishBtnHandler = () => {
      // Termine immédiatement, même si paused
      endSession({ userInitiated: true });
    };

    // Bind UI
    renderTaskList();
    renderTimer();
    renderStats(safeParseStats());

    if (startBtn) startBtn.addEventListener('click', startTimer);
    if (pauseBtn) pauseBtn.addEventListener('click', pauseTimer);
    if (resetBtn) resetBtn.addEventListener('click', resetTimer);
    if (finishBtn) finishBtn.addEventListener('click', finishBtnHandler);
    if (focusDurationInput) {
      focusDurationInput.addEventListener('input', syncDurationFromInput);
      focusDurationInput.addEventListener('change', syncDurationFromInput);
    }

    // Défense anti double-tap : empêcher plusieurs listeners de créer plusieurs timers
    // (la garde isRunning + intervalId évite la création de plusieurs intervals)
  }


  // ==========================
  // Protection (simple)
  // ==========================
  const isUserLoggedIn = () => {
    try {
      return localStorage.getItem(AUTH_STATE_KEY) === 'true';
    } catch {
      return false;
    }
  };

  const enforceAuthProtection = () => {
    const currentFile = getCurrentPage();

    const allowedPublicPages = new Set(['index.html', 'auth.html']);
    const protectedPages = new Set(['tache.html', 'analyses.html', 'IA.html', 'focus.html', 'ai.html']);

    if (allowedPublicPages.has(currentFile)) return;
    if (!protectedPages.has(currentFile)) return;

    if (!isUserLoggedIn()) window.location.href = 'auth.html';
  };

  // ==========================
  // Bootstrap
  // ==========================
  const bootstrap = () => {
    enforceAuthProtection();
    initNavigation();
    initAuth();
    initTaches();
    initAnalyses();
    initIA();
    initFocus();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
