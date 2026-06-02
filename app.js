// --- Constants & Config ---
const DEFAULT_WEIGHTS = {
  'Squat': 45,
  'Bench Press': 45,
  'Barbell Row': 65,
  'Overhead Press': 45,
  'Deadlift': 135
};

const EXERCISES_WORKOUT_A = ['Squat', 'Bench Press', 'Barbell Row'];
const EXERCISES_WORKOUT_B = ['Squat', 'Overhead Press', 'Deadlift'];

// --- State Management ---
let state = {
  users: ['Todd', 'Wife'],
  currentUser: 'Todd',
  workoutHistory: {}, // { username: [workoutObjects] }
  currentWeights: {},  // { username: { 'Squat': 45, ... } }
  activeWorkout: null, // { name: 'Workout A', date: string, startTime: number, exercises: [...] }
  restTimer: {
    duration: 180, // seconds (3 mins)
    timeLeft: 0,
    intervalId: null,
    running: false
  },
  settings: {
    theme: 'dark',          // 'dark' or 'light'
    timerEnabled: true,     // auto-trigger rest timer
    timerDuration: 180,     // duration in seconds
    unit: 'lb',             // 'lb' or 'kg'
    reminders: false
  },
  calendarDate: new Date(), // Date object for calendar view
  chartInstance: null       // Chart.js object reference
};

// --- Web Audio Synthesizer for Timer Gong ---
let audioCtx = null;
function playGongSound() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, audioCtx.currentTime); 
    osc.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 1.5); 
    
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2.0); 
    
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 2.0);
    
    const audioEl = document.getElementById('timer-sound');
    if (audioEl) {
      audioEl.currentTime = 0;
      audioEl.play().catch(e => console.log('Audio element play blocked. Synth succeeded.', e));
    }
  } catch (err) {
    console.error('Failed to play gong sound:', err);
  }
}

// --- Local Storage Helpers ---
function loadStateFromStorage() {
  const savedUsers = localStorage.getItem('sl_users');
  if (savedUsers) {
    state.users = JSON.parse(savedUsers);
  }
  
  const savedCurrentUser = localStorage.getItem('sl_current_user');
  if (savedCurrentUser && state.users.includes(savedCurrentUser)) {
    state.currentUser = savedCurrentUser;
  } else {
    state.currentUser = state.users[0] || 'Todd';
  }

  const savedHistory = localStorage.getItem('sl_history');
  if (savedHistory) {
    state.workoutHistory = JSON.parse(savedHistory);
  }

  const savedWeights = localStorage.getItem('sl_weights');
  if (savedWeights) {
    state.currentWeights = JSON.parse(savedWeights);
  }

  const savedSettings = localStorage.getItem('sl_settings');
  if (savedSettings) {
    state.settings = { ...state.settings, ...JSON.parse(savedSettings) };
  }

  // Ensure current user has defaults
  if (!state.workoutHistory[state.currentUser]) {
    state.workoutHistory[state.currentUser] = [];
  }
  if (!state.currentWeights[state.currentUser]) {
    state.currentWeights[state.currentUser] = { ...DEFAULT_WEIGHTS };
  }

  // Apply visual theme immediately
  applyTheme();
}

function saveStateToStorage() {
  localStorage.setItem('sl_users', JSON.stringify(state.users));
  localStorage.setItem('sl_current_user', state.currentUser);
  localStorage.setItem('sl_history', JSON.stringify(state.workoutHistory));
  localStorage.setItem('sl_weights', JSON.stringify(state.currentWeights));
  localStorage.setItem('sl_settings', JSON.stringify(state.settings));
}

// --- Theme Helper ---
function applyTheme() {
  if (state.settings.theme === 'light') {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
  }
}

// --- Unit Format Helper ---
function formatWeight(lbVal) {
  if (state.settings.unit === 'kg') {
    return `${Math.round(lbVal * 0.45359237)} kg`;
  }
  return `${lbVal} lb`;
}

