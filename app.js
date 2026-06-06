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

// --- Plate Constants ---
const PLATES_LBS = [45, 35, 25, 10, 5, 2.5];
const PLATES_KGS = [25, 20, 15, 10, 5, 2.5, 1.25];

// --- Supabase Hardcoded Credentials ---
const SUPABASE_URL = 'https://refpjxitosabqrdrtqjt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3fXKJI7m5X02cm_ifexcZQ_m3skroXF';

// --- State Management ---
let state = {
  workoutHistory: [], // [workoutObjects]
  currentWeights: { ...DEFAULT_WEIGHTS },
  activeWorkout: null, // { name: 'Workout A', date: string, startTime: number, exercises: [...] }
  restTimer: {
    duration: 180,
    timeLeft: 0,
    intervalId: null,
    running: false
  },
  settings: {
    theme: 'dark',
    timerEnabled: true,
    timerDuration: 180,
    unit: 'lb',
    reminders: false
  },
  calendarDate: new Date(),
  chartInstance: null,
  supabaseClient: null,
  currentUserSession: null
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
      audioEl.play().catch(e => console.log('Audio element play blocked.', e));
    }
  } catch (err) {
    console.error('Failed to play gong sound:', err);
  }
}

// --- Local Storage Helpers ---
function loadStateFromStorage() {
  const savedHistory = localStorage.getItem('al_history');
  if (savedHistory) {
    state.workoutHistory = JSON.parse(savedHistory);
  }

  const savedWeights = localStorage.getItem('al_weights');
  if (savedWeights) {
    state.currentWeights = JSON.parse(savedWeights);
  }

  const savedSettings = localStorage.getItem('al_settings');
  if (savedSettings) {
    state.settings = { ...state.settings, ...JSON.parse(savedSettings) };
  }

  applyTheme();
}

function saveStateToStorage() {
  localStorage.setItem('al_history', JSON.stringify(state.workoutHistory));
  localStorage.setItem('al_weights', JSON.stringify(state.currentWeights));
  localStorage.setItem('al_settings', JSON.stringify(state.settings));
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

// --- Unit Convert & Format Helper ---
function formatWeight(val) {
  return `${val} ${state.settings.unit}`;
}

function convertStateWeights(targetUnit) {
  for (const ex in state.currentWeights) {
    let val = state.currentWeights[ex];
    if (targetUnit === 'kg') {
      state.currentWeights[ex] = Math.round((val * 0.45359237) / 2.5) * 2.5;
    } else {
      state.currentWeights[ex] = Math.round((val / 0.45359237) / 5) * 5;
    }
  }

  state.workoutHistory.forEach(workout => {
    workout.exercises.forEach(ex => {
      let val = ex.weight;
      if (targetUnit === 'kg') {
        ex.weight = Math.round((val * 0.45359237) / 2.5) * 2.5;
      } else {
        ex.weight = Math.round((val / 0.45359237) / 5) * 5;
      }
    });
  });

  saveStateToStorage();
}

// --- UI Helpers ---
function showView(viewId) {
  document.querySelectorAll('.tab-content').forEach(view => {
    view.classList.add('hidden');
  });

  document.querySelectorAll('.nav-tab').forEach(tab => {
    if (tab.getAttribute('data-tab') === viewId) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  const targetView = document.getElementById(viewId);
  if (targetView) {
    targetView.classList.remove('hidden');
  }

  if (viewId === 'tab-progress') {
    renderProgressChart();
  }
}

// --- Timer Logic ---
function startRestTimer(seconds) {
  if (!state.settings.timerEnabled) return;
  
  stopRestTimer();
  
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
        weight: state.currentWeights[name] || DEFAULT_WEIGHTS[name],
        setsCount: setsCount,
        sets: Array(setsCount).fill(null),
        isWarmupMode: false,
        showPlateCalculator: false,
        warmupSets: []
      };
    })
  };

  document.getElementById('active-workout-title').textContent = workoutName;
  document.getElementById('active-workout-date').textContent = state.activeWorkout.date;
  
  renderActiveExercises();
  
  document.getElementById('workout-setup-panel').classList.add('hidden');
  document.getElementById('active-workout-panel').classList.remove('hidden');
}

