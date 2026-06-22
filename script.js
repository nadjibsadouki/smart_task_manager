(() => {
  'use strict';

  /**
   * Le fichier script.js est chargé sur index.html via <script defer>.
   * On l’utilise aussi pour `tache.html`.
   */

  const isHomePage =
    document.querySelector('.home-main') &&
    document.querySelector('.home-header') &&
    document.querySelector('.home-nav__list');

  const isTaskPage =
    document.querySelector('main[aria-label="Gestion des tâches"]') &&
    document.querySelector('#taskForm') &&
    document.querySelector('#taskList');

  // Si aucune des 2 pages n’est détectée, on ne fait rien.
  if (!isHomePage && !isTaskPage) return;


  /**
   * Respect de l’accessibilité : si l’utilisateur demande moins d’animations,
   * on évite autant que possible les mouvements.
   */
  const reduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /**
   * Récupère le nom de la page courante (ex: "index.html", "tasks.html").
   */
  const getCurrentPage = () => {
    const path = window.location.pathname || '';
    return path.split('/').filter(Boolean).pop() || '';
  };

  /**
   * Normalise une URL relative vers un nom de fichier.
   */
  const normalizeHrefToFile = (href) => {
    if (!href) return '';
    try {
      const url = new URL(href, window.location.origin);
      return url.pathname.split('/').filter(Boolean).pop() || '';
    } catch {
      return href;
    }
  };

  /**
   * 1) Animation douce des sections au chargement / au scroll.
   * ---------------------------------------------------------
   * On cible uniquement les éléments présents sur index.html.
   * La mise à l’écran est pilotée par IntersectionObserver avec fallback.
   */
  const initScrollReveal = () => {
    const targets = [
      ...document.querySelectorAll(
        '.home-hero, .home-section, .home-footer, .home-roadmap__item'
      ),
      ...document.querySelectorAll('.home-card, .home-dashboard'),
      ...document.querySelectorAll('.home-mini-stat')
    ];

    const uniqueTargets = Array.from(new Set(targets));
    if (!uniqueTargets.length || reduceMotion) {
      // Fallback : affichage immédiat sans animation.
      uniqueTargets.forEach((el) => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      return;
    }

    uniqueTargets.forEach((el) => {
      // Etat initial.
      el.style.opacity = '0';
      el.style.transform = 'translateY(18px)';
      el.style.willChange = 'transform, opacity';
      el.style.transition =
        'opacity 650ms ease, transform 720ms cubic-bezier(0.2, 0.8, 0.2, 1)';
    });

    if (!('IntersectionObserver' in window)) {
      uniqueTargets.forEach((el) => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
          observer.unobserve(el);
        });
      },
      {
        root: null,
        threshold: 0.14,
        rootMargin: '0px 0px -12% 0px'
      }
    );

    uniqueTargets.forEach((el) => observer.observe(el));
  };

  /**
   * 2) Lien de navigation actif.
   * ----------------------------
   * index.html a un aria-current="page" déjà présent sur Home.
   * Ici on le met à jour correctement pour les autres pages.
   */
  const initActiveNavLink = () => {
    const navList = document.querySelector('.home-nav__list');
    if (!navList) return;

    const currentFile = getCurrentPage() || 'index.html';

    const links = Array.from(navList.querySelectorAll('a[href]'));
    if (!links.length) return;

    // Effacer aria-current.
    links.forEach((a) => {
      if (a.hasAttribute('aria-current')) a.removeAttribute('aria-current');
    });

    // Appliquer aria-current sur le lien correspondant.
    let matched = false;
    links.forEach((a) => {
      const hrefFile = normalizeHrefToFile(a.getAttribute('href'));
      if (hrefFile && hrefFile === currentFile) {
        a.setAttribute('aria-current', 'page');
        matched = true;
      }
    });

    // Sécurité : si aucun match, on force index.
    if (!matched && currentFile === 'index.html') {
      links.forEach((a) => {
        const hrefFile = normalizeHrefToFile(a.getAttribute('href'));
        if (!hrefFile || hrefFile === 'index.html') {
          a.setAttribute('aria-current', 'page');
        }
      });
    }
  };

  /**
   * 4) Animation légère des cartes au survol.
   * ----------------------------------------
   * Même si style.css gère déjà un hover, on ajoute une micro-interaction
   * (inclinaison) uniquement pour améliorer l’expérience.
   */
  const initCardHover = () => {
    const cards = Array.from(document.querySelectorAll('.home-card'));
    if (!cards.length || reduceMotion) return;

    const onPointerMove = (e, card) => {
      const rect = card.getBoundingClientRect();
      const x = rect.width ? (e.clientX - rect.left) / rect.width : 0.5;
      const y = rect.height ? (e.clientY - rect.top) / rect.height : 0.5;

      const rotateX = (0.5 - y) * 3.5; // deg
      const rotateY = (x - 0.5) * 4.5; // deg

      card.style.transform = `translateY(-3px) perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    };

    const onPointerEnter = (e) => {
      const card = e.currentTarget;
      card.style.transition = card.style.transition || 'transform 160ms ease';
      card.style.willChange = 'transform';
      card.style.transform = 'translateY(-3px)';
    };

    const onPointerLeave = (e) => {
      const card = e.currentTarget;
      // On laisse le hover CSS faire le reste.
      card.style.transform = '';
    };

    cards.forEach((card) => {
      card.addEventListener('pointerenter', onPointerEnter);
      card.addEventListener(
        'pointermove',
        (e) => onPointerMove(e, card),
        { passive: true }
      );
      card.addEventListener('pointerleave', onPointerLeave);
    });
  };

  /**
   * 5) Animation des statistiques de la preview.
   * --------------------------------------------
   * - cible .home-dashboard__stats
   * - anime les valeurs numériques dans .home-mini-stat__value
   */
  const animateNumber = (from, to, durationMs, onUpdate) => {
    const start = performance.now();
    const delta = to - from;

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const step = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      const value = from + delta * easeOutCubic(t);
      onUpdate(value, t);
      if (t < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  };

  const initStatsAnimation = () => {
    const statsWrap = document.querySelector('.home-dashboard__stats');
    if (!statsWrap) return;

    if (reduceMotion) {
      // Accessibilité : on n’anime pas, on garde la valeur telle quelle.
      return;
    }

    const valueEls = Array.from(
      statsWrap.querySelectorAll('.home-mini-stat__value')
    );

    const parsed = valueEls
      .map((el) => {
        const raw = (el.textContent || '').trim();
        const target = Number(raw.replace(',', '.'));
        return Number.isFinite(target) ? { el, target } : null;
      })
      .filter(Boolean);

    if (!parsed.length) return;

    let started = false;

    const startAnimation = () => {
      if (started) return;
      started = true;

      parsed.forEach(({ el, target }, index) => {
        const from = 0;
        const delay = index * 120;

        // On stocke un état (utile si re-rendu futur).
        el.dataset.animatedFrom = String(from);

        window.setTimeout(() => {
          animateNumber(from, target, 900, (value) => {
            // Les stats sont des entiers dans la maquette.
            el.textContent = String(Math.round(value));
          });
        }, delay);
      });
    };

    if (!('IntersectionObserver' in window)) {
      startAnimation();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            startAnimation();
            observer.disconnect();
          }
        });
      },
      { threshold: 0.25, rootMargin: '0px 0px -10% 0px' }
    );

    observer.observe(statsWrap);
  };

  /**
   * 6) Menu mobile si un bouton de menu existe.
   * -------------------------------------------
   * index.html actuel n’a pas de bouton explicitement identifié.
   * On implémente un comportement générique et non intrusif.
   *
   * Candidats détectés (flexibles pour futures pages) :
   * - bouton[data-menu-toggle]
   * - #menu-toggle, .menu-toggle
   * - et un menu ciblé via [data-menu], #menu, .menu
   */
  const initMobileMenu = () => {
    // Détecter un bouton.
    const toggleBtn =
      document.querySelector('[data-menu-toggle]') ||
      document.querySelector('#menu-toggle') ||
      document.querySelector('.menu-toggle');

    if (!toggleBtn) return;

    // Détecter la cible menu.
    const menu =
      document.querySelector('[data-menu]') ||
      document.querySelector('#menu') ||
      document.querySelector('.menu');

    // Si pas de menu trouvé, on ne fait rien.
    if (!menu) return;

    const openClass = 'is-open';

    const setOpen = (isOpen) => {
      menu.classList.toggle(openClass, isOpen);
      toggleBtn.setAttribute('aria-expanded', String(isOpen));
    };

    // Etat initial.
    if (!toggleBtn.hasAttribute('aria-expanded')) {
      toggleBtn.setAttribute('aria-expanded', 'false');
    }

    toggleBtn.addEventListener('click', () => {
      const isOpen = menu.classList.contains(openClass);
      setOpen(!isOpen);
    });

    // Fermer au clic en dehors.
    document.addEventListener('click', (e) => {
      const isClickInside = menu.contains(e.target) || toggleBtn.contains(e.target);
      if (isClickInside) return;
      if (!menu.classList.contains(openClass)) return;
      setOpen(false);
    });

    // Fermer au ESC.
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!menu.classList.contains(openClass)) return;
      setOpen(false);
    });
  };

  /**
   * 7) Bouton « retour en haut » si nécessaire.
   * -------------------------------------------
   * index.html ne contient pas cet élément dans la maquette.
   * On le gère de façon générique.
   */
  const initBackToTop = () => {
    const backBtn =
      document.querySelector('[data-back-to-top]') ||
      document.querySelector('#back-to-top') ||
      document.querySelector('.back-to-top');

    if (!backBtn) return;

    const showAt = 450;

    const setVisible = (visible) => {
      backBtn.classList.toggle('is-visible', visible);
      backBtn.setAttribute('aria-hidden', String(!visible));
    };

    setVisible(false);

    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      setVisible(y > showAt);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (reduceMotion) {
        window.scrollTo(0, 0);
        return;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  /**
   * Initialisation : tout au démarrage DOM.
   */
  const init = () => {
    initActiveNavLink();
    initScrollReveal();
    initCardHover();
    initStatsAnimation();
    initMobileMenu();
    initBackToTop();
  };

  // Sécurité : exécution DOM-ready.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // ---------------------------
  // Page tache.html (Smart tasks)
  // ---------------------------
  const initTaskPage = () => {
    if (!isTaskPage) return;

    const STORAGE_KEY = 'stm_tasks_v1';

    const els = {
      form: document.querySelector('#taskForm'),
      title: document.querySelector('#taskInput'),
      priority: document.querySelector('#priorityInput'),
      dueDate: document.querySelector('#dateInput'),
      addBtn: document.querySelector('#addTaskBtn'),
      clearCompletedBtn: document.querySelector('#clearCompletedBtn'),

      statTotal: document.querySelector('#statTotal'),
      statTodo: document.querySelector('#statTodo'),
      statDone: document.querySelector('#statDone'),

      taskCount: document.querySelector('#taskCount'),
      emptyState: document.querySelector('#emptyState'),
      taskList: document.querySelector('#taskList'),

      filterBtns: Array.from(
        document.querySelectorAll('.filter-btn[data-filter]')
      )
    };

    if (!els.form || !els.taskList) return;

    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const getTodayISODateLocal = () => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const isoDateToDateUTCNoTZShift = (iso) => {
      // iso: YYYY-MM-DD
      // Date('YYYY-MM-DD') peut être interprété en UTC selon navigateurs.
      // On force une date UTC pour une comparaison stable.
      const [y, m, d] = iso.split('-').map((x) => Number(x));
      if (!y || !m || !d) return null;
      const ms = Date.UTC(y, m - 1, d);
      const dt = new Date(ms);
      return Number.isFinite(dt.getTime()) ? dt : null;
    };

    const validate = () => {
      const errors = [];
      const title = (els.title.value || '').trim();
      const priority = els.priority.value;
      const dueDateISO = els.dueDate.value;

      // Title
      if (!title) {
        errors.push({ field: els.title, message: 'Le titre est obligatoire.' });
      } else if (title.length < 3) {
        errors.push({ field: els.title, message: 'Le titre doit contenir au moins 3 caractères.' });
      } else if (title.length > 80) {
        errors.push({ field: els.title, message: 'Le titre ne doit pas dépasser 80 caractères.' });
      }

      // Priority
      if (!priority || !['low', 'medium', 'high'].includes(priority)) {
        errors.push({ field: els.priority, message: 'La priorité est obligatoire.' });
      }

      // Due date
      if (!dueDateISO) {
        errors.push({ field: els.dueDate, message: 'La date limite est obligatoire.' });
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDateISO)) {
        errors.push({ field: els.dueDate, message: 'Date invalide.' });
      } else {
        const todayISO = getTodayISODateLocal();
        const dueDateObj = isoDateToDateUTCNoTZShift(dueDateISO);
        const todayObj = isoDateToDateUTCNoTZShift(todayISO);

        if (!dueDateObj || !todayObj) {
          errors.push({ field: els.dueDate, message: 'Date invalide.' });
        } else if (dueDateObj.getTime() < todayObj.getTime()) {
          // Contrainte demandée
          errors.push({ field: els.dueDate, message: 'La date limite ne peut pas être inférieure à la date actuelle.' });
        }
      }

      // TODO: autres contraintes possibles (ex: éviter doublons)

      return { ok: errors.length === 0, errors, value: { title, priority, dueDateISO } };
    };

    const showFieldError = (field, message) => {
      if (!field) return;
      const formField = field.closest('.form-field') || field.parentElement;
      if (!formField) return;

      let err = formField.querySelector('[data-error-for]');
      if (!err || err.getAttribute('data-error-for') !== field.id) {
        // Supprimer erreurs précédentes pour ce champ
        const existing = formField.querySelectorAll('[data-error-for]');
        existing.forEach((n) => n.remove());

        err = document.createElement('div');
        err.setAttribute('data-error-for', field.id);
        err.setAttribute('role', 'alert');
        err.style.marginTop = '6px';
        err.style.color = 'rgba(255, 190, 190, 0.98)';
        err.style.fontWeight = '800';
        err.style.fontSize = '12.5px';
        err.textContent = message;
        formField.appendChild(err);
      } else {
        err.textContent = message;
      }

      field.setAttribute('aria-invalid', 'true');
    };

    const clearErrors = () => {
      const formFields = document.querySelectorAll('main[aria-label="Gestion des tâches"] .form-field');
      formFields.forEach((ff) => {
        const errs = ff.querySelectorAll('[data-error-for]');
        errs.forEach((n) => n.remove());
      });
      els.title?.removeAttribute('aria-invalid');
      els.priority?.removeAttribute('aria-invalid');
      els.dueDate?.removeAttribute('aria-invalid');
    };

    const parseTasks = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
          .filter(Boolean)
          .map((t) => ({
            id: String(t.id || ''),
            title: String(t.title || ''),
            priority: t.priority,
            dueDateISO: t.dueDateISO,
            status: t.status === 'done' ? 'done' : 'todo',
            createdAtISO: t.createdAtISO || new Date().toISOString()
          }))
          .filter((t) => t.id && t.title && t.dueDateISO);
      } catch {
        return [];
      }
    };

    const saveTasks = (tasks) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    };

    let tasks = parseTasks();

    const uid = () =>
      `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

    const formatDueDateFR = (iso) => {
      const d = isoDateToDateUTCNoTZShift(iso);
      if (!d) return iso;
      return new Intl.DateTimeFormat('fr-FR').format(d);
    };

    const priorityLabel = (p) => {
      if (p === 'high') return 'Haute';
      if (p === 'medium') return 'Moyenne';
      return 'Faible';
    };

    const badgeClassForPriority = (p) => {
      if (p === 'high') return 'badge--high';
      if (p === 'medium') return 'badge--medium';
      return 'badge--todo';
    };

    const render = (activeFilter = 'all') => {
      const filtered =
        activeFilter === 'all'
          ? tasks
          : tasks.filter((t) => t.status === activeFilter);

      // empty
      if (!filtered.length) {
        els.emptyState.style.display = 'block';
      } else {
        els.emptyState.style.display = 'none';
      }

      // list
      els.taskList.innerHTML = '';
      const frag = document.createDocumentFragment();

      // Tri: status todo d’abord? + dueDate asc + priority
      const priorityRank = { high: 0, medium: 1, low: 2 };
      filtered
        .slice()
        .sort((a, b) => {
          const byDue = a.dueDateISO.localeCompare(b.dueDateISO);
          if (byDue !== 0) return byDue;
          const ra = priorityRank[a.priority] ?? 9;
          const rb = priorityRank[b.priority] ?? 9;
          return ra - rb;
        })
        .forEach((t) => {
          const li = document.createElement('li');
          li.className = 'home-dashboard__task';
          li.setAttribute('role', 'listitem');

          const statusBadge = document.createElement('span');
          statusBadge.className = 'task-badge badge';
          statusBadge.classList.add(t.status === 'done' ? 'badge--done' : 'badge--todo');
          statusBadge.textContent = t.status === 'done' ? 'Terminée' : 'À faire';

          const priorityBadge = document.createElement('span');
          priorityBadge.className = 'task-badge badge';
          if (t.priority === 'high') priorityBadge.classList.add('badge--high');
          else if (t.priority === 'medium') priorityBadge.classList.add('badge--medium');
          else priorityBadge.classList.add('badge--todo');
          priorityBadge.textContent = `Priorité: ${priorityLabel(t.priority)}`;

          const title = document.createElement('div');
          title.className = 'home-dashboard__task-title';
          title.textContent = t.title;

          const meta = document.createElement('div');
          meta.className = 'home-dashboard__task-meta';
          meta.textContent = `Échéance: ${t.dueDateISO} (${formatDueDateFR(t.dueDateISO)})`;

          const actions = document.createElement('div');
          actions.style.display = 'flex';
          actions.style.gap = '10px';
          actions.style.alignItems = 'center';
          actions.style.marginTop = '10px';
          actions.style.flexWrap = 'wrap';

          const toggleBtn = document.createElement('button');
          toggleBtn.type = 'button';
          toggleBtn.textContent = t.status === 'done' ? 'Remettre à faire' : 'Marquer terminée';

          toggleBtn.style.height = '34px';
          toggleBtn.style.padding = '0 12px';
          toggleBtn.style.borderRadius = '12px';
          toggleBtn.style.fontWeight = '900';
          toggleBtn.style.border = '1px solid rgba(255,255,255,.12)';
          toggleBtn.style.background = 'rgba(255,255,255,.03)';
          toggleBtn.style.color = 'rgba(234,240,255,.95)';

          const deleteBtn = document.createElement('button');
          deleteBtn.type = 'button';
          deleteBtn.textContent = 'Supprimer';

          deleteBtn.style.height = '34px';
          deleteBtn.style.padding = '0 12px';
          deleteBtn.style.borderRadius = '12px';
          deleteBtn.style.fontWeight = '900';
          deleteBtn.style.border = '1px solid rgba(255,255,255,.12)';
          deleteBtn.style.background = 'rgba(255,255,255,.03)';
          deleteBtn.style.color = 'rgba(255, 200, 200, 0.95)';

          toggleBtn.addEventListener('click', () => {
            tasks = tasks.map((x) =>
              x.id === t.id
                ? { ...x, status: x.status === 'done' ? 'todo' : 'done' }
                : x
            );
            saveTasks(tasks);
            // garder filtre courant
            render(getActiveFilter());
          });

          deleteBtn.addEventListener('click', () => {
            const ok = window.confirm('Supprimer cette tâche ?');
            if (!ok) return;
            tasks = tasks.filter((x) => x.id !== t.id);
            saveTasks(tasks);
            render(getActiveFilter());
          });

          const left = document.createElement('div');
          left.style.display = 'flex';
          left.style.flexDirection = 'column';
          left.style.gap = '8px';

          const badgesRow = document.createElement('div');
          badgesRow.style.display = 'flex';
          badgesRow.style.gap = '8px';
          badgesRow.style.flexWrap = 'wrap';
          badgesRow.appendChild(statusBadge);
          badgesRow.appendChild(priorityBadge);

          left.appendChild(badgesRow);
          left.appendChild(title);
          left.appendChild(meta);

          const right = document.createElement('div');
          right.appendChild(actions);
          actions.appendChild(toggleBtn);
          actions.appendChild(deleteBtn);

          li.appendChild(left);
          li.appendChild(right);

          frag.appendChild(li);
        });

      els.taskList.appendChild(frag);

      // counters (global)
      const total = tasks.length;
      const todo = tasks.filter((t) => t.status === 'todo').length;
      const done = total - todo;

      if (els.statTotal) els.statTotal.textContent = String(total);
      if (els.statTodo) els.statTodo.textContent = String(todo);
      if (els.statDone) els.statDone.textContent = String(done);

      if (els.taskCount) els.taskCount.textContent = String(total);
    };

    const getActiveFilter = () => {
      const active = els.filterBtns.find((b) => b.getAttribute('aria-pressed') === 'true');
      return active?.dataset?.filter || 'all';
    };

    const setActiveFilter = (filter) => {
      els.filterBtns.forEach((btn) => {
        const isActive = btn.dataset.filter === filter;
        btn.setAttribute('aria-pressed', String(isActive));
        btn.classList.toggle('is-active', isActive);
      });
      render(filter);
    };

    // Filters init
    els.filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter || 'all';
        setActiveFilter(filter);
      });
    });

    // default filter
    const defaultFilterBtn = els.filterBtns.find((b) => b.dataset.filter === 'all') || els.filterBtns[0];
    if (defaultFilterBtn) {
      defaultFilterBtn.setAttribute('aria-pressed', 'true');
      defaultFilterBtn.classList.add('is-active');
    }

    // Form submit
    els.form.addEventListener('submit', (e) => {
      e.preventDefault();
      clearErrors();

      const result = validate();
      if (!result.ok) {
        // show first error only
        const first = result.errors[0];
        showFieldError(first.field, first.message);
        first.field.focus({ preventScroll: false });
        if (els.emptyState) {
          els.emptyState.textContent = first.message;
          els.emptyState.style.display = 'block';
        }
        return;
      }

      const { title, priority, dueDateISO } = result.value;

      const newTask = {
        id: uid(),
        title,
        priority,
        dueDateISO,
        status: 'todo',
        createdAtISO: new Date().toISOString()
      };

      tasks.push(newTask);
      saveTasks(tasks);

      // UX: reset form
      els.form.reset();

      // Re-apply min date behavior via validation (et éventuellement HTML)
      // set dueDate min to today
      const todayISO = getTodayISODateLocal();
      els.dueDate.min = todayISO;

      // render
      render(getActiveFilter());
    });

    // clear completed
    els.clearCompletedBtn?.addEventListener('click', () => {
      const doneCount = tasks.filter((t) => t.status === 'done').length;
      if (!doneCount) {
        // petit feedback
        if (els.emptyState) {
          els.emptyState.textContent = 'Aucune tâche terminée à effacer.';
          els.emptyState.style.display = 'block';
        }
        render(getActiveFilter());
        return;
      }

      const ok = window.confirm(`Effacer ${doneCount} tâche(s) terminée(s) ?`);
      if (!ok) return;

      tasks = tasks.filter((t) => t.status !== 'done');
      saveTasks(tasks);
      render(getActiveFilter());
    });

    // Date picker constraint: today min
    const todayISO = getTodayISODateLocal();
    if (els.dueDate) {
      els.dueDate.min = todayISO;
    }

    // initial
    render('all');
    // s’assurer que le filtre actif est respecté
    const currentFilter = getActiveFilter();
    render(currentFilter);

    // Accessibilité: feedback clavier rapide
    // (aucun focus trap ici)
    if (reduceMotion) {
      // rien
    }
  };

  // init page tâches après DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTaskPage, { once: true });
  } else {
    initTaskPage();
  }
})();