// --- UI Helpers ---
function showView(viewId) {
  // Hide all main views
  document.querySelectorAll('.tab-content').forEach(view => {
    view.classList.add('hidden');
  });
  document.getElementById('view-profile-select').classList.add('hidden');

  // Activate tab buttons
  document.querySelectorAll('.nav-tab').forEach(tab => {
    if (tab.getAttribute('data-tab') === viewId) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Show selected view
  const targetView = document.getElementById(viewId);
  if (targetView) {
    targetView.classList.remove('hidden');
  }

  // Trigger charts rendering when entering progress view
  if (viewId === 'tab-progress') {
    renderProgressChart();
  }
}

// --- Timer Logic ---
function startRestTimer(seconds) {
  if (!state.settings.timerEnabled) return;
  
  stopRestTimer();
  
  // Show timer widget
  const timerWidget = document.getElementById('rest-timer-widget');
  timerWidget.classList.remove('hidden');

  state.restTimer.duration = seconds;
  state.restTimer.timeLeft = seconds;
  state.restTimer.running = true;

  updateTimerDisplay();

  state.restTimer.intervalId = setInterval(() => {
    state.restTimer.timeLeft--;
    updateTimerDisplay();

    if (state.restTimer.timeLeft <= 0) {
      stopRestTimer();
      playGongSound();
      setTimeout(() => {
        if (!state.restTimer.running) {
          document.getElementById('rest-timer-widget').classList.add('hidden');
        }
      }, 5000);
    }
  }, 1000);
}

function stopRestTimer() {
  if (state.restTimer.intervalId) {
    clearInterval(state.restTimer.intervalId);
    state.restTimer.intervalId = null;
  }
  state.restTimer.running = false;
  state.restTimer.timeLeft = 0;
}

function updateTimerDisplay() {
  const display = document.getElementById('timer-display');
  const ring = document.getElementById('timer-progress-ring');
  
  const minutes = Math.floor(state.restTimer.timeLeft / 60);
  const seconds = state.restTimer.timeLeft % 60;
  
  display.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const radius = ring.r.baseVal.value;
  const circumference = radius * 2 * Math.PI;
  ring.style.strokeDasharray = `${circumference} ${circumference}`;
  
  const progress = state.restTimer.timeLeft / state.restTimer.duration;
  const offset = circumference - (progress * circumference);
  ring.style.strokeDashoffset = offset;
}

// --- Active Workout Logic ---
function initWorkout(workoutName) {
  const dateObj = new Date();
  const exercisesList = workoutName === 'Workout A' ? EXERCISES_WORKOUT_A : EXERCISES_WORKOUT_B;
  const userWeights = state.currentWeights[state.currentUser];

  state.activeWorkout = {
    name: workoutName,
    date: dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    isoDate: dateObj.toISOString().split('T')[0],
    startTime: Date.now(),
    exercises: exercisesList.map(name => {
      const isDeadlift = name === 'Deadlift';
      const setsCount = isDeadlift ? 1 : 5;
      return {
        name: name,
        weight: userWeights[name] || DEFAULT_WEIGHTS[name],
        setsCount: setsCount,
        sets: Array(setsCount).fill(null)
      };
    })
  };

  document.getElementById('active-workout-title').textContent = workoutName;
  document.getElementById('active-workout-date').textContent = state.activeWorkout.date;
  
  renderActiveExercises();
  
  document.getElementById('workout-setup-panel').classList.add('hidden');
  document.getElementById('active-workout-panel').classList.remove('hidden');
}

function renderActiveExercises() {
  const listEl = document.getElementById('exercises-list');
  listEl.innerHTML = '';

  state.activeWorkout.exercises.forEach((exercise, exIndex) => {
    const card = document.createElement('div');
    card.className = 'exercise-card';

    const header = document.createElement('div');
    header.className = 'exercise-info';

    const left = document.createElement('div');
    left.innerHTML = `
      <div class="exercise-title">${exercise.name}</div>
      <div class="exercise-scheme">${exercise.setsCount}x5</div>
    `;

    const right = document.createElement('div');
    right.className = 'weight-controller';
    right.innerHTML = `
      <button class="weight-btn" onclick="adjustWeight(${exIndex}, -5)">-5</button>
      <span class="weight-value">${formatWeight(exercise.weight)}</span>
      <button class="weight-btn" onclick="adjustWeight(${exIndex}, 5)">+5</button>
    `;

    header.appendChild(left);
    header.appendChild(right);
    card.appendChild(header);

    const setsRow = document.createElement('div');
    setsRow.className = 'sets-row';

    exercise.sets.forEach((repCount, setIndex) => {
      const circle = document.createElement('div');
      circle.className = 'set-circle';
      if (repCount === 5) {
        circle.classList.add('completed');
      } else if (repCount !== null && repCount < 5) {
        circle.classList.add('failed');
      }
      circle.textContent = repCount === null ? '' : repCount;
      circle.addEventListener('click', () => {
        cycleRepCount(exIndex, setIndex);
      });

      setsRow.appendChild(circle);
    });

    card.appendChild(setsRow);
    listEl.appendChild(card);
  });
}

window.adjustWeight = function(exIndex, delta) {
  if (!state.activeWorkout) return;
  state.activeWorkout.exercises[exIndex].weight = Math.max(0, state.activeWorkout.exercises[exIndex].weight + delta);
  renderActiveExercises();
};

function cycleRepCount(exIndex, setIndex) {
  if (!state.activeWorkout) return;
  const current = state.activeWorkout.exercises[exIndex].sets[setIndex];
  let next = null;

  if (current === null) next = 5;
  else if (current === 5) next = 4;
  else if (current === 4) next = 3;
  else if (current === 3) next = 2;
  else if (current === 2) next = 1;
  else if (current === 1) next = 0;
  else next = null;

  state.activeWorkout.exercises[exIndex].sets[setIndex] = next;
  renderActiveExercises();

  if (next !== null) {
    startRestTimer(state.settings.timerDuration);
  }
}

// --- History Sync & Progression ---
function finishWorkout() {
  if (!state.activeWorkout) return;

  const durationHours = ((Date.now() - state.activeWorkout.startTime) / 3600000).toFixed(2);
  const workoutObj = {
    date: state.activeWorkout.isoDate,
    workoutName: state.activeWorkout.name,
    duration: durationHours,
    exercises: state.activeWorkout.exercises.map(ex => {
      const allSetsSuccessful = ex.sets.every(r => r === 5);
      
      if (allSetsSuccessful) {
        const increment = ex.name === 'Deadlift' ? 10 : 5;
        state.currentWeights[state.currentUser][ex.name] = (state.currentWeights[state.currentUser][ex.name] || DEFAULT_WEIGHTS[ex.name]) + increment;
      }

      return {
        name: ex.name,
        weight: ex.weight,
        sets: [...ex.sets]
      };
    })
  };

  state.workoutHistory[state.currentUser].push(workoutObj);
  state.workoutHistory[state.currentUser].sort((a, b) => new Date(b.date) - new Date(a.date));

  saveStateToStorage();
  state.activeWorkout = null;
  stopRestTimer();
  document.getElementById('rest-timer-widget').classList.add('hidden');

  document.getElementById('workout-setup-panel').classList.remove('hidden');
  document.getElementById('active-workout-panel').classList.add('hidden');
  
  updateWorkoutSuggestion();
  renderHistory();
  renderCalendar();
  showView('tab-history');
}

function cancelActiveWorkout() {
  if (confirm("Are you sure you want to cancel this workout? All current progress will be lost.")) {
    state.activeWorkout = null;
    stopRestTimer();
    document.getElementById('rest-timer-widget').classList.add('hidden');
    document.getElementById('workout-setup-panel').classList.remove('hidden');
    document.getElementById('active-workout-panel').classList.add('hidden');
  }
}

function updateWorkoutSuggestion() {
  const history = state.workoutHistory[state.currentUser] || [];
  const suggestionText = document.getElementById('workout-suggestion-text');
  
  if (history.length === 0) {
    suggestionText.textContent = "Suggested today: Workout A (Start your program!)";
    return;
  }

  const lastWorkout = history[0];
  if (lastWorkout.workoutName === 'Workout A') {
    suggestionText.textContent = "Suggested today: Workout B";
  } else {
    suggestionText.textContent = "Suggested today: Workout A";
  }
}

// --- History List rendering ---
function renderHistory() {
  const container = document.getElementById('history-list');
  const statsOverview = document.getElementById('stats-overview');
  const history = state.workoutHistory[state.currentUser] || [];

  container.innerHTML = '';
  
  if (history.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 20px; color:var(--text-secondary);">No workouts logged yet. Upload a CSV inside Settings to import logs!</div>`;
    statsOverview.innerHTML = '';
    return;
  }

  const totalWorkouts = history.length;
  let totalVolume = 0;
  let maxSquat = 0;

  history.forEach(w => {
    w.exercises.forEach(ex => {
      if (ex.name === 'Squat' && ex.weight > maxSquat) {
        maxSquat = ex.weight;
      }
      ex.sets.forEach(reps => {
        if (reps && reps > 0) {
          totalVolume += (ex.weight * reps);
        }
      });
    });
  });

  statsOverview.innerHTML = `
    <div class="stat-item">
      <div class="stat-label">Workouts</div>
      <div class="stat-value">${totalWorkouts}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Max Squat</div>
      <div class="stat-value">${formatWeight(maxSquat)}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Est. Volume</div>
      <div class="stat-value">${formatWeight(Math.round(totalVolume))}</div>
    </div>
  `;

  history.forEach(workout => {
    const item = document.createElement('div');
    item.className = 'history-item';

    const header = document.createElement('div');
    header.className = 'history-item-header';
    
    const formattedDate = new Date(workout.date + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });

    header.innerHTML = `
      <span class="history-item-date">${formattedDate}</span>
      <span class="history-item-name">${workout.workoutName}</span>
    `;
    item.appendChild(header);

    const list = document.createElement('div');
    list.className = 'history-exercises-list';

    workout.exercises.forEach(ex => {
      const exEl = document.createElement('div');
      exEl.className = 'history-exercise';

      const repsStr = ex.sets.map(r => r === null ? '-' : r).join('-');

      exEl.innerHTML = `
        <span class="history-ex-name">${ex.name}</span>
        <span class="history-ex-sets">${formatWeight(ex.weight)} × ${repsStr}</span>
      `;
      list.appendChild(exEl);
    });

    item.appendChild(list);
    container.appendChild(item);
  });
}

// --- Calendar Logic ---
function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  const monthTitle = document.getElementById('cal-month-title');
  const history = state.workoutHistory[state.currentUser] || [];

  grid.innerHTML = '';
  
  const year = state.calendarDate.getFullYear();
  const month = state.calendarDate.getMonth();
  
  monthTitle.textContent = state.calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDayIndex; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'calendar-day empty';
    grid.appendChild(emptyCell);
  }

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  for (let day = 1; day <= totalDays; day++) {
    const dayCell = document.createElement('div');
    dayCell.className = 'calendar-day';
    
    const isoDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const workoutsToday = history.filter(w => w.date === isoDateStr);
    
    if (workoutsToday.length > 0) {
      dayCell.classList.add('workout-day');
      dayCell.innerHTML = `<span>${day}</span><div class="day-marker"></div>`;
      dayCell.addEventListener('click', () => {
        showCalendarDayDetail(isoDateStr, workoutsToday);
      });
    } else {
      dayCell.innerHTML = `<span>${day}</span>`;
      dayCell.addEventListener('click', () => {
        document.getElementById('calendar-detail-panel').classList.add('hidden');
      });
    }

    if (isCurrentMonth && today.getDate() === day) {
      dayCell.classList.add('today');
    }

    grid.appendChild(dayCell);
  }
}