// Barbell Plate Math
function getPlatesForWeight(weight) {
  const isLb = state.settings.unit === 'lb';
  const barWeight = isLb ? 45 : 20;
  const availablePlates = isLb ? PLATES_LBS : PLATES_KGS;

  if (weight <= barWeight) {
    return [];
  }

  let sideWeight = (weight - barWeight) / 2;
  const platesNeeded = [];

  for (const plate of availablePlates) {
    while (sideWeight >= plate) {
      platesNeeded.push(plate);
      sideWeight -= plate;
      if (sideWeight < 0.1) sideWeight = 0;
    }
  }

  return platesNeeded;
}

// Warmup Progression Math
function generateWarmups(exercise) {
  const isLb = state.settings.unit === 'lb';
  const barWeight = isLb ? 45 : 20;
  const targetWeight = exercise.weight;
  
  if (targetWeight <= barWeight) {
    return [{ weight: barWeight, reps: 5, completed: false }];
  }

  const steps = [];
  steps.push({ weight: barWeight, reps: 5, completed: false });
  steps.push({ weight: barWeight, reps: 5, completed: false });

  let w50 = targetWeight * 0.5;
  w50 = isLb ? Math.round(w50 / 5) * 5 : Math.round(w50 / 2.5) * 2.5;
  if (w50 > barWeight) {
    steps.push({ weight: Math.min(w50, targetWeight - 10), reps: 5, completed: false });
  }

  let w70 = targetWeight * 0.7;
  w70 = isLb ? Math.round(w70 / 5) * 5 : Math.round(w70 / 2.5) * 2.5;
  if (w70 > w50) {
    steps.push({ weight: Math.min(w70, targetWeight - 5), reps: 3, completed: false });
  }

  let w90 = targetWeight * 0.9;
  w90 = isLb ? Math.round(w90 / 5) * 5 : Math.round(w90 / 2.5) * 2.5;
  if (w90 > w70) {
    steps.push({ weight: Math.min(w90, targetWeight - 5), reps: 2, completed: false });
  }

  return steps;
}

function renderActiveExercises() {
  const listEl = document.getElementById('exercises-list');
  listEl.innerHTML = '';

  state.activeWorkout.exercises.forEach((exercise, exIndex) => {
    const card = document.createElement('div');
    card.className = 'exercise-card';

    const headerTop = document.createElement('div');
    headerTop.className = 'exercise-header-top';
    headerTop.innerHTML = `
      <div class="exercise-header-left">
        <div class="exercise-title">${exercise.name}</div>
        <div class="exercise-scheme">${exercise.isWarmupMode ? 'Warmup' : exercise.setsCount + 'x5 working'}</div>
      </div>
      <div class="exercise-header-right">
        <button class="btn-warmup-toggle ${exercise.isWarmupMode ? 'active' : ''}" onclick="toggleWarmupMode(${exIndex})">
          ${exercise.isWarmupMode ? 'Working Sets' : 'Warmups'}
        </button>
      </div>
    `;
    card.appendChild(headerTop);

    const controlsRow = document.createElement('div');
    controlsRow.className = 'exercise-header-top';
    
    controlsRow.innerHTML = `
      <div class="weight-controller">
        <button class="weight-btn" onclick="adjustWeight(${exIndex}, -5)">-</button>
        <span class="weight-value" onclick="togglePlateCalculator(${exIndex})" title="Click to view Plate Calculator">
          ${formatWeight(exercise.weight)}
        </span>
        <button class="weight-btn" onclick="adjustWeight(${exIndex}, 5)">+</button>
      </div>
      <span style="font-size: 0.75rem; color: var(--text-secondary);">Click weight for plates</span>
    `;
    card.appendChild(controlsRow);

    if (exercise.showPlateCalculator) {
      const plateCalc = document.createElement('div');
      plateCalc.className = 'plate-calculator-view';
      
      const plates = getPlatesForWeight(exercise.weight);
      let platesHTML = '';
      if (plates.length === 0) {
        platesHTML = `<span style="font-size:0.85rem; color:var(--text-secondary);">Barbell only (${state.settings.unit === 'kg' ? '20kg' : '45lb'})</span>`;
      } else {
        plates.forEach(p => {
          const classStr = String(p).replace('.', '-');
          platesHTML += `<div class="plate-badge p${classStr}">${p}</div>`;
        });
      }

      plateCalc.innerHTML = `
        <div class="plate-calc-title">Load on each side</div>
        <div class="plates-row">
          ${platesHTML}
        </div>
        <div class="barbell-indicator">Total Weight includes barbell.</div>
      `;
      card.appendChild(plateCalc);
    }

    const setsRow = document.createElement('div');
    setsRow.className = 'sets-row';

    if (exercise.isWarmupMode) {
      if (exercise.warmupSets.length === 0) {
        exercise.warmupSets = generateWarmups(exercise);
      }

      exercise.warmupSets.forEach((wset, wIndex) => {
        const circle = document.createElement('div');
        circle.className = 'set-circle';
        
        const formattedW = state.settings.unit === 'kg' ? `${wset.weight}k` : `${wset.weight}`;

        if (wset.completed) {
          circle.classList.add('completed');
          circle.textContent = wset.reps;
        } else {
          circle.style.fontSize = '0.75rem';
          circle.style.flexDirection = 'column';
          circle.innerHTML = `<span>${formattedW}</span><span style="font-size:0.6rem; opacity:0.7;">x${wset.reps}</span>`;
        }

        circle.addEventListener('click', () => {
          wset.completed = !wset.completed;
          renderActiveExercises();
          if (wset.completed) {
            startRestTimer(60);
          }
        });
        setsRow.appendChild(circle);
      });
    } else {
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
    }

    card.appendChild(setsRow);
    listEl.appendChild(card);
  });
}

