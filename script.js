(() => {
  'use strict';

  /**
   * Smart Task Manager — script.js
   * 
   * Contraintes respectées :
   * - Vanilla JavaScript
   * - Aucun changement HTML/CSS
   * - Ne casse pas les pages index.html, tache.html, analyses.html, ai.html/IA.html, focus.html
   * - Vérifie l’existence des éléments avant toute action
   * - Tout le code et les commentaires en français
   * - Stockage unique : localStorage.smartTasks
   * - Migration depuis clés legacy si nécessaire
   */

  // ==========================
  // Constantes stockage
  // ==========================
  const STORAGE_KEY = 'smartTasks';
  const LEGACY_KEYS = ['tasks', 'taskList', 'stm_tasks_v1'];

  // ==========================
  // Utilitaires
  // ==========================

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  const safeJSONParse = (raw) => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const getTodayISODateLocal = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

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

  const getCurrentPage = () => {
    const path = window.location.pathname || '';
    return path.split('/').filter(Boolean).pop() || '';
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

  const getUID = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

  // ==========================
  // Normalisation + stockage
  // ==========================

  /**
   * Tâche interne unifiée :
   * {
   *   id: string,
   *   title: string,
   *   priority: 'low'|'medium'|'high',
   *   dueDateISO: 'YYYY-MM-DD',
   *   status: 'todo'|'done',
   *   createdAtISO: string
   * }
   */
  const normalizeTask = (t) => {
    if (!t || typeof t !== 'object') return null;

    const id = t.id ?? t._id ?? '';
    const title = t.title ?? t.name ?? t.taskTitle ?? '';
    const priority = t.priority;

    const statusRaw = t.status ?? t.state ?? '';
    const status =
      statusRaw === 'done' || statusRaw === 'terminée' || statusRaw === 'complete'
        ? 'done'
        : 'todo';

    const dueDateISO = t.dueDateISO ?? t.dueDate ?? t.date ?? t.due_date;
    const createdAtISO = t.createdAtISO ?? t.createdAt ?? t.created_at ?? '';

    const idStr = String(id || '').trim();
    const titleStr = String(title || '').trim();

    if (!idStr || !titleStr) return null;
    if (!['low', 'medium', 'high'].includes(priority)) return null;

    if (!dueDateISO) return null;
    const dueStr = String(dueDateISO);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueStr)) return null;

    return {
      id: idStr,
      title: titleStr,
      priority,
      dueDateISO: dueStr,
      status,
      createdAtISO: createdAtISO ? String(createdAtISO) : new Date().toISOString()
    };
  };

  const loadTasks = () => {
    const tryGet = (key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return safeJSONParse(raw);
    };

    // 1) Clé moderne
    try {
      const raw = tryGet(STORAGE_KEY);
      if (raw) {
        const arr = Array.isArray(raw)
          ? raw
          : Array.isArray(raw.tasks)
            ? raw.tasks
            : Array.isArray(raw.taskList)
              ? raw.taskList
              : null;
        if (Array.isArray(arr)) {
          const normalized = arr.map(normalizeTask).filter(Boolean);
          return normalized;
        }
      }
    } catch {
      // Ignore si localStorage est inaccessible
    }

    // 2) Migration depuis legacy
    for (const key of LEGACY_KEYS) {
      try {
        const raw = tryGet(key);
        if (!raw) continue;
        const arr = Array.isArray(raw)
          ? raw
          : Array.isArray(raw.tasks)
            ? raw.tasks
            : Array.isArray(raw.taskList)
              ? raw.taskList
              : null;

        if (!Array.isArray(arr)) continue;

        const normalized = arr.map(normalizeTask).filter(Boolean);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        } catch {
          // Si écriture impossible, on continue et on retourne quand même
        }
        return normalized;
      } catch {
        // continuer
      }
    }

    // 3) Fallback : chercher un tableau JSON dans localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = safeJSONParse(raw);
        const maybeArray =
          Array.isArray(parsed) ? parsed : Array.isArray(parsed?.tasks) ? parsed.tasks : null;
        if (!Array.isArray(maybeArray)) continue;

        const normalized = maybeArray.map(normalizeTask).filter(Boolean);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        } catch {
          // ignore
        }
        return normalized;
      }
    } catch {
      // ignore
    }

    return [];
  };

  const saveTasks = (tasks) => {
    // Ici on suppose que les tâches sont déjà normalisées.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  };

  const priorityToFR = (p) => {
    if (p === 'high') return 'Haute';
    if (p === 'medium') return 'Moyenne';
    return 'Faible';
  };

  const statusFR = (s) => (s === 'done' ? 'Terminée' : 'À faire');

  const formatDueDateFR = (iso) => {
    const dt = isoDateToUTCDate(iso);
    if (!dt) return String(iso);
    try {
      return new Intl.DateTimeFormat('fr-FR').format(dt);
    } catch {
      return String(iso);
    }
  };

  // ==========================
  // Navigation (commun)
  // ==========================

  const initNavigation = () => {
    const navList = document.querySelector('.home-nav__list');
    if (!navList) return;

    const currentFile = getCurrentPage() || 'index.html';
    const links = Array.from(navList.querySelectorAll('a[href]'));
    if (!links.length) return;

    links.forEach((a) => {
      if (a.hasAttribute('aria-current')) a.removeAttribute('aria-current');
    });

    let matched = false;
    links.forEach((a) => {
      const hrefFile = normalizeHrefToFile(a.getAttribute('href'));
      if (hrefFile && hrefFile === currentFile) {
        a.setAttribute('aria-current', 'page');
        matched = true;
      }
    });

    // fallback : index.html
    if (!matched && currentFile === 'index.html') {
      links.forEach((a) => {
        const hrefFile = normalizeHrefToFile(a.getAttribute('href'));
        if (!hrefFile || hrefFile === 'index.html') a.setAttribute('aria-current', 'page');
      });
    }
  };

  // ==========================
  // Accueil
  // ==========================

  const initAccueil = () => {
    // On ne fait ici que la navigation (évite animations lourdes qui risquent de casser).
    // Cette page n’est pas dans ta liste de contraintes fonctionnelles.
    if (!document.querySelector('.home-main') || !document.querySelector('.home-nav__list')) return;
    initNavigation();
  };

  // ==========================
  // Tâches
  // ==========================

  const initTaches = () => {
    const form = document.querySelector('#taskForm');
    const taskList = document.querySelector('#taskList');
    const titleEl = document.querySelector('#taskInput');
    const priorityEl = document.querySelector('#priorityInput');
    const dueDateEl = document.querySelector('#dateInput');
    const addBtn = document.querySelector('#addTaskBtn');

    if (!form || !taskList || !titleEl || !priorityEl || !dueDateEl || !addBtn) return;

    const statTotal = document.querySelector('#statTotal');
    const statTodo = document.querySelector('#statTodo');
    const statDone = document.querySelector('#statDone');
    const taskCount = document.querySelector('#taskCount');
    const emptyStateEl = document.querySelector('#emptyState');
    const clearCompletedBtn = document.querySelector('#clearCompletedBtn');

    const filterBtns = Array.from(document.querySelectorAll('.filter-btn[data-filter]'));

    // Validation + affichage erreurs
    const getActiveFilter = () => {
      if (!filterBtns.length) return 'all';
      const active = filterBtns.find((b) => b.getAttribute('aria-pressed') === 'true');
      const filter = active?.dataset?.filter;
      return filter === 'all' || filter === 'todo' || filter === 'done' ? filter : 'all';
    };

    const setActiveFilter = (filter) => {
      filterBtns.forEach((btn) => {
        const isActive = btn.dataset.filter === filter;
        btn.setAttribute('aria-pressed', String(isActive));
        btn.classList.toggle('is-active', isActive);
      });
      render(filter);
    };

    const priorityRank = { high: 0, medium: 1, low: 2 };

    let tasks = [];
    try {
      tasks = loadTasks();
    } catch {
      tasks = [];
    }

    const syncStats = () => {
      const total = tasks.length;
      const todo = tasks.filter((t) => t.status === 'todo').length;
      const done = total - todo;

      if (statTotal) statTotal.textContent = String(total);
      if (statTodo) statTodo.textContent = String(todo);
      if (statDone) statDone.textContent = String(done);
      if (taskCount) taskCount.textContent = String(total);
    };

    const updateEmptyState = (filtered, activeFilter) => {
      if (!emptyStateEl) return;

      if (filtered.length > 0) {
        emptyStateEl.style.display = 'none';
        return;
      }

      const msg =
        activeFilter === 'todo'
          ? 'Aucune tâche à faire.'
          : activeFilter === 'done'
            ? 'Aucune tâche terminée.'
            : 'Aucune tâche pour le moment.';

      emptyStateEl.textContent = msg;
      emptyStateEl.style.display = 'block';
    };

    const render = (activeFilter) => {
      const filter = activeFilter || getActiveFilter();
      const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

      if (taskList) taskList.innerHTML = '';

      const sorted = filtered
        .slice()
        .sort((a, b) => {
          const byDue = String(a.dueDateISO).localeCompare(String(b.dueDateISO));
          if (byDue !== 0) return byDue;
          const ra = priorityRank[a.priority] ?? 9;
          const rb = priorityRank[b.priority] ?? 9;
          return ra - rb;
        });

      const frag = document.createDocumentFragment();

      for (const t of sorted) {
        const li = document.createElement('li');
        li.className = 'home-dashboard__task';
        li.setAttribute('role', 'listitem');

        // Structure interne (basée sur les classes existantes)
        const left = document.createElement('div');
        left.style.display = 'flex';
        left.style.flexDirection = 'column';
        left.style.gap = '8px';

        const badgesRow = document.createElement('div');
        badgesRow.style.display = 'flex';
        badgesRow.style.gap = '8px';
        badgesRow.style.flexWrap = 'wrap';

        const statusBadge = document.createElement('span');
        statusBadge.className = 'task-badge badge';
        statusBadge.classList.add(t.status === 'done' ? 'badge--done' : 'badge--todo');
        statusBadge.textContent = statusFR(t.status);

        const priorityBadge = document.createElement('span');
        priorityBadge.className = 'task-badge badge';
        if (t.priority === 'high') priorityBadge.classList.add('badge--high');
        else if (t.priority === 'medium') priorityBadge.classList.add('badge--medium');
        else priorityBadge.classList.add('badge--todo');
        priorityBadge.textContent = `Priorité: ${priorityToFR(t.priority)}`;

        badgesRow.appendChild(statusBadge);
        badgesRow.appendChild(priorityBadge);

        const title = document.createElement('div');
        title.className = 'home-dashboard__task-title';
        title.textContent = t.title;

        const meta = document.createElement('div');
        meta.className = 'home-dashboard__task-meta';
        meta.textContent = `Échéance: ${t.dueDateISO} (${formatDueDateFR(t.dueDateISO)})`;

        left.appendChild(badgesRow);
        left.appendChild(title);
        left.appendChild(meta);

        const right = document.createElement('div');

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '10px';
        actions.style.alignItems = 'center';
        actions.style.marginTop = '10px';
        actions.style.flexWrap = 'wrap';

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.textContent = t.status === 'done' ? 'Remettre à faire' : 'Marquer terminée';

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.textContent = 'Supprimer';

        // Styles inline minimaux uniquement pour éviter dépendances CSS absentes
        [toggleBtn, deleteBtn].forEach((btn) => {
          btn.style.height = '34px';
          btn.style.padding = '0 12px';
          btn.style.borderRadius = '12px';
          btn.style.fontWeight = '900';
          btn.style.border = '1px solid rgba(255,255,255,.12)';
          btn.style.background = 'rgba(255,255,255,.03)';
        });

        toggleBtn.style.color = 'rgba(234,240,255,.95)';
        deleteBtn.style.color = 'rgba(255, 200, 200, 0.95)';

        toggleBtn.addEventListener('click', () => {
          tasks = tasks.map((x) =>
            x.id === t.id ? { ...x, status: x.status === 'done' ? 'todo' : 'done' } : x
          );
          try {
            saveTasks(tasks);
          } catch {
            // ignore
          }
          render(getActiveFilter());
        });

        deleteBtn.addEventListener('click', () => {
          const ok = window.confirm('Supprimer cette tâche ?');
          if (!ok) return;
          tasks = tasks.filter((x) => x.id !== t.id);
          try {
            saveTasks(tasks);
          } catch {
            // ignore
          }
          render(getActiveFilter());
        });

        actions.appendChild(toggleBtn);
        actions.appendChild(deleteBtn);
        right.appendChild(actions);

        li.appendChild(left);
        li.appendChild(right);

        frag.appendChild(li);
      }

      taskList.appendChild(frag);

      syncStats();
      updateEmptyState(sorted, filter);
    };

    const clearErrors = () => {
      // On retire les erreurs propres au champ s'il existe
      const allErrors = form.querySelectorAll('[data-error-for]');
      allErrors.forEach((n) => n.remove());
      titleEl.removeAttribute('aria-invalid');
      priorityEl.removeAttribute('aria-invalid');
      dueDateEl.removeAttribute('aria-invalid');
    };

    const showFieldError = (field, message) => {
      const formField = field.closest('.form-field') || field.parentElement;
      if (!formField) return;

      formField.querySelectorAll('[data-error-for]').forEach((n) => n.remove());

      const err = document.createElement('div');
      err.setAttribute('data-error-for', field.id);
      err.setAttribute('role', 'alert');
      err.textContent = message;
      err.style.marginTop = '6px';
      err.style.color = 'rgba(255, 190, 190, 0.98)';
      err.style.fontWeight = '800';
      err.style.fontSize = '12.5px';

      formField.appendChild(err);
      field.setAttribute('aria-invalid', 'true');
    };

    const validate = () => {
      const title = String(titleEl.value || '').trim();
      const priority = priorityEl.value;
      const dueDateISO = String(dueDateEl.value || '');

      if (!title) return { ok: false, message: 'Le titre est obligatoire.', field: titleEl };
      if (title.length < 3)
        return {
          ok: false,
          message: 'Le titre doit contenir au moins 3 caractères.',
          field: titleEl
        };
      if (title.length > 80)
        return {
          ok: false,
          message: 'Le titre ne doit pas dépasser 80 caractères.',
          field: titleEl
        };

      if (!['low', 'medium', 'high'].includes(priority))
        return { ok: false, message: 'La priorité est obligatoire.', field: priorityEl };

      if (!dueDateISO)
        return { ok: false, message: 'La date limite est obligatoire.', field: dueDateEl };

      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDateISO))
        return { ok: false, message: 'Date invalide.', field: dueDateEl };

      const todayISO = getTodayISODateLocal();
      const dueObj = isoDateToUTCDate(dueDateISO);
      const todayObj = isoDateToUTCDate(todayISO);

      if (!dueObj || !todayObj) return { ok: false, message: 'Date invalide.', field: dueDateEl };
      if (dueObj.getTime() < todayObj.getTime())
        return {
          ok: false,
          message: 'La date limite ne peut pas être inférieure à la date actuelle.',
          field: dueDateEl
        };

      return {
        ok: true,
        value: { title, priority, dueDateISO }
      };
    };

    // Init date minimale
    const todayISO = getTodayISODateLocal();
    dueDateEl.min = todayISO;

    // Filtres
    filterBtns.forEach((btn) => {
      if (!btn.hasAttribute('aria-pressed')) btn.setAttribute('aria-pressed', 'false');
    });

    const defaultFilterBtn = filterBtns.find((b) => b.dataset.filter === 'all') || filterBtns[0];
    if (defaultFilterBtn) {
      defaultFilterBtn.setAttribute('aria-pressed', 'true');
      defaultFilterBtn.classList.add('is-active');
    }

    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter || 'all';
        setActiveFilter(filter);
      });
    });

    // Soumission formulaire
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      clearErrors();

      const result = validate();
      if (!result.ok) {
        showFieldError(result.field, result.message);
        if (emptyStateEl) {
          emptyStateEl.textContent = result.message;
          emptyStateEl.style.display = 'block';
        }
        try {
          result.field.focus({ preventScroll: false });
        } catch {
          // ignore
        }
        return;
      }

      const { title, priority, dueDateISO } = result.value;
      const newTask = {
        id: getUID(),
        title,
        priority,
        dueDateISO,
        status: 'todo',
        createdAtISO: new Date().toISOString()
      };

      tasks.push(newTask);
      try {
        saveTasks(tasks);
      } catch {
        // ignore
      }

      form.reset();
      dueDateEl.min = todayISO;
      render(getActiveFilter());
    });

    // Effacer terminées
    if (clearCompletedBtn) {
      clearCompletedBtn.addEventListener('click', () => {
        const doneCount = tasks.filter((t) => t.status === 'done').length;
        if (!doneCount) {
          if (emptyStateEl) {
            emptyStateEl.textContent = 'Aucune tâche terminée à effacer.';
            emptyStateEl.style.display = 'block';
          }
          render(getActiveFilter());
          return;
        }

        const ok = window.confirm(`Effacer ${doneCount} tâche(s) terminée(s) ?`);
        if (!ok) return;

        tasks = tasks.filter((t) => t.status !== 'done');
        try {
          saveTasks(tasks);
        } catch {
          // ignore
        }
        render(getActiveFilter());
      });
    }

    // Premier rendu
    render(getActiveFilter());
  };

  // ==========================
  // Analyses
  // ==========================

  const initGraphiquesAnalyses = () => {
    // Chart.js (optionnel). Si la librairie n’est pas chargée, on sort sans erreur.
    const ChartCtor = window.Chart;
    if (!ChartCtor) return;

    const canvasStatut = document.getElementById('chartStatut');
    const canvasPriorite = document.getElementById('chartPriorite');
    const canvasTermineesParJour = document.getElementById('chartTermineesParJour');

    if (!canvasStatut && !canvasPriorite && !canvasTermineesParJour) return;

    let tasks = [];
    try {
      tasks = loadTasks();
    } catch {
      tasks = [];
    }

    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    const todo = total - done;

    const dataStatut = {
      labels: ['Terminées', 'À faire'],
      values: [done, todo]
    };

    const countsPriorite = {
      high: 0,
      medium: 0,
      low: 0
    };
    for (const t of tasks) {
      if (t?.priority === 'high') countsPriorite.high += 1;
      else if (t?.priority === 'medium') countsPriorite.medium += 1;
      else if (t?.priority === 'low') countsPriorite.low += 1;
    }

    const dueDateCounts = new Map(); // YYYY-MM-DD => nb terminées
    for (const t of tasks) {
      if (t.status !== 'done') continue;
      const iso = t.dueDateISO;
      if (!iso) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) continue;
      dueDateCounts.set(iso, (dueDateCounts.get(iso) || 0) + 1);
    }

    // On cible “par jour” sur la période observée : les 14 derniers jours (si possible), sinon l’étendue.
    const todayISO = getTodayISODateLocal();
    const todayUTC = isoDateToUTCDate(todayISO);

    const labelsLignes = [];
    const valuesLignes = [];

    const makeLabel = (iso) => {
      const dt = isoDateToUTCDate(iso);
      if (!dt) return iso;
      try {
        return new Intl.DateTimeFormat('fr-FR', {
          day: '2-digit',
          month: '2-digit'
        }).format(dt);
      } catch {
        return iso;
      }
    };

    // Générer 14 jours glissants : [today-13 ... today]
    if (todayUTC) {
      for (let i = 13; i >= 0; i--) {
        const d = new Date(todayUTC.getTime() - i * 24 * 60 * 60 * 1000);
        const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        labelsLignes.push(makeLabel(iso));
        valuesLignes.push(dueDateCounts.get(iso) || 0);
      }
    } else {
      // Fallback : tri des clés ISO disponibles
      const keys = Array.from(dueDateCounts.keys()).sort();
      for (const iso of keys.slice(-14)) {
        labelsLignes.push(makeLabel(iso));
        valuesLignes.push(dueDateCounts.get(iso) || 0);
      }
    }

    const palette = {
      done: 'rgba(75, 192, 192, 0.95)',
      todo: 'rgba(255, 99, 132, 0.90)',
      high: 'rgba(255, 159, 64, 0.95)',
      medium: 'rgba(54, 162, 235, 0.95)',
      low: 'rgba(153, 102, 255, 0.95)'
    };

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

    const formatNombre = (n) => String(Math.round(Number(n) || 0));

    // Doughnut : statut
    if (canvasStatut) {
      ensureDestroy(canvasStatut);
      canvasStatut.__chartInstance = new ChartCtor(canvasStatut, {
        type: 'doughnut',
        data: {
          labels: dataStatut.labels,
          datasets: [
            {
              data: dataStatut.values,
              backgroundColor: [palette.done, palette.todo],
              borderWidth: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: 'rgba(234,240,255,.95)'
              }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const val = ctx.raw ?? 0;
                  const label = ctx.label || '';
                  return `${label} : ${formatNombre(val)}`;
                }
              }
            }
          }
        }
      });
    }

    // Barres : priorités
    if (canvasPriorite) {
      ensureDestroy(canvasPriorite);
      const labels = ['Haute', 'Moyenne', 'Faible'];
      const values = [countsPriorite.high, countsPriorite.medium, countsPriorite.low];
      canvasPriorite.__chartInstance = new ChartCtor(canvasPriorite, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Nombre de tâches',
              data: values,
              backgroundColor: [palette.high, palette.medium, palette.low],
              borderWidth: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const val = ctx.raw ?? 0;
                  return ` ${formatNombre(val)}`;
                }
              }
            }
          },
          scales: {
            x: {
              ticks: { color: 'rgba(234,240,255,.95)' },
              grid: { display: false }
            },
            y: {
              beginAtZero: true,
              ticks: { color: 'rgba(234,240,255,.95)' },
              grid: { color: 'rgba(255,255,255,.08)' }
            }
          }
        }
      });
    }

    // Ligne : terminées par jour
    if (canvasTermineesParJour) {
      ensureDestroy(canvasTermineesParJour);
      canvasTermineesParJour.__chartInstance = new ChartCtor(canvasTermineesParJour, {
        type: 'line',
        data: {
          labels: labelsLignes,
          datasets: [
            {
              label: 'Tâches terminées',
              data: valuesLignes,
              borderColor: 'rgba(75, 192, 192, 0.95)',
              backgroundColor: 'rgba(75, 192, 192, 0.15)',
              tension: 0.35,
              fill: true,
              pointRadius: 3,
              pointHoverRadius: 5
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: 'rgba(234,240,255,.95)'
              }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const val = ctx.raw ?? 0;
                  return ` ${formatNombre(val)} tâche(s)`;
                }
              }
            }
          },
          scales: {
            x: {
              ticks: { color: 'rgba(234,240,255,.95)' },
              grid: { display: false }
            },
            y: {
              beginAtZero: true,
              ticks: { color: 'rgba(234,240,255,.95)' },
              grid: { color: 'rgba(255,255,255,.08)' }
            }
          }
        }
      });
    }
  };

  const initAnalyses = () => {
    // Graphiques (si Chart.js est dispo). Ne perturbe pas les KPI.
    initGraphiquesAnalyses();

    const kpiGrid = document.querySelector('.analyses-kpi__grid');
    const recEl = document.querySelector('.analyses-recommendations__text');
    const tbody = document.querySelector('.analyses-history__table tbody');

    if (!kpiGrid) return;

    const cards = Array.from(document.querySelectorAll('.analyses-kpi__card'));
    if (!cards.length) return;

    const valueEls = (i) => cards[i]?.querySelector('.analyses-kpi__value') || null;
    const setKPI = (index, text) => {
      const el = valueEls(index);
      if (el) el.textContent = text;
    };

    let tasks = [];
    try {
      tasks = loadTasks();
    } catch {
      tasks = [];
    }

    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    const inProgress = tasks.filter((t) => t.status === 'todo').length;
    const successRate = total ? (done / total) * 100 : 0;
    const highPriority = tasks.filter((t) => t.priority === 'high').length;

    // Proxy productivité hebdomadaire : nombre de tâches terminées sur 7 jours (selon dueDateISO)
    let weeklyProd = 0;
    const todayISO = getTodayISODateLocal();
    const today = isoDateToUTCDate(todayISO);
    if (today) {
      const from = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
      weeklyProd = tasks.filter((t) => {
        if (t.status !== 'done') return false;
        const dt = isoDateToUTCDate(t.dueDateISO);
        if (!dt) return false;
        return dt.getTime() >= from.getTime() && dt.getTime() <= today.getTime();
      }).length;
    }

    const formatPercent = (v) => `${Math.round(clamp(v, 0, 100))}%`;

    const setZeroState = () => {
      // Ordre des KPI : total, done, inProgress, successRate, highPriority, weeklyProd
      setKPI(0, '0');
      setKPI(1, '0');
      setKPI(2, '0');
      setKPI(3, '0%');
      setKPI(4, '0');
      setKPI(5, '0');

      if (tbody) tbody.innerHTML = '';
      if (recEl) {
        recEl.textContent =
          'Aucune tâche trouvée : ajoutez-en dans l’onglet Tâches pour voir les analyses.';
      }
    };

    if (!total) {
      setZeroState();
      return;
    }

    setKPI(0, String(total));
    setKPI(1, String(done));
    setKPI(2, String(inProgress));
    setKPI(3, formatPercent(successRate));
    setKPI(4, String(highPriority));
    setKPI(5, String(weeklyProd));

    // Historique (jusqu’à 6 lignes)
    if (tbody) {
      const priorityRank = { high: 0, medium: 1, low: 2 };
      const rows = tasks
        .slice()
        .sort((a, b) => {
          const byDue = String(b.dueDateISO || '').localeCompare(String(a.dueDateISO || ''));
          if (byDue !== 0) return byDue;
          const ra = priorityRank[a.priority] ?? 9;
          const rb = priorityRank[b.priority] ?? 9;
          return ra - rb;
        })
        .slice(0, 6)
        .map((t) => {
          const action = t.status === 'done' ? 'Marquer comme terminé' : 'Création / planification';
          const category =
            t.priority === 'high' ? 'Priorité' : t.priority === 'medium' ? 'Études' : 'Travail';
          const result = t.status === 'done' ? 'Succès' : 'En cours';

          return `
            <tr>
              <td>${String(t.dueDateISO)}</td>
              <td>${String(action)}</td>
              <td>${String(category)}</td>
              <td>${String(result)}</td>
            </tr>
          `;
        })
        .join('');

      tbody.innerHTML = rows;
    }

    // Recommandations
    if (recEl) {
      const parts = [];

      if (successRate < 40 && total >= 5) {
        parts.push('Augmentez le taux de réussite : privilégiez les échéances proches et limitez le multi-contexte.');
      }
      if (highPriority > Math.max(2, Math.floor(total / 3))) {
        parts.push('Trop de priorités hautes : regroupez les tâches critiques en blocs de 25–50 minutes.');
      }
      if (weeklyProd === 0) {
        parts.push('Cette semaine : démarrez au moins 1 tâche “high” dès aujourd’hui.');
      } else if (weeklyProd >= 3) {
        parts.push('Bonne cadence : gardez le rythme et bloquez 1 créneau protégé par jour.');
      }

      if (!parts.length) {
        parts.push('Continuez : suivez vos échéances et améliorez progressivement vos priorités.');
      }

      recEl.textContent = parts.join(' ');
    }
  };

  // ==========================
  // IA (sans API)
  // ==========================

  const initIA = () => {
    const aiInput = document.querySelector('#aiInput');
    const analyzeBtn = document.querySelector('.ai-analyse__btn');

    if (!aiInput || !analyzeBtn) return;

    const cards = Array.from(document.querySelectorAll('.ai-card'));
    const cardValues = {
      priorite: cards[0]?.querySelector('.ai-card__value') || null,
      urgence: cards[1]?.querySelector('.ai-card__value') || null,
      conseil: cards[2]?.querySelector('.ai-card__value') || null
    };

    const lines = Array.from(document.querySelectorAll('.ai-line'));
    const lineValues = {
      objectif: lines[0]?.querySelector('.ai-line__value') || null,
      topPriorite: lines[1]?.querySelector('.ai-line__value') || null,
      prochaineAction: lines[2]?.querySelector('.ai-line__value') || null,
      risque: lines[3]?.querySelector('.ai-line__value') || null
    };

    const setTextSafe = (el, text) => {
      if (!el) return;
      el.textContent = text;
    };

    const normalizeText = (s) => String(s || '').toLowerCase();

    const analyzeTextForPriority = (text) => {
      const t = normalizeText(text);
      const has = (kw) => t.includes(kw);

      let score = 0;

      // Mots-clés demandés
      if (has('urgent')) score += 4;
      if (has('important')) score += 3;
      if (has('deadline')) score += 4;
      if (has('aujourd')) {
        if (has('aujourd’hui') || has('aujourdhui')) score += 2;
        score += 1;
      }
      if (has('aujourd’hui') || has('aujourdhui')) score += 2;
      if (has('demain')) score += 2;

      let priority;
      if (score >= 6) priority = 'high';
      else if (score >= 3) priority = 'medium';
      else priority = 'low';

      let urgence;
      if (has('urgent') || has('deadline') || has('aujourd’hui') || has('aujourdhui')) {
        urgence = 'Élevée (à traiter en premier)';
      } else if (has('demain')) {
        urgence = 'Moyenne (d’ici demain)';
      } else {
        urgence = 'Faible (planifier sereinement)';
      }

      return { priority, urgence };
    };

    const priorityToFR = (p) => (p === 'high' ? 'Haute' : p === 'medium' ? 'Moyenne' : 'Faible');

    const buildRecommendation = (analysis, inputText) => {
      const trimmed = String(inputText || '').trim();
      if (!trimmed) {
        return {
          priorite: '—',
          urgence: '—',
          conseil: 'Collez une liste de tâches pour obtenir une recommandation.'
        };
      }

      const base = `Ordre recommandé : 1) ${priorityToFR(analysis.priority)} d’abord, 2) puis le reste.`;

      const conseil =
        analysis.priority === 'high'
          ? 'Commence par la tâche la plus critique, puis limite les interruptions pendant 25 minutes.'
          : analysis.priority === 'medium'
            ? 'Traite d’abord ce qui a une échéance proche, et découpe en prochaines actions simples.'
            : 'Planifie à l’avance : prépare le contexte, puis exécute quand l’effort devient facile.';

      return {
        priorite: `Priorité suggérée : ${priorityToFR(analysis.priority)}`,
        urgence: `Urgence : ${analysis.urgence}`,
        conseil: `${base} ${conseil}`
      };
    };

    // Valeurs par défaut
    setTextSafe(cardValues.priorite, '—');
    setTextSafe(cardValues.urgence, '—');
    setTextSafe(cardValues.conseil, '— (obtenu après analyse)');

    setTextSafe(lineValues.objectif, '—');
    setTextSafe(lineValues.topPriorite, '—');
    setTextSafe(lineValues.prochaineAction, '—');
    setTextSafe(lineValues.risque, '—');

    analyzeBtn.addEventListener('click', () => {
      const inputText = aiInput.value || '';
      const analysis = analyzeTextForPriority(inputText);
      const rec = buildRecommendation(analysis, inputText);

      setTextSafe(cardValues.priorite, rec.priorite);
      setTextSafe(cardValues.urgence, rec.urgence);
      setTextSafe(cardValues.conseil, rec.conseil);

      // Résumé du jour (simple)
      if (analysis.priority === 'high') {
        setTextSafe(lineValues.objectif, 'Réussir la tâche clé avant la fin de journée.');
      } else {
        setTextSafe(lineValues.objectif, 'Avancer avec une action concrète d’ici demain.');
      }

      setTextSafe(lineValues.topPriorite, `Top priorité : ${priorityToFR(analysis.priority)}`);
      setTextSafe(
        lineValues.prochaineAction,
        'Prochaine action : découper et démarrer par la plus petite étape possible.'
      );
      setTextSafe(
        lineValues.risque,
        'Risque : laisser les tâches “urgentes” manger tout le temps sans cadence.'
      );
    });
  };

  // ==========================
  // Focus (minuteur)
  // ==========================

  const initFocus = () => {
    if (!document.querySelector('.focus-main')) return;

    // Minuteur 25:00
    const SECONDES_PAR_SESSION = 25 * 60;

    const timeRemainingEl = document.querySelector('[aria-label="Temps restant"]');

    // Boutons potentiels (tolérant : selon le HTML, ils peuvent exister ou non)
    const startBtn =
      document.querySelector('[data-focus-start]') ||
      document.querySelector('#focusStart') ||
      document.querySelector('.focus-start');

    const pauseBtn =
      document.querySelector('[data-focus-pause]') ||
      document.querySelector('#focusPause') ||
      document.querySelector('.focus-pause');

    const resetBtn =
      document.querySelector('[data-focus-reset]') ||
      document.querySelector('#focusReset') ||
      document.querySelector('.focus-reset');

    // Tâche active (affichage optionnel)
    const figureTextEl = document.querySelector('[aria-label*="Carte"], [role="img"]');

    const formatMMSS = (s) => {
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      return `${mm}:${ss}`;
    };

    const getActiveTaskText = () => {
      try {
        const tasks = loadTasks();
        if (!tasks.length) return '—';
        const pr = { high: 0, medium: 1, low: 2 };
        const sorted = tasks.slice().sort((a, b) => {
          const byPr = (pr[a.priority] ?? 9) - (pr[b.priority] ?? 9);
          if (byPr !== 0) return byPr;
          return String(a.dueDateISO).localeCompare(String(b.dueDateISO));
        });
        return sorted[0]?.title ? String(sorted[0].title) : '—';
      } catch {
        return '—';
      }
    };

    let remaining = SECONDES_PAR_SESSION;
    let intervalId = null;

    const renderRemaining = () => {
      if (!timeRemainingEl) return;
      const mmss = formatMMSS(remaining);
      // Le HTML peut afficher “12 min 00 s” : on garde un format simple et robuste.
      timeRemainingEl.textContent = mmss;
    };

    const startTimer = () => {
      if (intervalId) return;
      intervalId = window.setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          remaining = 0;
          renderRemaining();
          if (intervalId) {
            window.clearInterval(intervalId);
            intervalId = null;
          }
          // Pas d’alert pour ne pas perturber l’UX, seulement un message aria si possible.
        } else {
          renderRemaining();
        }
      }, 1000);

      renderRemaining();
    };

    const pauseTimer = () => {
      if (!intervalId) return;
      window.clearInterval(intervalId);
      intervalId = null;
    };

    const resetTimer = () => {
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
      remaining = SECONDES_PAR_SESSION;
      renderRemaining();
    };

    // Affichage initial
    try {
      if (figureTextEl) {
        const taskText = getActiveTaskText();
        // Ne pas casser l’HTML si le contenu est géré autrement
        figureTextEl.textContent = taskText;
      }
    } catch {
      // ignore
    }

    renderRemaining();

    // Brancher boutons uniquement s’ils existent
    if (startBtn) startBtn.addEventListener('click', startTimer);
    if (pauseBtn) pauseBtn.addEventListener('click', pauseTimer);
    if (resetBtn) resetBtn.addEventListener('click', resetTimer);
  };

  // ==========================
  // Bootstrap par page
  // ==========================

  const bootstrap = () => {
    // Navigation sur toutes les pages
    initNavigation();

    if (document.querySelector('.home-main') && document.querySelector('.home-nav__list')) {
      initAccueil();
    }

    // Tâches
    const hasTaskUI =
      !!document.querySelector('#taskForm') &&
      !!document.querySelector('#taskList') &&
      !!document.querySelector('#taskInput') &&
      !!document.querySelector('#priorityInput') &&
      !!document.querySelector('#dateInput');

    if (hasTaskUI) initTaches();

    // Analyses
    const hasAnalysesUI =
      !!document.querySelector('.analyses-kpi__grid') &&
      !!document.querySelector('.analyses-history__table');

    if (hasAnalysesUI) initAnalyses();

    // IA
    const hasIAUI = !!document.querySelector('#aiInput') && !!document.querySelector('.ai-analyse__btn');
    if (hasIAUI) initIA();

    // Focus
    const hasFocusUI = !!document.querySelector('.focus-main');
    if (hasFocusUI) initFocus();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();