function showCalendarDayDetail(dateStr, workouts) {
  const panel = document.getElementById('calendar-detail-panel');
  const content = document.getElementById('calendar-detail-content');
  panel.classList.remove('hidden');

  const formattedDate = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  let html = `<h4 style="margin-bottom:10px; color:var(--primary-color);">${formattedDate}</h4>`;
  workouts.forEach(w => {
    html += `
      <div style="margin-bottom:12px; border-bottom:1px solid rgba(120,120,120,0.15); padding-bottom:10px;">
        <h5 style="font-size:1rem; margin-bottom:6px;">${w.workoutName}</h5>
    `;
    w.exercises.forEach(ex => {
      const setsStr = ex.sets.map(s => s === null ? '-' : s).join('-');
      html += `
        <div style="display:flex; justify-content:space-between; font-size:0.9rem; color:var(--text-secondary); margin-bottom:3px;">
          <span>${ex.name}</span>
          <span>${formatWeight(ex.weight)} &times; ${setsStr}</span>
        </div>
      `;
    });
    html += `</div>`;
  });

  content.innerHTML = html;
}

// --- Chart.js Rendering Logic ---
function renderProgressChart() {
  const history = state.workoutHistory[state.currentUser] || [];
  const exercise = document.getElementById('progress-exercise-select').value;
  const timeframe = document.querySelector('#timeframe-filters .filter-pill.active').getAttribute('data-timeframe');
  const metric = document.querySelector('input[name="metric"]:checked').value;

  const canvas = document.getElementById('progress-chart');
  if (!canvas) return;

  // Clean old chart instance
  if (state.chartInstance) {
    state.chartInstance.destroy();
    state.chartInstance = null;
  }

  if (history.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '14px Outfit';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';
    ctx.fillText('No history data to draw chart.', canvas.width / 2, canvas.height / 2);
    return;
  }

  // Filter history by timeframe
  const now = new Date();
  let boundaryDate = new Date();
  
  if (timeframe === '1m') boundaryDate.setMonth(now.getMonth() - 1);
  else if (timeframe === '3m') boundaryDate.setMonth(now.getMonth() - 3);
  else if (timeframe === '6m') boundaryDate.setMonth(now.getMonth() - 6);
  else if (timeframe === '1y') boundaryDate.setFullYear(now.getFullYear() - 1);
  else if (timeframe === '2y') boundaryDate.setFullYear(now.getFullYear() - 2);
  else boundaryDate = new Date(0); // All time / max

  // Collect data points chronologically (oldest to newest)
  const chartPoints = [];
  
  // Sort workouts oldest first for graph
  const chronologicalHistory = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));

  chronologicalHistory.forEach(w => {
    const wDate = new Date(w.date + 'T00:00:00');
    if (wDate < boundaryDate) return;

    const matchedEx = w.exercises.find(ex => ex.name === exercise);
    if (!matchedEx) return;

    let value = 0;
    let rawWeight = matchedEx.weight;

    // Convert weights if set to kgs
    let displayedWeight = rawWeight;
    if (state.settings.unit === 'kg') {
      displayedWeight = Math.round(rawWeight * 0.45359237);
    }

    if (metric === 'weight') {
      value = displayedWeight;
    } else if (metric === 'e1rm') {
      // Find top/max reps set
      const maxReps = Math.max(...matchedEx.sets.filter(r => r !== null), 0);
      if (maxReps > 0) {
        // formula: weight * (1 + reps/30)
        value = Math.round(displayedWeight * (1 + maxReps / 30));
      } else {
        value = displayedWeight;
      }
    } else if (metric === 'volume') {
      const totalReps = matchedEx.sets.reduce((sum, r) => sum + (r || 0), 0);
      value = displayedWeight * totalReps;
    } else if (metric === 'reps') {
      value = matchedEx.sets.reduce((sum, r) => sum + (r || 0), 0);
    }

    chartPoints.push({
      date: wDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }),
      val: value
    });
  });

  const ctx = canvas.getContext('2d');
  
  if (chartPoints.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '14px Outfit';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';
    ctx.fillText(`No records for ${exercise} in this timeframe.`, canvas.width / 2, canvas.height / 2);
    return;
  }

  // Draw chart using Chart.js
  const primaryAccent = state.settings.theme === 'light' ? '#00e676' : '#00e676';
  const labelColor = state.settings.theme === 'light' ? '#4b5563' : '#9ca3af';
  const gridColor = state.settings.theme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';

  state.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartPoints.map(p => p.date),
      datasets: [{
        label: `${exercise} - ${metric.toUpperCase()} (${state.settings.unit === 'kg' && metric !== 'reps' ? 'kg' : metric === 'reps' ? 'count' : 'lb'})`,
        data: chartPoints.map(p => p.val),
        borderColor: primaryAccent,
        backgroundColor: 'rgba(0, 230, 118, 0.08)',
        fill: true,
        tension: 0.35,
        borderWidth: 3,
        pointBackgroundColor: primaryAccent,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: state.settings.theme === 'light' ? '#ffffff' : '#111827',
          titleColor: state.settings.theme === 'light' ? '#111827' : '#ffffff',
          bodyColor: state.settings.theme === 'light' ? '#111827' : '#ffffff',
          borderColor: 'rgba(120,120,120,0.15)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: {
            color: gridColor
          },
          ticks: {
            color: labelColor,
            font: {
              family: 'Outfit'
            }
          }
        },
        y: {
          grid: {
            color: gridColor
          },
          ticks: {
            color: labelColor,
            font: {
              family: 'Outfit'
            }
          }
        }
      }
    }
  });
}