window.adjustWeight = function(exIndex, baseDelta) {
  if (!state.activeWorkout) return;
  let actualDelta = baseDelta;
  if (state.settings.unit === 'kg') {
    actualDelta = baseDelta > 0 ? 2.5 : -2.5;
  }
  state.activeWorkout.exercises[exIndex].weight = Math.max(0, state.activeWorkout.exercises[exIndex].weight + actualDelta);
  if (state.activeWorkout.exercises[exIndex].isWarmupMode) {
    state.activeWorkout.exercises[exIndex].warmupSets = generateWarmups(state.activeWorkout.exercises[exIndex]);
  }
  renderActiveExercises();
};

window.toggleWarmupMode = function(exIndex) {
  if (!state.activeWorkout) return;
  const ex = state.activeWorkout.exercises[exIndex];
  ex.isWarmupMode = !ex.isWarmupMode;
  if (ex.isWarmupMode && ex.warmupSets.length === 0) {
    ex.warmupSets = generateWarmups(ex);
  }
  renderActiveExercises();
};

window.togglePlateCalculator = function(exIndex) {
  if (!state.activeWorkout) return;
  const ex = state.activeWorkout.exercises[exIndex];
  ex.showPlateCalculator = !ex.showPlateCalculator;
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
async function finishWorkout() {
  if (!state.activeWorkout) return;

  const durationHours = ((Date.now() - state.activeWorkout.startTime) / 3600000).toFixed(2);
  const workoutObj = {
    date: state.activeWorkout.isoDate,
    workoutName: state.activeWorkout.name,
    duration: durationHours,
    exercises: state.activeWorkout.exercises.map(ex => {
      const allSetsSuccessful = ex.sets.every(r => r === 5);
      
      if (allSetsSuccessful) {
        let increment = 5;
        if (state.settings.unit === 'kg') {
          increment = ex.name === 'Deadlift' ? 5 : 2.5;
        } else {
          increment = ex.name === 'Deadlift' ? 10 : 5;
        }
        state.currentWeights[ex.name] = (state.currentWeights[ex.name] || DEFAULT_WEIGHTS[ex.name]) + increment;
      }

      return {
        name: ex.name,
        weight: ex.weight,
        sets: [...ex.sets]
      };
    })
  };

  state.workoutHistory.push(workoutObj);
  state.workoutHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

  saveStateToStorage();
  
  if (state.supabaseClient && state.currentUserSession) {
    await syncWorkoutToCloud(workoutObj);
  }

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
  const history = state.workoutHistory || [];
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

// --- History List rendering & Deleting ---
window.deleteHistoryWorkout = async function(index) {
  if (confirm("Are you sure you want to delete this workout session? This cannot be undone.")) {
    const deletedWorkout = state.workoutHistory[index];
    state.workoutHistory.splice(index, 1);
    saveStateToStorage();
    
    if (state.supabaseClient && state.currentUserSession) {
      await state.supabaseClient
        .from('workouts')
        .delete()
        .eq('user_id', state.currentUserSession.user.id)
        .eq('date', deletedWorkout.date)
        .eq('workout_name', deletedWorkout.workoutName);
    }

    renderHistory();
    renderCalendar();
  }
};

function renderHistory() {
  const container = document.getElementById('history-list');
  const statsOverview = document.getElementById('stats-overview');
  const history = state.workoutHistory || [];

  container.innerHTML = '';
  
  if (history.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 20px; color:var(--text-secondary);">No workouts logged yet. Go to Settings to import your history CSV!</div>`;
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

  history.forEach((workout, index) => {
    const item = document.createElement('div');
    item.className = 'history-item';

    const header = document.createElement('div');
    header.className = 'history-item-header';
    
    const formattedDate = new Date(workout.date + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });

    header.innerHTML = `
      <span class="history-item-date">${formattedDate}</span>
      <div class="history-header-meta">
        <span class="history-item-name">${workout.workoutName}</span>
        <button class="history-delete-btn" onclick="deleteHistoryWorkout(${index})" title="Delete session">🗑️</button>
      </div>
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
  const history = state.workoutHistory || [];

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
  const history = state.workoutHistory || [];
  const exercise = document.getElementById('progress-exercise-select').value;
  const timeframe = document.querySelector('#timeframe-filters .filter-pill.active').getAttribute('data-timeframe');
  const metric = document.querySelector('input[name="metric"]:checked').value;

  const canvas = document.getElementById('progress-chart');
  if (!canvas) return;

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

  const now = new Date();
  let boundaryDate = new Date();
  
  if (timeframe === '1m') boundaryDate.setMonth(now.getMonth() - 1);
  else if (timeframe === '3m') boundaryDate.setMonth(now.getMonth() - 3);
  else if (timeframe === '6m') boundaryDate.setMonth(now.getMonth() - 6);
  else if (timeframe === '1y') boundaryDate.setFullYear(now.getFullYear() - 1);
  else if (timeframe === '2y') boundaryDate.setFullYear(now.getFullYear() - 2);
  else boundaryDate = new Date(0); 

  const chartPoints = [];
  const chronologicalHistory = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));

  chronologicalHistory.forEach(w => {
    const wDate = new Date(w.date + 'T00:00:00');
    if (wDate < boundaryDate) return;

    const matchedEx = w.exercises.find(ex => ex.name === exercise);
    if (!matchedEx) return;

    let value = 0;
    let displayedWeight = matchedEx.weight;

    if (metric === 'weight') {
      value = displayedWeight;
    } else if (metric === 'e1rm') {
      const maxReps = Math.max(...matchedEx.sets.filter(r => r !== null), 0);
      if (maxReps > 0) {
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

  const primaryAccent = '#00e676';
  const labelColor = state.settings.theme === 'light' ? '#4b5563' : '#9ca3af';
  const gridColor = state.settings.theme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';

  state.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartPoints.map(p => p.date),
      datasets: [{
        label: `${exercise} - ${metric.toUpperCase()}`,
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

  document.getElementById('import-status-text').textContent = `Parsed ${parsedWorkoutsToImport.length} workouts from CSV file. Press confirm below to import into your logs.`;
  document.getElementById('import-preview').classList.remove('hidden');
}

async function executeImport() {
  if (parsedWorkoutsToImport.length === 0) return;

  const existingDates = new Set(state.workoutHistory.map(w => w.date));
  let importedCount = 0;
  let skippedCount = 0;

  parsedWorkoutsToImport.forEach(w => {
    if (!existingDates.has(w.date)) {
      state.workoutHistory.push(w);
      importedCount++;
    } else {
      skippedCount++;
    }
  });

  state.workoutHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

  const lastWorkouts = [...state.workoutHistory];
  const exerciseFound = new Set();
  
  for (const workout of lastWorkouts) {
    workout.exercises.forEach(ex => {
      if (!exerciseFound.has(ex.name)) {
        state.currentWeights[ex.name] = ex.weight;
        exerciseFound.add(ex.name);
      }
    });
    if (exerciseFound.size >= 5) break;
  }

  if (state.settings.unit === 'kg') {
    state.workoutHistory.forEach(workout => {
      workout.exercises.forEach(ex => {
        ex.weight = Math.round((ex.weight * 0.45359237) / 2.5) * 2.5;
      });
    });
    for (const ex in state.currentWeights) {
      state.currentWeights[ex] = Math.round((state.currentWeights[ex] * 0.45359237) / 2.5) * 2.5;
    }
  }

  saveStateToStorage();

  if (state.supabaseClient && state.currentUserSession) {
    for (const workout of parsedWorkoutsToImport) {
      if (!existingDates.has(workout.date)) {
        await syncWorkoutToCloud(workout);
      }
    }
  }
  
  alert(`Import complete! Loaded ${importedCount} workouts. Skipped ${skippedCount} duplicate dates.`);
  
  parsedWorkoutsToImport = [];
  document.getElementById('import-preview').classList.add('hidden');
  document.getElementById('csv-file-input').value = '';
  
  updateWorkoutSuggestion();
  renderHistory();
  renderCalendar();
  showView('tab-history');
}

// --- Supabase Cloud Sync Engine ---
function initSupabase() {
  try {
    state.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    state.supabaseClient.auth.onAuthStateChange((event, session) => {
      state.currentUserSession = session;
      const statusEl = document.getElementById('cloud-sync-status');
      const connectBtn = document.getElementById('btn-cloud-connect');
      const disconnectBtn = document.getElementById('btn-cloud-disconnect');

      if (session) {
        statusEl.innerHTML = `<span style="color:#10b981; font-weight:bold;">● Connected</span> as ${session.user.email}`;
        connectBtn.textContent = 'Sync Now (Force Sync)';
        disconnectBtn.classList.remove('hidden');
        
        if (window.location.hash.includes('access_token')) {
          history.replaceState(null, document.title, window.location.pathname + window.location.search);
        }

        syncAllWorkoutsWithCloud();
      } else {
        statusEl.textContent = 'Status: Local-Only Mode';
        connectBtn.textContent = 'Connect & Sign in with Google';
        disconnectBtn.classList.add('hidden');
      }
    });
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    document.getElementById('cloud-sync-status').textContent = 'Status: Connection Configuration Error';
  }
}

async function syncWorkoutToCloud(workout) {
  if (!state.supabaseClient || !state.currentUserSession) return;

  const workoutPayload = {
    user_id: state.currentUserSession.user.id,
    date: workout.date,
    workout_name: workout.workoutName,
    duration: parseFloat(workout.duration || 1.0),
    exercises: workout.exercises
  };

  try {
    await state.supabaseClient
      .from('workouts')
      .delete()
      .eq('user_id', state.currentUserSession.user.id)
      .eq('date', workout.date)
      .eq('workout_name', workout.workoutName);

    await state.supabaseClient
      .from('workouts')
      .insert(workoutPayload);
  } catch (e) {
    console.error('Failed to sync workout record to Supabase:', e);
  }
}

async function syncAllWorkoutsWithCloud() {
  if (!state.supabaseClient || !state.currentUserSession) return;
  const statusEl = document.getElementById('cloud-sync-status');
  statusEl.innerHTML = `<span style="color:var(--info-color);">Syncing history...</span>`;

  try {
    const { data: cloudWorkouts, error } = await state.supabaseClient
      .from('workouts')
      .select('*')
      .eq('user_id', state.currentUserSession.user.id)
      .order('date', { ascending: false });

    if (error) throw error;

    const cloudDates = new Map();
    cloudWorkouts.forEach(cw => {
      cloudDates.set(`${cw.date}_${cw.workout_name}`, cw);
    });

    const localDates = new Map();
    state.workoutHistory.forEach(lw => {
      localDates.set(`${lw.date}_${lw.workoutName}`, lw);
    });

    let mergedCount = 0;

    cloudWorkouts.forEach(cw => {
      const key = `${cw.date}_${cw.workout_name}`;
      if (!localDates.has(key)) {
        state.workoutHistory.push({
          date: cw.date,
          workoutName: cw.workout_name,
          duration: String(cw.duration),
          exercises: cw.exercises
        });
        mergedCount++;
      }
    });

    for (const lw of state.workoutHistory) {
      const key = `${lw.date}_${lw.workoutName}`;
      if (!cloudDates.has(key)) {
        await syncWorkoutToCloud(lw);
        mergedCount++;
      }
    }

    if (mergedCount > 0) {
      state.workoutHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
      saveStateToStorage();
      renderHistory();
      renderCalendar();
    }

    if (state.workoutHistory.length > 0) {
      const lastSession = state.workoutHistory[0];
      lastSession.exercises.forEach(ex => {
        state.currentWeights[ex.name] = ex.weight;
      });
      saveStateToStorage();
    }

    statusEl.innerHTML = `<span style="color:#10b981; font-weight:bold;">● Connected & Synced</span> as ${state.currentUserSession.user.email}`;
  } catch (err) {
    console.error('Sync failed:', err);
    statusEl.innerHTML = `<span style="color:var(--danger-color); font-weight:bold;">● Sync Failed</span> as ${state.currentUserSession.user.email}`;
  }
}

// --- Event Listeners Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  loadStateFromStorage();
  
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('PWA Service Worker Registered Successfully.'))
      .catch(err => console.log('Service Worker registration failed: ', err));
  }

  // Initialize Supabase Client
  initSupabase();

  document.getElementById('setting-timer-toggle').checked = state.settings.timerEnabled;
  document.getElementById('setting-timer-duration').value = state.settings.timerDuration;
  document.getElementById('setting-reminder-toggle').checked = state.settings.reminders;
  
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
    if (document.getElementById('tab-progress').classList.contains('active')) {
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
    if (state.settings.unit === 'lb') return;
    state.settings.unit = 'lb';
    document.getElementById('unit-lb-btn').classList.add('active');
    document.getElementById('unit-kg-btn').classList.remove('active');
    convertStateWeights('lb');
    renderHistory();
    renderCalendar();
  });

  document.getElementById('unit-kg-btn').addEventListener('click', () => {
    if (state.settings.unit === 'kg') return;
    state.settings.unit = 'kg';
    document.getElementById('unit-kg-btn').classList.add('active');
    document.getElementById('unit-lb-btn').classList.remove('active');
    convertStateWeights('kg');
    renderHistory();
    renderCalendar();
  });

  document.getElementById('btn-pwa-install').addEventListener('click', () => {
    alert("To install as a Home Screen App/Shortcut:\n\n🍏 iOS (Safari): Tap the Share button (square with arrow up) -> scroll down and select 'Add to Home Screen'.\n\n🤖 Android (Chrome): Tap the menu (three dots) -> select 'Install app' or 'Add to Home Screen'.");
  });

  // Supabase Cloud Sync Actions
  document.getElementById('btn-cloud-connect').addEventListener('click', async () => {
    if (state.supabaseClient) {
      if (state.currentUserSession) {
        // Connected: Force sync
        syncAllWorkoutsWithCloud();
      } else {
        // Not Logged in: Trigger login redirect
        const { data, error } = await state.supabaseClient.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin + window.location.pathname
          }
        });
        if (error) {
          alert("Google Authentication failed: " + error.message);
        }
      }
    }
  });

  document.getElementById('btn-cloud-disconnect').addEventListener('click', async () => {
    if (state.supabaseClient) {
      await state.supabaseClient.auth.signOut();
    }
    state.currentUserSession = null;
    saveStateToStorage();

    document.getElementById('cloud-sync-status').textContent = 'Status: Local-Only Mode';
    document.getElementById('btn-cloud-disconnect').classList.add('hidden');
    document.getElementById('btn-cloud-connect').textContent = 'Connect & Sign in with Google';
    alert("Disconnected from cloud storage. Running local-only mode.");
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
