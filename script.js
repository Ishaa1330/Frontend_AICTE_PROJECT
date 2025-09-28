

//  For Local storage 
function loadGoals() {
  return JSON.parse(localStorage.getItem("goals") || "[]");
}
function saveGoals(goals) {
  localStorage.setItem("goals", JSON.stringify(goals));
}

// DOM elements
const goalsEl = document.getElementById("goals");
const emptyState = document.getElementById("emptyState");
const newGoalBtn = document.getElementById("newGoalBtn");
const goalDialog = document.getElementById("goalDialog");
const goalForm = document.getElementById("goalForm");
const searchInput = document.getElementById("search");
const sortBy = document.getElementById("sortBy");
const filter = document.getElementById("filter");
const statGoals = document.getElementById("statGoals");
const statDone = document.getElementById("statDone");
const statTotal = document.getElementById("statTotal");
const overallProgress = document.getElementById("overallProgress");
const todayBadge = document.getElementById("todayBadge");
const timelineEl = document.getElementById("timeline");

// Templates
const goalTemplate = document.getElementById("goalTemplate");
const taskTemplate = document.getElementById("taskTemplate");

// Global state
let goals = loadGoals();

// Utils
function uid() {
  return Math.random().toString(36).substr(2, 9);
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

// Rendering goals
function renderGoals() {
  goalsEl.innerHTML = "";
  let list = [...goals];

  // Search
  const q = searchInput.value.toLowerCase();
  if (q) {
    list = list.filter(g =>
      g.title.toLowerCase().includes(q) ||
      (g.subject || "").toLowerCase().includes(q)
    );
  }

  // Filter
  if (filter.value === "completed")
    list = list.filter(g => g.completed);
  else if (filter.value === "active")
    list = list.filter(g => !g.completed);
  else if (filter.value === "overdue")
    list = list.filter(g => !g.completed && g.due < todayStr());

  // Sort
  if (sortBy.value === "due")
    list.sort((a,b) => a.due.localeCompare(b.due));
  else if (sortBy.value === "progress")
    list.sort((a,b) => progress(b)-progress(a));
  else if (sortBy.value === "created")
    list.sort((a,b) => (a.created||0) - (b.created||0));

  // Render
  list.forEach(goal => {
    const el = goalTemplate.content.cloneNode(true);
    el.querySelector(".title").textContent = goal.title;
    el.querySelector(".subject").textContent = goal.subject || "General";
    el.querySelector(".dates").textContent = `${formatDate(goal.start)} → ${formatDate(goal.due)}`;
    el.querySelector(".notes").textContent = goal.notes || "";
    el.querySelector(".hours").textContent = goal.hours || 0;
    el.querySelector(".reminder").textContent = goal.reminder ? new Date(goal.reminder).toLocaleString() : "—";

    const doneCount = goal.tasks.filter(t=>t.done).length;
    const totalTasks = goal.tasks.length;
    el.querySelector(".doneCount").textContent = doneCount;
    el.querySelector(".taskCount").textContent = totalTasks;
    el.querySelector(".bar").style.width = progress(goal) + "%";

    const chip = el.querySelector(".status");
    if (goal.completed) {
      chip.textContent = "Completed";
      chip.classList.add("done");
    } else if (goal.due < todayStr()) {
      chip.textContent = "Overdue";
      chip.classList.add("overdue");
    } else {
      chip.textContent = "Active";
    }

    const tasksEl = el.querySelector(".tasks");
    goal.tasks.forEach(task => {
      const t = taskTemplate.content.cloneNode(true);
      t.querySelector(".text").textContent = task.text;
      t.querySelector(".created").textContent = new Date(task.created).toLocaleString();
      const cb = t.querySelector(".toggle");
      cb.checked = task.done;
      cb.addEventListener("change", () => {
        task.done = cb.checked;
        saveGoals(goals);
        renderGoals();
      });
      t.querySelector(".remove").addEventListener("click", () => {
        goal.tasks = goal.tasks.filter(x=>x.id!==task.id);
        saveGoals(goals);
        renderGoals();
      });
      tasksEl.appendChild(t);
    });

    // Add task
    const addTaskForm = el.querySelector(".addTask");
    addTaskForm.addEventListener("submit", e => {
      e.preventDefault();
      const text = addTaskForm.task.value.trim();
      if (!text) return;
      goal.tasks.push({id:uid(), text, done:false, created:Date.now()});
      addTaskForm.task.value="";
      saveGoals(goals);
      renderGoals();
    });
    addTaskForm.querySelector("[data-action='complete']").addEventListener("click", () => {
      goal.completed = true;
      saveGoals(goals);
      renderGoals();
    });

    // Edit/delete
    el.querySelector(".edit").addEventListener("click", () => {
      openGoalDialog(goal);
    });
    el.querySelector(".delete").addEventListener("click", () => {
      if (confirm("Delete this goal?")) {
        goals = goals.filter(g=>g.id!==goal.id);
        saveGoals(goals);
        renderGoals();
      }
    });

    goalsEl.appendChild(el);
  });

  emptyState.style.display = list.length ? "none" : "block";
  updateStats();
  renderTimeline();
}

// Progress helper
function progress(goal) {
  if (goal.completed) return 100;
  if (!goal.tasks.length) return 0;
  return Math.round(100 * goal.tasks.filter(t=>t.done).length / goal.tasks.length);
}

// Stats
function updateStats() {
  statGoals.textContent = goals.length;
  statTotal.textContent = goals.reduce((a,g)=>a+g.tasks.length,0);
  statDone.textContent = goals.reduce((a,g)=>a+g.tasks.filter(t=>t.done).length,0);
  const totalTasks = parseInt(statTotal.textContent);
  const done = parseInt(statDone.textContent);
  overallProgress.style.width = totalTasks? (100*done/totalTasks)+"%" : "0%";
  todayBadge.textContent = "Today: " + formatDate(todayStr());
}

// Timeline rendering
function renderTimeline() {
  if (!goals.length) { timelineEl.innerHTML=""; return; }
  const dates = goals.flatMap(g => [g.start,g.due]);
  const minDate = new Date(Math.min(...dates.map(d=>+new Date(d))));
  const maxDate = new Date(Math.max(...dates.map(d=>+new Date(d))));
  const dayMs = 86400000;
  const spanDays = Math.ceil((maxDate-minDate)/dayMs)+1;

  let svg = `<svg viewBox=\"0 0 ${spanDays*20} 120\">`;
  const today = new Date(todayStr());
  const offset = (today-minDate)/dayMs*20;
  svg += `<line x1=\"${offset}\" y1=\"0\" x2=\"${offset}\" y2=\"120\" stroke=\"red\" stroke-dasharray=\"4\"/>`;
  goals.forEach((g,i) => {
    const startX = (new Date(g.start)-minDate)/dayMs*20;
    const endX = (new Date(g.due)-minDate)/dayMs*20;
    svg += `<rect x=\"${startX}\" y=\"${20+i*20}\" width=\"${endX-startX}\" height=\"10\" fill=\"#7c5cff\" />`;
    svg += `<text x=\"${startX}\" y=\"${15+i*20}\" font-size=\"10\">${g.title} (${progress(g)}%)</text>`;
  });
  svg += `</svg>`;
  timelineEl.innerHTML = svg;
}

// Dialog
function openGoalDialog(goal) {
  goalDialog.showModal();
  goalForm.reset();
  if (goal) {
    document.getElementById("dialogTitle").textContent = "Edit Goal";
    goalForm.title.value = goal.title;
    goalForm.subject.value = goal.subject;
    goalForm.start.value = goal.start;
    goalForm.due.value = goal.due;
    goalForm.hours.value = goal.hours;
    goalForm.notes.value = goal.notes;
    goalForm.reminder.value = goal.reminder;
    goalForm.id.value = goal.id;
  } else {
    document.getElementById("dialogTitle").textContent = "New Goal";
  }
}
goalForm.addEventListener("submit", e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(goalForm).entries());
  if (data.id) {
    const g = goals.find(g=>g.id===data.id);
    Object.assign(g,data);
  } else {
    data.id = uid();
    data.tasks = [];
    data.created = Date.now();
    data.completed = false;
    goals.push(data);
  }
  saveGoals(goals);
  goalDialog.close();
  renderGoals();
});
newGoalBtn.addEventListener("click", () => openGoalDialog());

// Search/filter/sort
searchInput.addEventListener("input", renderGoals);
sortBy.addEventListener("change", renderGoals);
filter.addEventListener("change", renderGoals);

// Init
renderGoals();