// --- Profile Switching ---
function renderProfileSelector() {
  const grid = document.getElementById('profiles-grid');
  grid.innerHTML = '';

  state.users.forEach(username => {
    const card = document.createElement('div');
    card.className = `profile-card ${state.currentUser === username ? 'active' : ''}`;
    card.innerHTML = `
      <span class="avatar">👤</span>
      <span class="name">${username}</span>
    `;

    card.addEventListener('click', () => {
      state.currentUser = username;
      if (!state.workoutHistory[state.currentUser]) {
        state.workoutHistory[state.currentUser] = [];
      }
      if (!state.currentWeights[state.currentUser]) {
        state.currentWeights[state.currentUser] = { ...DEFAULT_WEIGHTS };
      }
      
      saveStateToStorage();
      document.getElementById('current-user-name').textContent = username;
      
      updateWorkoutSuggestion();
      renderHistory();
      renderCalendar();
      
      document.getElementById('view-profile-select').classList.add('hidden');
      document.getElementById('tab-workout').classList.remove('hidden');
    });

    grid.appendChild(card);
  });
}

// --- CSV Parser & Importer ---
let parsedWorkoutsToImport = [];

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function handleCSVImport(fileText) {
  const lines = fileText.split(/\r?\n/);
  if (lines.length < 2) {
    alert("Empty or invalid CSV file.");
    return;
  }

  const header = parseCSVLine(lines[0]);
  const dateIndex = header.findIndex(h => h.toLowerCase().includes('date'));
  const workoutNameIndex = header.findIndex(h => h.toLowerCase().includes('workout name'));
  const exerciseIndex = header.findIndex(h => h.toLowerCase().includes('exercise'));
  const durationIndex = header.findIndex(h => h.toLowerCase().includes('duration'));
  
  const setScoreIndices = [];
  for (let s = 1; s <= 5; s++) {
    const idxReps = header.findIndex(h => h.toLowerCase().includes(`set ${s} (reps)`));
    const idxLBS = header.findIndex(h => h.toLowerCase().includes(`set ${s} (lbs)`));
    setScoreIndices.push({ reps: idxReps, lbs: idxLBS });
  }

  if (dateIndex === -1 || workoutNameIndex === -1 || exerciseIndex === -1) {
    alert("Invalid CSV format. Missing essential columns like Date, Workout Name, or Exercise.");
    return;
  }

  const workoutsMap = {}; 

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const row = parseCSVLine(line);
    if (row.length < header.length) continue;

    let rawDate = row[dateIndex];
    let isoDate = rawDate.replace(/\//g, '-');
    const dateParts = isoDate.split('-');
    if (dateParts.length === 3) {
      isoDate = `${dateParts[0]}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`;
    }

    const workoutName = row[workoutNameIndex] || 'Workout A';
    const exerciseName = row[exerciseIndex];
    const duration = row[durationIndex] || "1";

    const key = `${isoDate}_${workoutName}`;
    if (!workoutsMap[key]) {
      workoutsMap[key] = {
        date: isoDate,
        workoutName: workoutName,
        duration: duration,
        exercises: []
      };
    }

    const sets = [];
    let exerciseWeight = 45;

    setScoreIndices.forEach(setIdxs => {
      const repsVal = row[setIdxs.reps];
      const lbsVal = row[setIdxs.lbs];

      if (repsVal !== undefined && repsVal !== '') {
        sets.push(parseInt(repsVal, 10));
      }
      if (lbsVal !== undefined && lbsVal !== '' && parseInt(lbsVal, 10) > 0) {
        exerciseWeight = parseInt(lbsVal, 10);
      }
    });

    const targetSetsCount = exerciseName === 'Deadlift' ? 1 : 5;
    while (sets.length < targetSetsCount) {
      sets.push(null);
    }
    if (sets.length > targetSetsCount) {
      sets.length = targetSetsCount;
    }

    workoutsMap[key].exercises.push({
      name: exerciseName,
      weight: exerciseWeight,
      sets: sets
    });
  }

  parsedWorkoutsToImport = Object.values(workoutsMap);
  parsedWorkoutsToImport.sort((a, b) => new Date(a.date) - new Date(b.date));

  document.getElementById('import-status-text').textContent = `Parsed ${parsedWorkoutsToImport.length} workouts from CSV file. Press confirm below to import into ${state.currentUser}'s history.`;
  document.getElementById('import-preview').classList.remove('hidden');
}

