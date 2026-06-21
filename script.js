(()=>{
  'use strict';

  const STORAGE_KEY = 'stm.tasks.v1';

  /** @typedef {'low'|'medium'|'high'} Priority */
  /** @typedef {'todo'|'done'} Status */

  /**
   * @typedef {Object} Task
   * @property {string} id
   * @property {string} title
   * @property {Priority} priority
   * @property {string} [dueDate]
   * @property {Status} status
   * @property {number} createdAt
   */

  /** @type {Task[]} */
  let tasks = [];

  /** @type {('all'|'todo'|'done')} */
  let activeFilter = 'all';

  const $ = (sel) => document.querySelector(sel);

  const el = {
    taskForm: $('#taskForm'),
    taskInput: $('#taskInput'),
    priorityInput: $('#priorityInput'),
    dateInput: $('#dateInput'),

    addTaskBtn: $('#addTaskBtn'),
    clearCompletedBtn: $('#clearCompletedBtn'),
    formHelper: $('#formHelper'),

    filterButtons: Array.from(document.querySelectorAll('.filter-btn')),

    taskList: $('#taskList'),
    emptyState: $('#emptyState'),
    taskCount: $('#taskCount'),
    srStatus: $('#srStatus'),

    statTotal: $('#statTotal'),
    statTodo: $('#statTodo'),
    statDone: $('#statDone'),
  };

  const uid = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `t_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  function parseISODateToLocalInput(dateStr){
    // dateStr comes from <input type="date"> or our storage.
    // If stored as YYYY-MM-DD, just return it.
    if(!dateStr) return '';
    const m = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
    return m ? dateStr : '';
  }

  function priorityToBadgeClass(priority){
    if(priority === 'low') return 'badge--low';
    if(priority === 'medium') return 'badge--medium';
    return 'badge--high';
  }

  function statusLabel(status){
    return status === 'done' ? 'Terminée' : 'À faire';
  }

  function dueDateToText(dueDate){
    if(!dueDate) return '';
    // Keep it simple: show YYYY-MM-DD as provided.
    return dueDate;
  }

  function dueDateIsSoon(dueDate){
    if(!dueDate) return false;
    // If within 48 hours
    const due = new Date(dueDate + 'T00:00:00');
    if(Number.isNaN(due.getTime())) return false;
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    return diffMs >= 0 && diffMs <= 48*60*60*1000;
  }

  function sortTasksForDisplay(list){
    // High priority first, then due date soonest, then newest
    const pr = { low: 1, medium: 2, high: 3 };
    return [...list].sort((a,b)=>{
      const p = pr[b.priority] - pr[a.priority];
      if(p !== 0) return p;

      const ad = a.dueDate ? new Date(a.dueDate+'T00:00:00').getTime() : Infinity;
      const bd = b.dueDate ? new Date(b.dueDate+'T00:00:00').getTime() : Infinity;
      if(ad !== bd) return ad - bd;

      return (b.createdAt - a.createdAt);
    });
  }

  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw){
        tasks = [];
      } else {
        const parsed = JSON.parse(raw);
        if(Array.isArray(parsed)){
          tasks = parsed.filter(Boolean).map((t)=>{
            /** @type {Task} */
            const task = {
              id: String(t.id ?? uid()),
              title: String(t.title ?? ''),
              priority: (t.priority === 'low' || t.priority === 'medium' || t.priority === 'high') ? t.priority : 'medium',
              dueDate: typeof t.dueDate === 'string' ? parseISODateToLocalInput(t.dueDate) : '',
              status: (t.status === 'done' ? 'done' : 'todo'),
              createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
            };
            return task;
          });
        } else {
          tasks = [];
        }
      }
    }catch{
      tasks = [];
    }
  }

  function save(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  function setHelper(text){
    el.formHelper.textContent = text;
  }

  function setSrStatus(text){
    if(!el.srStatus) return;
    el.srStatus.textContent = '';
    // Force reflow for SR updates
    requestAnimationFrame(()=>{ el.srStatus.textContent = text; });
  }

  function animateEnter(item){
    // Add a quick "pop" animation using inline animation via class-like effect.
    item.animate([
      { opacity: 0, transform: 'translateY(10px) scale(0.98)', filter: 'blur(4px)' },
      { opacity: 1, transform: 'translateY(0) scale(1)', filter: 'blur(0px)' },
    ], { duration: 280, easing: 'cubic-bezier(.2,.9,.2,1)' });
  }

  function animateExit(item){
    return item.animate([
      { opacity: 1, transform: 'translateX(0) scale(1)' },
      { opacity: 0, transform: 'translateX(-10px) scale(0.98)' },
    ], { duration: 180, easing: 'ease-out', fill: 'forwards' }).finished;
  }

  function renderStats(){
    const total = tasks.length;
    const todo = tasks.filter(t=>t.status==='todo').length;
    const done = total - todo;

    if(el.statTotal) el.statTotal.textContent = String(total);
    if(el.statTodo) el.statTodo.textContent = String(todo);
    if(el.statDone) el.statDone.textContent = String(done);
  }

  function getVisibleTasks(){
    const filtered = tasks.filter(t=>{
      if(activeFilter === 'all') return true;
      return t.status === activeFilter;
    });
    return sortTasksForDisplay(filtered);
  }

  function taskItemTemplate(task){
    const badgeClass = priorityToBadgeClass(task.priority);
    const dueText = dueDateToText(task.dueDate);
    const soon = dueDateIsSoon(task.dueDate);

    const dueBadge = task.dueDate ? `
      <span class="badge ${soon ? 'badge--high' : ''}" style="${soon ? 'border-color: rgba(255,204,102,0.55); background: rgba(255,204,102,0.14);' : ''}">
        ⏰ ${dueText}${soon ? ' • Bientôt' : ''}
      </span>
    ` : '';

    const priorityBadgeText = task.priority === 'high' ? 'Haute' : task.priority === 'medium' ? 'Moyenne' : 'Faible';

    const priorityBadge = `
      <span class="badge ${badgeClass}">
        ⚑ ${priorityBadgeText}
      </span>
    `;

    const statusBadge = `
      <span class="badge" style="border-color: rgba(255,255,255,0.14); background: rgba(255,255,255,0.06);">
        ✓ ${statusLabel(task.status)}
      </span>
    `;

    const checkBtnLabel = task.status === 'done' ? 'Re-ouvrir' : 'Terminer';

    const checked = task.status === 'done';

    return `
      <li class="task" data-id="${task.id}" aria-label="Tâche: ${escapeHtml(task.title)}">
        <div class="task__top">
          <div>
            <div class="task__title" style="${checked ? 'text-decoration: line-through; opacity: 0.72;' : ''}">
              ${escapeHtml(task.title)}
            </div>
            <div class="task__meta">
              ${priorityBadge}
              ${statusBadge}
              ${dueBadge}
            </div>
          </div>
        </div>

        <div class="task__actions">
          <button class="icon-btn" type="button" data-action="toggle" aria-pressed="${checked}">
            ${checked ? '↩︎ Re-ouvrir' : '✔ Terminer'}
          </button>
          <button class="icon-btn icon-btn--danger" type="button" data-action="delete">
            🗑 Supprimer
          </button>
        </div>
      </li>
    `;
  }

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, (c)=>{
      switch(c){
        case '&': return '&amp;';
        case '<': return '<';
        case '>': return '>';
        case '"': return '"';
        case "'": return '&#039;';
        default: return c;
      }
    });
  }

  function render(){
    renderStats();

    const visible = getVisibleTasks();
    if(el.taskCount){
      const count = visible.length;
      el.taskCount.textContent = `${count} tâche(s)`;
    }

    el.taskList.innerHTML = '';

    if(visible.length === 0){
      el.emptyState.hidden = false;
      return;
    }
    el.emptyState.hidden = true;

    const frag = document.createDocumentFragment();
    for(const task of visible){
      const li = document.createElement('div');
      li.innerHTML = taskItemTemplate(task).trim();
      const node = li.firstElementChild;
      if(!node) continue;
      frag.appendChild(node);
    }
    el.taskList.appendChild(frag);

    // Animations
    const items = Array.from(el.taskList.querySelectorAll('.task'));
    items.forEach((item, idx)=>{
      setTimeout(()=>animateEnter(item), idx*30);
    });
  }

  function setActiveFilter(filter){
    activeFilter = filter;
    for(const btn of el.filterButtons){
      const isActive = btn.dataset.filter === filter;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    }
    render();
  }

  async function handleToggle(taskId){
    const idx = tasks.findIndex(t=>t.id === taskId);
    if(idx === -1) return;
    tasks[idx].status = tasks[idx].status === 'done' ? 'todo' : 'done';
    save();
    render();
    setSrStatus(`Tâche mise à jour: ${tasks[idx].title}`);
  }

  async function handleDelete(taskId){
    const li = el.taskList.querySelector(`.task[data-id="${CSS.escape(taskId)}"]`);
    const task = tasks.find(t=>t.id === taskId);

    if(li){
      const finished = animateExit(li);
      tasks = tasks.filter(t=>t.id !== taskId);
      save();
      await finished.catch(()=>{});
      render();
    } else {
      tasks = tasks.filter(t=>t.id !== taskId);
      save();
      render();
    }

    if(task) setSrStatus(`Tâche supprimée: ${task.title}`);
  }

  function validateTitle(title){
    const t = title.trim();
    if(t.length === 0) return { ok: false, msg: 'Le titre ne peut pas être vide.' };
    if(t.length > 120) return { ok: false, msg: 'Titre trop long (max 120 caractères).' };
    return { ok: true, msg: '' };
  }

  function clearFormHelper(){
    setHelper('');
  }

  function getFormValues(){
    const title = el.taskInput.value;
    const priority = /** @type {Priority} */ (el.priorityInput.value);
    const dueDate = el.dateInput.value ? parseISODateToLocalInput(el.dateInput.value) : '';
    return { title, priority, dueDate };
  }

  function resetForm(){
    el.taskInput.value = '';
    el.priorityInput.value = 'low';
    el.dateInput.value = '';
  }

  function wireEvents(){
    el.taskForm.addEventListener('submit', (e)=>{
      e.preventDefault();
      clearFormHelper();

      const { title, priority, dueDate } = getFormValues();
      const v = validateTitle(title);
      if(!v.ok){
        setHelper(v.msg);
        return;
      }

      const task = {
        id: uid(),
        title: title.trim(),
        priority,
        dueDate: dueDate || '',
        status: 'todo',
        createdAt: Date.now(),
      };

      tasks.push(task);
      save();
      resetForm();

      // Small "shine" effect on submit
      el.addTaskBtn.animate([
        { transform: 'translateY(0)', filter: 'brightness(1)' },
        { transform: 'translateY(-1px)', filter: 'brightness(1.2)' },
        { transform: 'translateY(0)', filter: 'brightness(1)' },
      ], { duration: 260, easing: 'ease-out' });

      render();
      setSrStatus(`Tâche ajoutée: ${task.title}`);
    });

    el.clearCompletedBtn.addEventListener('click', async ()=>{
      const doneIds = tasks.filter(t=>t.status==='done').map(t=>t.id);
      if(doneIds.length === 0) return;

      // Animate removal quickly
      const nodes = doneIds
        .map(id => el.taskList.querySelector(`.task[data-id="${CSS.escape(id)}"]`))
        .filter(Boolean);

      await Promise.all(nodes.map(n=>animateExit(n)) ).catch(()=>{});

      tasks = tasks.filter(t=>t.status!=='done');
      save();
      render();
      setSrStatus('Tâches terminées effacées');
    });

    el.filterButtons.forEach((btn)=>{
      btn.addEventListener('click', ()=>{
        const filter = /** @type {'all'|'todo'|'done'} */ (btn.dataset.filter);
        if(filter) setActiveFilter(filter);
      });
    });

    el.taskList.addEventListener('click', async (e)=>{
      const btn = e.target instanceof Element ? e.target.closest('button[data-action]') : null;
      if(!btn) return;
      const taskEl = e.target instanceof Element ? e.target.closest('.task[data-id]') : null;
      if(!taskEl) return;

      const action = btn.getAttribute('data-action');
      const id = taskEl.getAttribute('data-id');
      if(!id || !action) return;

      if(action === 'toggle'){
        await handleToggle(id);
      } else if(action === 'delete'){
        await handleDelete(id);
      }
    });

    // Keyboard: quickly focus title on load
    window.addEventListener('load', ()=>{
      setTimeout(()=>{ el.taskInput?.focus?.(); }, 150);
    });

    // Improve accessibility for date input: keep within allowed format
    el.dateInput.addEventListener('change', ()=>{
      el.dateInput.value = parseISODateToLocalInput(el.dateInput.value);
    });
  }

  // Init
  function init(){
    load();
    // Normalize form select default if needed
    if(el.priorityInput && el.priorityInput.value !== 'low' && el.priorityInput.value !== 'medium' && el.priorityInput.value !== 'high'){
      el.priorityInput.value = 'low';
    }

    wireEvents();
    setActiveFilter('all');
    render();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