function executeImport() {
  if (parsedWorkoutsToImport.length === 0) return;

  if (!state.workoutHistory[state.currentUser]) {
    state.workoutHistory[state.currentUser] = [];
  }

  const existingDates = new Set(state.workoutHistory[state.currentUser].map(w => w.date));
  let importedCount = 0;
  let skippedCount = 0;

  parsedWorkoutsToImport.forEach(w => {
    if (!existingDates.has(w.date)) {
      state.workoutHistory[state.currentUser].push(w);
      importedCount++;
    } else {
      skippedCount++;
    }
  });

  state.workoutHistory[state.currentUser].sort((a, b) => new Date(b.date) - new Date(a.date));

  const lastWorkouts = [...state.workoutHistory[state.currentUser]];
  const exerciseFound = new Set();
  
  for (const workout of lastWorkouts) {
    workout.exercises.forEach(ex => {
      if (!exerciseFound.has(ex.name)) {
        state.currentWeights[state.currentUser][ex.name] = ex.weight;
        exerciseFound.add(ex.name);
      }
    });
    if (exerciseFound.size >= 5) break;
  }

  saveStateToStorage();
  
  alert(`Import complete! Loaded ${importedCount} workouts. Skipped ${skippedCount} duplicate dates.`);
  
  parsedWorkoutsToImport = [];
  document.getElementById('import-preview').classList.add('hidden');
  document.getElementById('csv-file-input').value = '';
  
  updateWorkoutSuggestion();
  renderHistory();
  renderCalendar();
  showView('tab-history');
}

// --- Event Listeners Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  loadStateFromStorage();
  
  document.getElementById('current-user-name').textContent = state.currentUser;

  // Apply inputs defaults based on loaded settings
  document.getElementById('setting-timer-toggle').checked = state.settings.timerEnabled;
  document.getElementById('setting-timer-duration').value = state.settings.timerDuration;
  document.getElementById('setting-reminder-toggle').checked = state.settings.reminders;
  
  // Highlight unit select button
  if (state.settings.unit === 'kg') {
    document.getElementById('unit-kg-btn').classList.add('active');
    document.getElementById('unit-lb-btn').classList.remove('active');
  } else {
    document.getElementById('unit-lb-btn').classList.add('active');
    document.getElementById('unit-kg-btn').classList.remove('active');
  }

  // Navigation tab switcher
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      showView(tabId);
    });
  });

  // Switch User Dialog toggle
  document.getElementById('btn-switch-user').addEventListener('click', () => {
    renderProfileSelector();
    document.querySelectorAll('.tab-content').forEach(view => view.classList.add('hidden'));
    document.getElementById('view-profile-select').classList.remove('hidden');
  });

  // New Profile Creator
  document.getElementById('btn-create-user').addEventListener('click', () => {
    const input = document.getElementById('new-user-input');
    const name = input.value.trim();
    if (name) {
      if (state.users.includes(name)) {
        alert("Profile already exists.");
        return;
      }
      state.users.push(name);
      state.workoutHistory[name] = [];
      state.currentWeights[name] = { ...DEFAULT_WEIGHTS };
      
      saveStateToStorage();
      input.value = '';
      renderProfileSelector();
    }
  });

  // Start Workout buttons
  document.getElementById('btn-choose-a').addEventListener('click', () => initWorkout('Workout A'));
  document.getElementById('btn-choose-b').addEventListener('click', () => initWorkout('Workout B'));
  
  document.getElementById('btn-finish-workout').addEventListener('click', finishWorkout);
  document.getElementById('btn-cancel-workout').addEventListener('click', cancelActiveWorkout);

  // Timer Widget events
  document.getElementById('timer-btn-skip').addEventListener('click', () => {
    stopRestTimer();
    document.getElementById('rest-timer-widget').classList.add('hidden');
  });
  document.getElementById('timer-btn-plus').addEventListener('click', () => {
    if (state.restTimer.running) {
      state.restTimer.timeLeft = Math.min(600, state.restTimer.timeLeft + 30);
      updateTimerDisplay();
    }
  });
  document.getElementById('timer-btn-minus').addEventListener('click', () => {
    if (state.restTimer.running) {
      state.restTimer.timeLeft = Math.max(0, state.restTimer.timeLeft - 30);
      updateTimerDisplay();
    }
  });

  // Calendar controls
  document.getElementById('cal-prev-month').addEventListener('click', () => {
    state.calendarDate.setMonth(state.calendarDate.getMonth() - 1);
    renderCalendar();
    document.getElementById('calendar-detail-panel').classList.add('hidden');
  });
  document.getElementById('cal-next-month').addEventListener('click', () => {
    state.calendarDate.setMonth(state.calendarDate.getMonth() + 1);
    renderCalendar();
    document.getElementById('calendar-detail-panel').classList.add('hidden');
  });

  // Progress Tab filters
  document.getElementById('progress-exercise-select').addEventListener('change', renderProgressChart);
  
  document.querySelectorAll('#timeframe-filters .filter-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      document.querySelectorAll('#timeframe-filters .filter-pill').forEach(p => p.classList.remove('active'));
      e.target.classList.add('active');
      renderProgressChart();
    });
  });

  document.querySelectorAll('input[name="metric"]').forEach(radio => {
    radio.addEventListener('change', renderProgressChart);
  });

  // Settings Actions
  document.getElementById('btn-toggle-theme').addEventListener('click', () => {
    state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light';
    applyTheme();
    saveStateToStorage();
    if (document.getElementById('tab-progress').classList.contains('active') === false) {
      // redraw if on progress tab to refresh colors
    } else {
      renderProgressChart();
    }
  });

  document.getElementById('setting-timer-toggle').addEventListener('change', (e) => {
    state.settings.timerEnabled = e.target.checked;
    saveStateToStorage();
  });

  document.getElementById('setting-timer-duration').addEventListener('change', (e) => {
    state.settings.timerDuration = parseInt(e.target.value, 10);
    saveStateToStorage();
  });

  document.getElementById('setting-reminder-toggle').addEventListener('change', (e) => {
    state.settings.reminders = e.target.checked;
    saveStateToStorage();
  });

  document.getElementById('unit-lb-btn').addEventListener('click', () => {
    state.settings.unit = 'lb';
    document.getElementById('unit-lb-btn').classList.add('active');
    document.getElementById('unit-kg-btn').classList.remove('active');
    saveStateToStorage();
    renderHistory();
    renderCalendar();
  });

  document.getElementById('unit-kg-btn').addEventListener('click', () => {
    state.settings.unit = 'kg';
    document.getElementById('unit-kg-btn').classList.add('active');
    document.getElementById('unit-lb-btn').classList.remove('active');
    saveStateToStorage();
    renderHistory();
    renderCalendar();
  });

  document.getElementById('btn-pwa-install').addEventListener('click', () => {
    alert("To install as a Home Screen App/Shortcut:\n\n🍏 iOS (Safari): Tap the Share button (square with arrow up) -> scroll down and select 'Add to Home Screen'.\n\n🤖 Android (Chrome): Tap the menu (three dots) -> select 'Install app' or 'Add to Home Screen'.");
  });

  // CSV Drag and drop zone bindings
  const dropZone = document.getElementById('csv-drop-zone');
  const fileInput = document.getElementById('csv-file-input');

  dropZone.addEventListener('click', () => fileInput.click());
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      readFileAndProcess(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      readFileAndProcess(e.target.files[0]);
    }
  });

  function readFileAndProcess(file) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      handleCSVImport(evt.target.result);
    };
    reader.readAsText(file);
  }

  document.getElementById('btn-confirm-import').addEventListener('click', executeImport);

  // Initial runs
  updateWorkoutSuggestion();
  renderHistory();
  renderCalendar();
});
