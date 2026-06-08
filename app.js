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

// --- Supabase Credentials ---
const SUPABASE_URL = 'https://refpjxitosabqrdrtqjt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3fXKJI7m5X02cm_ifexcZQ_m3skroXF';

// --- Gradients Library ---
const GRADIENTS = {
  'green-cyan': { grad: 'linear-gradient(135deg, #00e676, #00b0ff)', primary: '#00e676', shadow: 'rgba(0, 230, 118, 0.25)' },
  'pink-purple': { grad: 'linear-gradient(135deg, #ec4899, #8b5cf6)', primary: '#ec4899', shadow: 'rgba(236, 72, 153, 0.25)' },
  'orange-red': { grad: 'linear-gradient(135deg, #f97316, #ef4444)', primary: '#f97316', shadow: 'rgba(249, 115, 22, 0.25)' },
  'cyberpunk': { grad: 'linear-gradient(135deg, #ff007f, #00f0ff)', primary: '#ff007f', shadow: 'rgba(255, 0, 127, 0.25)' },
  'sunset': { grad: 'linear-gradient(135deg, #f59e0b, #ec4899)', primary: '#f59e0b', shadow: 'rgba(245, 158, 11, 0.25)' },
  'crimson': { grad: 'linear-gradient(135deg, #f43f5e, #be123c)', primary: '#f43f5e', shadow: 'rgba(244, 63, 94, 0.25)' },
  'emerald': { grad: 'linear-gradient(135deg, #10b981, #059669)', primary: '#10b981', shadow: 'rgba(16, 185, 129, 0.25)' },
  'sapphire': { grad: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', primary: '#3b82f6', shadow: 'rgba(59, 130, 246, 0.25)' },
  'indigo': { grad: 'linear-gradient(135deg, #6366f1, #a855f7)', primary: '#6366f1', shadow: 'rgba(99, 102, 241, 0.25)' },
  'lava': { grad: 'linear-gradient(135deg, #ff4e50, #f9d423)', primary: '#ff4e50', shadow: 'rgba(255, 78, 80, 0.25)' }
};

// --- State Management ---
let state = {
  workoutHistory: [], // [workoutObjects]
  currentWeights: { ...DEFAULT_WEIGHTS },
  activeWorkout: null, // { name: 'Workout A', date: string, startTime: number, exercises: [...], rpe: number, notes: string }
  restTimer: {
    duration: 180,
    timeLeft: 0,
    intervalId: null,
    running: false
  },
  settings: {
    theme: 'dark',
    themeGradient: 'green-cyan',
    timerEnabled: true,
    timerDuration: 180,
    unit: 'lb',
    reminders: false,
    schedule: {
      frequency: '3x',
      days: [1, 3, 5] // Monday, Wednesday, Friday
    },
    workoutTemplates: {
      'Workout A': [
        { name: 'Squat', sets: 5, reps: 5 },
        { name: 'Bench Press', sets: 5, reps: 5 },
        { name: 'Barbell Row', sets: 5, reps: 5 }
      ],
      'Workout B': [
        { name: 'Squat', sets: 5, reps: 5 },
        { name: 'Overhead Press', sets: 5, reps: 5 },
        { name: 'Deadlift', sets: 1, reps: 5 }
      ]
    }
  },
  calendarDate: new Date(),
  chartInstance: null,
  supabaseClient: null,
  currentUserSession: null,
  subscription: null
};

function applyGradientTheme(themeId) {
  state.settings.themeGradient = themeId;
  const t = GRADIENTS[themeId] || GRADIENTS['green-cyan'];
  document.documentElement.style.setProperty('--primary-gradient', t.grad);
  document.documentElement.style.setProperty('--primary-color', t.primary);
  
  document.querySelectorAll('.theme-swatch').forEach(sw => {
    if (sw.getAttribute('data-theme-id') === themeId) {
      sw.classList.add('active');
    } else {
      sw.classList.remove('active');
    }
  });
}

function normalizeDate(rawDate) {
  if (!rawDate) return '';
  if (rawDate instanceof Date) {
    const y = rawDate.getFullYear();
    const m = String(rawDate.getMonth() + 1).padStart(2, '0');
    const d = String(rawDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  let str = String(rawDate).trim();
  // Strip any time component (space or 'T')
  if (str.includes('T')) {
    str = str.split('T')[0];
  } else if (str.includes(' ')) {
    str = str.split(' ')[0];
  }
  // Replace slashes with dashes
  str = str.replace(/\//g, '-');
  const parts = str.split('-');
  if (parts.length === 3) {
    // Check if it starts with year: YYYY-MM-DD
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    // Check if it ends with year: MM-DD-YYYY or DD-MM-YYYY
    if (parts[2].length === 4) {
      return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
  }
  // Fallback to JS Date parsing
  try {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  } catch (e) {}
  return str;
}

function deduplicateWorkoutHistory() {
  const seenKeys = new Set();
  const uniqueHistory = [];
  const sorted = [...(state.workoutHistory || [])].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(w => {
    w.date = normalizeDate(w.date);
    const key = `${w.date}_${w.workoutName}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueHistory.push(w);
    }
  });

  state.workoutHistory = uniqueHistory;
  saveStateToStorage();
}

function exportHistoryToCSV() {
  const history = state.workoutHistory || [];
  if (history.length === 0) {
    alert("No workouts logged to export!");
    return;
  }

  const unitText = state.settings.unit === 'kg' ? 'kgs' : 'lbs';
  const headers = [
    'Date', 'Workout Name', 'Exercise', 'Duration',
    'Set 1 (reps)', `Set 1 (${unitText})`,
    'Set 2 (reps)', `Set 2 (${unitText})`,
    'Set 3 (reps)', `Set 3 (${unitText})`,
    'Set 4 (reps)', `Set 4 (${unitText})`,
    'Set 5 (reps)', `Set 5 (${unitText})`
  ];

  const csvRows = [headers.join(',')];

  history.forEach(w => {
    const durationHrs = parseFloat(w.duration || 1.0);
    const totalMins = Math.round(durationHrs * 60);
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const durationStr = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;

    w.exercises.forEach(ex => {
      const row = [
        `"${w.date}"`,
        `"${w.workoutName || 'Workout A'}"`,
        `"${ex.name}"`,
        `"${durationStr}"`
      ];

      for (let s = 0; s < 5; s++) {
        const reps = ex.sets[s];
        if (reps !== undefined && reps !== null && reps !== '') {
          row.push(reps);
          row.push(ex.weight);
        } else {
          row.push('');
          row.push('');
        }
      }

      csvRows.push(row.join(','));
    });
  });

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `antigravitylifts_history_${normalizeDate(new Date())}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function shareWorkoutSummary(workoutObj) {
  let totalWorkoutVolume = 0;
  let prsList = [];
  let emojiSummary = '';

  workoutObj.exercises.forEach(ex => {
    let exReps = 0;
    ex.sets.forEach(r => {
      if (r !== null && r > 0) {
        totalWorkoutVolume += (ex.weight * r);
        exReps += r;
      }
    });

    const targetReps = ex.targetReps || 5;
    const allSetsSuccessful = ex.sets.every(r => r === targetReps);
    const successEmoji = allSetsSuccessful ? '🟩' : '🟨';
    const prText = ex.isPR ? ' (PR! 🏆)' : '';
    if (ex.isPR) prsList.push(ex.name);

    const successFraction = ex.sets.map(s => s === null ? '-' : s).join('/');
    emojiSummary += `${successEmoji} ${ex.name}: ${successFraction} @ ${ex.weight}${state.settings.unit === 'kg' ? 'kg' : 'lb'}${prText}\n`;
  });

  const durationMinutes = Math.round(parseFloat(workoutObj.duration) * 60);
  const formattedDate = new Date(workoutObj.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  const prAnnounce = prsList.length > 0 ? `🏆 New PRs in: ${prsList.join(', ')}!\n` : '';

  const shareText = `🏋️‍♂️ Logged ${workoutObj.workoutName} on AntigravityLifts!
📅 ${formattedDate} (${durationMinutes} mins)
💪 Total Volume: ${formatWeight(totalWorkoutVolume)}
${prAnnounce}
${emojiSummary}
Check it out at: ${window.location.origin}`;

  if (navigator.share) {
    navigator.share({
      title: 'Workout Logged!',
      text: shareText
    }).catch(err => console.log('Error sharing:', err));
  } else {
    navigator.clipboard.writeText(shareText).then(() => {
      alert("Workout summary copied to clipboard! Share it with your friends. 📋");
    }).catch(err => {
      console.error('Failed to copy text:', err);
    });
  }
}

function calculateStreak() {
  const history = state.workoutHistory || [];
  if (history.length === 0) return { weeks: 0, count: 0 };

  const reverseSorted = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  let currentWorkoutStreak = 0;
  const maxTimeGap = 5 * 24 * 60 * 60 * 1000; // 5 days

  for (let i = 0; i < reverseSorted.length; i++) {
    const d = new Date(reverseSorted[i].date + 'T00:00:00');
    if (i === 0) {
      const diffFromToday = Date.now() - d.getTime();
      if (diffFromToday > 7 * 24 * 60 * 60 * 1000) {
        break;
      }
      currentWorkoutStreak = 1;
    } else {
      const prevD = new Date(reverseSorted[i-1].date + 'T00:00:00');
      const gap = prevD.getTime() - d.getTime();
      if (gap <= maxTimeGap) {
        currentWorkoutStreak++;
      } else {
        break;
      }
    }
  }

  const weeksMap = new Map();
  reverseSorted.forEach(w => {
    const d = new Date(w.date + 'T00:00:00');
    const year = d.getFullYear();
    const oneJan = new Date(year, 0, 1);
    const numberOfDays = Math.floor((d - oneJan) / (24 * 60 * 60 * 1000));
    const weekNum = Math.ceil((d.getDay() + 1 + numberOfDays) / 7);
    const key = `${year}-W${weekNum}`;
    if (!weeksMap.has(key)) {
      weeksMap.set(key, []);
    }
    weeksMap.get(key).push(d);
  });

  let weeklyStreak = 0;
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayOneJan = new Date(todayYear, 0, 1);
  const todayNumberOfDays = Math.floor((today - todayOneJan) / (24 * 60 * 60 * 1000));
  const todayWeekNum = Math.ceil((today.getDay() + 1 + todayNumberOfDays) / 7);

  let currentYear = todayYear;
  let currentWeek = todayWeekNum;

  const getPrevWeek = (y, w) => {
    if (w === 1) {
      return { y: y - 1, w: 52 };
    }
    return { y, w: w - 1 };
  };

  let checkKey = `${currentYear}-W${currentWeek}`;
  let hasCurrentWeek = weeksMap.has(checkKey);
  
  if (!hasCurrentWeek) {
    const prev = getPrevWeek(currentYear, currentWeek);
    currentYear = prev.y;
    currentWeek = prev.w;
    checkKey = `${currentYear}-W${currentWeek}`;
  }

  while (weeksMap.has(checkKey)) {
    weeklyStreak++;
    const prev = getPrevWeek(currentYear, currentWeek);
    currentYear = prev.y;
    currentWeek = prev.w;
    checkKey = `${currentYear}-W${currentWeek}`;
  }

  return {
    workouts: currentWorkoutStreak,
    weeks: weeklyStreak
  };
}

function renderStreak() {
  const container = document.getElementById('streak-badge-container');
  if (!container) return;

  const streak = calculateStreak();
  if (streak.weeks === 0 && streak.workouts === 0) {
    container.innerHTML = `
      <div style="background: rgba(255,255,255,0.02); padding: 8px 12px; border-radius: 8px; border: 1px dashed rgba(255,255,255,0.1); font-size: 0.8rem; color: var(--text-secondary); width: 100%;">
        Log a workout to start your active streak! ⚡
      </div>
    `;
    return;
  }

  let streakHTML = '';
  if (streak.weeks > 0) {
    streakHTML += `
      <div class="streak-badge" style="background: linear-gradient(135deg, #f59e0b, #ef4444); color: #fff; padding: 6px 14px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2); animation: pulse 2s infinite;">
        <span>🔥</span> ${streak.weeks}-Week Streak
      </div>
    `;
  }
  if (streak.workouts > 0) {
    streakHTML += `
      <div class="streak-badge" style="background: linear-gradient(135deg, #3b82f6, #00f0ff); color: #fff; padding: 6px 14px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2); margin-left: 8px;">
        <span>⚡</span> ${streak.workouts} Active Workouts
      </div>
    `;
  }

  container.innerHTML = streakHTML;
}

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
    
    const now = audioCtx.currentTime;
    
    // Create first chime tone (Fundamental A5)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    
    // Create second chime tone (Fifth E6) for a pleasant chord
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.51, now); // E6
    
    // Bell envelope: instant rise, gradual decay
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.25, now + 0.04); // fast attack
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2); // smooth decay
    
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.exponentialRampToValueAtTime(0.12, now + 0.04); 
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8); 

    osc1.start(now);
    osc1.stop(now + 1.3);
    osc2.start(now);
    osc2.stop(now + 0.9);
    
    // Fallback audio element trigger
    const audioEl = document.getElementById('timer-sound');
    if (audioEl) {
      audioEl.currentTime = 0;
      audioEl.play().catch(e => console.log('Audio element play blocked.', e));
    }
  } catch (err) {
    console.error('Failed to play chime sound:', err);
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
    const parsed = JSON.parse(savedSettings);
    // Deep merge settings
    state.settings = { 
      ...state.settings, 
      ...parsed,
      schedule: { ...state.settings.schedule, ...(parsed.schedule || {}) },
      workoutTemplates: { ...state.settings.workoutTemplates, ...(parsed.workoutTemplates || {}) }
    };
  }

  deduplicateWorkoutHistory();
  applyTheme();
  applyGradientTheme(state.settings.themeGradient || 'green-cyan');
}

// Save state to storage
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
    renderStreak();
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
  
  if (!state.settings.workoutTemplates) {
    state.settings.workoutTemplates = {
      'Workout A': [
        { name: 'Squat', sets: 5, reps: 5 },
        { name: 'Bench Press', sets: 5, reps: 5 },
        { name: 'Barbell Row', sets: 5, reps: 5 }
      ],
      'Workout B': [
        { name: 'Squat', sets: 5, reps: 5 },
        { name: 'Overhead Press', sets: 5, reps: 5 },
        { name: 'Deadlift', sets: 1, reps: 5 }
      ]
    };
  }
  
  const template = state.settings.workoutTemplates[workoutName] || [];

  state.activeWorkout = {
    name: workoutName,
    date: dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    isoDate: dateObj.toISOString().split('T')[0],
    startTime: Date.now(),
    rpe: 8,
    notes: "",
    exercises: template.map(item => {
      const setsCount = item.sets;
      const targetReps = item.reps;
      return {
        name: item.name,
        weight: state.currentWeights[item.name] || DEFAULT_WEIGHTS[item.name] || 45,
        setsCount: setsCount,
        targetReps: targetReps,
        sets: Array(setsCount).fill(null),
        isWarmupMode: false,
        showPlateCalculator: false,
        warmupSets: []
      };
    })
  };

  // Reset UI active summarizing elements
  const notesInput = document.getElementById('session-notes-input');
  if (notesInput) notesInput.value = "";
  
  document.querySelectorAll('#session-rpe-container .rpe-btn').forEach(btn => {
    if (btn.getAttribute('data-rpe') === '8') {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  const hintEl = document.getElementById('rpe-label-hint');
  if (hintEl) hintEl.textContent = "RPE 8: Hard, 1–2 reps left in reserve";

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
    const targetReps = exercise.targetReps || 5;
    headerTop.innerHTML = `
      <div class="exercise-header-left">
        <div class="exercise-title">${exercise.name}</div>
        <div class="exercise-scheme">${exercise.isWarmupMode ? 'Warmup' : exercise.setsCount + 'x' + targetReps + ' working'}</div>
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
        if (repCount === targetReps) {
          circle.classList.add('completed');
        } else if (repCount !== null && repCount < targetReps) {
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
  const ex = state.activeWorkout.exercises[exIndex];
  const current = ex.sets[setIndex];
  const targetReps = ex.targetReps || 5;
  let next = null;

  if (current === null) next = targetReps;
  else if (current === 0) next = null;
  else next = current - 1;

  ex.sets[setIndex] = next;
  renderActiveExercises();

  if (next !== null) {
    startRestTimer(state.settings.timerDuration);
  }
}

async function finishWorkout() {
  if (!state.activeWorkout) return;

  const durationHours = ((Date.now() - state.activeWorkout.startTime) / 3600000).toFixed(2);
  const notesVal = document.getElementById('session-notes-input').value.trim();
  const activeRpeBtn = document.querySelector('#session-rpe-container .rpe-btn.active');
  const rpeVal = activeRpeBtn ? parseInt(activeRpeBtn.getAttribute('data-rpe'), 10) : 8;

  const workoutObj = {
    date: state.activeWorkout.isoDate,
    workoutName: state.activeWorkout.name,
    duration: durationHours,
    rpe: rpeVal,
    notes: notesVal,
    exercises: state.activeWorkout.exercises.map(ex => {
      const targetReps = ex.targetReps || 5;
      const allSetsSuccessful = ex.sets.every(r => r === targetReps);
      
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
        sets: [...ex.sets],
        targetReps: targetReps
      };
    })
  };

  state.workoutHistory.push(workoutObj);
  state.workoutHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

  saveStateToStorage();
  
  if (state.supabaseClient && state.currentUserSession) {
    await syncWorkoutToCloud(workoutObj);
  }

  // Populate and show workout summary modal
  try {
    const summaryDateEl = document.getElementById('summary-workout-date');
    const summaryVolumeEl = document.getElementById('summary-total-volume');
    const summarySetsEl = document.getElementById('summary-total-sets');
    const summaryRepsEl = document.getElementById('summary-total-reps');
    const summaryDurationEl = document.getElementById('summary-workout-duration');
    const summaryRpeEl = document.getElementById('summary-workout-rpe');
    const summaryListEl = document.getElementById('summary-exercises-list');

    let totalWorkoutVolume = 0;
    let totalWorkoutSets = 0;
    let totalWorkoutReps = 0;

    summaryListEl.innerHTML = '';

    workoutObj.exercises.forEach(ex => {
      let exReps = 0;
      let exSets = 0;
      ex.sets.forEach(r => {
        if (r !== null && r > 0) {
          totalWorkoutVolume += (ex.weight * r);
          totalWorkoutReps += r;
          exReps += r;
          totalWorkoutSets++;
          exSets++;
        }
      });

      const exRow = document.createElement('div');
      exRow.style.display = 'flex';
      exRow.style.justify = 'space-between';
      exRow.style.alignItems = 'center';
      exRow.style.fontSize = '0.9rem';
      exRow.style.background = 'rgba(255, 255, 255, 0.04)';
      exRow.style.padding = '8px 12px';
      exRow.style.borderRadius = '8px';
      
      const successFraction = ex.sets.map(s => s === null ? '-' : s).join('/');

      exRow.innerHTML = `
        <span style="font-weight: 500; color:#fff;">${ex.name}</span>
        <span style="color: var(--text-secondary); text-align:right;">${successFraction} @ ${formatWeight(ex.weight)} (${exReps} reps)</span>
      `;
      summaryListEl.appendChild(exRow);
    });

    if (summaryDateEl) {
      summaryDateEl.textContent = new Date(workoutObj.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
    if (summaryVolumeEl) summaryVolumeEl.textContent = formatWeight(totalWorkoutVolume);
    if (summarySetsEl) summarySetsEl.textContent = totalWorkoutSets;
    if (summaryRepsEl) summaryRepsEl.textContent = totalWorkoutReps;
    
    // Format duration
    const durationMinutes = Math.round(parseFloat(workoutObj.duration) * 60);
    if (summaryDurationEl) summaryDurationEl.textContent = durationMinutes > 0 ? `${durationMinutes} mins` : '< 1 min';
    if (summaryRpeEl) summaryRpeEl.textContent = `${workoutObj.rpe}/10 RPE`;

    // Show modal
    document.getElementById('workout-summary-modal').classList.remove('hidden');
  } catch (err) {
    console.error('Failed to show workout summary modal:', err);
  }

  state.lastFinishedWorkout = workoutObj;
  state.activeWorkout = null;
  stopRestTimer();
  const timerWidget = document.getElementById('rest-timer-widget');
  if (timerWidget) timerWidget.classList.add('hidden');

  document.getElementById('workout-setup-panel').classList.remove('hidden');
  document.getElementById('active-workout-panel').classList.add('hidden');
  
  updateWorkoutSuggestion();
  renderHistory();
  renderCalendar();
  
  // Assess if we should offer a deload warning
  checkDeloadRecommendation();

  showView('tab-history');
}

// Deload Recommendation Engine
function checkDeloadRecommendation() {
  const history = state.workoutHistory || [];
  const exercisesToCheck = ['Squat', 'Bench Press', 'Barbell Row', 'Overhead Press', 'Deadlift'];
  let recommendedExercise = null;

  for (const exName of exercisesToCheck) {
    let failsInARow = 0;
    let occurrences = 0;

    for (const workout of history) {
      const matchedEx = workout.exercises.find(e => e.name === exName);
      if (matchedEx) {
        occurrences++;
        const targetReps = matchedEx.targetReps || 5;
        const totalExpected = matchedEx.sets.length * targetReps;
        const totalCompleted = matchedEx.sets.reduce((sum, r) => sum + (r || 0), 0);
        
        if (totalCompleted < totalExpected) {
          failsInARow++;
        } else {
          break; // Streak broken
        }

        if (occurrences >= 3) break;
      }
    }

    if (failsInARow >= 3) {
      recommendedExercise = exName;
      break; 
    }
  }

  const banner = document.getElementById('deload-alert-banner');
  if (banner) {
    if (recommendedExercise) {
      document.getElementById('deload-recommendation-text').textContent = `You missed targets for ${recommendedExercise} in 3 consecutive sessions. We recommend a 10% deload to rebuild your strength.`;
      banner.setAttribute('data-recommended-exercise', recommendedExercise);
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }
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
    const unitText = state.settings.unit === 'kg' ? 'kg' : 'lbs';
    const defSq = state.settings.unit === 'kg' ? 20 : 45;
    const defBP = state.settings.unit === 'kg' ? 20 : 45;
    const defRow = state.settings.unit === 'kg' ? 30 : 65;
    const defOHP = state.settings.unit === 'kg' ? 20 : 45;
    const defDL = state.settings.unit === 'kg' ? 40 : 135;

    container.innerHTML = `
      <div class="glass-card onboarding-card" style="margin-top: 15px; padding: 24px; animation: fadeInUp 0.4s ease-out; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 3rem; display: block; margin-bottom: 10px; animation: bounce 2s infinite;">🚀</span>
          <h2 style="font-family: var(--font-mono); margin-bottom: 8px; color: var(--primary-color); font-size: 1.6rem;">Welcome to AntigravityLifts!</h2>
          <p style="color: var(--text-secondary); font-size: 0.9rem; max-width: 380px; margin: 0 auto; line-height: 1.4;">Ready to track your 5x5 lifting progress? Set up your starting weights below or import an existing history file.</p>
        </div>

        <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 18px; margin-bottom: 24px;">
          <h3 style="font-size: 0.9rem; margin-bottom: 14px; font-family: var(--font-mono); color: #fff; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px;">1. Configure Starting Weights (${unitText})</h3>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.9rem; font-weight: 500;">Squat</span>
              <input type="number" id="onboard-Squat" value="${defSq}" class="form-select form-select-sm" style="width: 90px; text-align: center; font-weight: bold; background: rgba(0,0,0,0.2);">
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.9rem; font-weight: 500;">Bench Press</span>
              <input type="number" id="onboard-Bench-Press" value="${defBP}" class="form-select form-select-sm" style="width: 90px; text-align: center; font-weight: bold; background: rgba(0,0,0,0.2);">
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.9rem; font-weight: 500;">Barbell Row</span>
              <input type="number" id="onboard-Barbell-Row" value="${defRow}" class="form-select form-select-sm" style="width: 90px; text-align: center; font-weight: bold; background: rgba(0,0,0,0.2);">
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.9rem; font-weight: 500;">Overhead Press</span>
              <input type="number" id="onboard-Overhead-Press" value="${defOHP}" class="form-select form-select-sm" style="width: 90px; text-align: center; font-weight: bold; background: rgba(0,0,0,0.2);">
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.9rem; font-weight: 500;">Deadlift</span>
              <input type="number" id="onboard-Deadlift" value="${defDL}" class="form-select form-select-sm" style="width: 90px; text-align: center; font-weight: bold; background: rgba(0,0,0,0.2);">
            </div>
          </div>
          <button class="btn btn-primary" id="btn-onboard-save" style="width: 100%; margin-top: 20px; font-weight: 600; padding: 10px;">Save & Begin Program</button>
        </div>

        <div style="text-align: center;">
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px;">Already have StrongLifts history data?</p>
          <button class="btn btn-outline btn-sm" id="btn-onboard-go-csv" style="width: 100%; padding: 8px;">Import History CSV</button>
        </div>
      </div>
    `;

    document.getElementById('btn-onboard-save').addEventListener('click', () => {
      state.currentWeights['Squat'] = parseFloat(document.getElementById('onboard-Squat').value);
      state.currentWeights['Bench Press'] = parseFloat(document.getElementById('onboard-Bench-Press').value);
      state.currentWeights['Barbell Row'] = parseFloat(document.getElementById('onboard-Barbell-Row').value);
      state.currentWeights['Overhead Press'] = parseFloat(document.getElementById('onboard-Overhead-Press').value);
      state.currentWeights['Deadlift'] = parseFloat(document.getElementById('onboard-Deadlift').value);
      
      saveStateToStorage();
      alert("Starting weights configured! Get ready for your first workout.");
      showView('tab-workout');
    });

    document.getElementById('btn-onboard-go-csv').addEventListener('click', () => {
      showView('tab-settings');
      setTimeout(() => {
        const zone = document.getElementById('csv-drop-zone');
        if (zone) zone.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    });

    statsOverview.innerHTML = '';
    return;
  }

  // Pre-calculate Personal Records (PRs) chronologically
  const exMaxWeights = {};
  const chronoHistory = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  chronoHistory.forEach(workout => {
    workout.exercises.forEach(ex => {
      const currentMax = exMaxWeights[ex.name] || 0;
      if (ex.weight > currentMax) {
        ex.isPR = true;
        exMaxWeights[ex.name] = ex.weight;
      } else {
        ex.isPR = false;
      }
    });
  });

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

  // Calculate volume based on the selected metric setting
  const metric = state.settings.volumeMetric || 'lifetime';
  let volumeLabel = 'Est. Volume';
  let displayedVolume = 0;

  if (metric === 'lifetime') {
    volumeLabel = 'Est. Volume';
    displayedVolume = totalVolume;
  } else if (metric === 'last') {
    volumeLabel = 'Last Vol.';
    if (history.length > 0) {
      const lastW = history[0];
      lastW.exercises.forEach(ex => {
        ex.sets.forEach(reps => {
          if (reps && reps > 0) {
            displayedVolume += ex.weight * reps;
          }
        });
      });
    }
  } else if (metric === 'weekly') {
    volumeLabel = 'Weekly Avg.';
    const weekKeys = new Set();
    history.forEach(w => {
      const d = new Date(w.date + 'T00:00:00');
      const year = d.getFullYear();
      const oneJan = new Date(year, 0, 1);
      const numberOfDays = Math.floor((d - oneJan) / (24 * 60 * 60 * 1000));
      const weekNum = Math.ceil((d.getDay() + 1 + numberOfDays) / 7);
      weekKeys.add(`${year}-W${weekNum}`);
    });
    const weeksCount = Math.max(1, weekKeys.size);
    displayedVolume = Math.round(totalVolume / weeksCount);
  } else if (metric === 'monthly') {
    volumeLabel = 'Monthly Avg.';
    const monthKeys = new Set();
    history.forEach(w => {
      const d = new Date(w.date + 'T00:00:00');
      monthKeys.add(`${d.getFullYear()}-${d.getMonth()}`);
    });
    const monthsCount = Math.max(1, monthKeys.size);
    displayedVolume = Math.round(totalVolume / monthsCount);
  }

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
      <div class="stat-label">${volumeLabel}</div>
      <div class="stat-value">${formatWeight(displayedVolume)}</div>
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
      const prBadge = ex.isPR ? `<span class="pr-badge" style="background: linear-gradient(135deg, #f59e0b, #ec4899); color: #fff; font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-left: 6px; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block;">⭐ PR</span>` : '';

      exEl.innerHTML = `
        <span class="history-ex-name">${ex.name}${prBadge}</span>
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
function showChartPointDetails(workout) {
  const card = document.getElementById('chart-point-details-card');
  if (!card) return;
  
  const dateTitle = document.getElementById('chart-detail-date');
  const statsContainer = document.getElementById('chart-detail-stats');
  const exContainer = document.getElementById('chart-detail-exercises');
  const notesContainer = document.getElementById('chart-detail-notes');

  const formattedDate = new Date(workout.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  
  dateTitle.textContent = `${workout.workoutName} - ${formattedDate}`;

  let totalVolume = 0;
  let totalReps = 0;
  workout.exercises.forEach(ex => {
    const repsCount = ex.sets.reduce((sum, r) => sum + (r || 0), 0);
    totalVolume += ex.weight * repsCount;
    totalReps += repsCount;
  });

  statsContainer.innerHTML = `
    <div class="stat-item" style="padding:6px; border-radius:8px;">
      <div class="stat-label" style="font-size:0.6rem;">Duration</div>
      <div class="stat-value" style="font-size:0.85rem;">${workout.duration || 1}h</div>
    </div>
    <div class="stat-item" style="padding:6px; border-radius:8px;">
      <div class="stat-label" style="font-size:0.6rem;">Volume</div>
      <div class="stat-value" style="font-size:0.85rem;">${formatWeight(Math.round(totalVolume))}</div>
    </div>
    <div class="stat-item" style="padding:6px; border-radius:8px;">
      <div class="stat-label" style="font-size:0.6rem;">Reps</div>
      <div class="stat-value" style="font-size:0.85rem;">${totalReps}</div>
    </div>
    <div class="stat-item" style="padding:6px; border-radius:8px;">
      <div class="stat-label" style="font-size:0.6rem;">RPE</div>
      <div class="stat-value" style="font-size:0.85rem;">${workout.rpe || 8}</div>
    </div>
  `;

  let exHTML = '';
  workout.exercises.forEach(ex => {
    const repsStr = ex.sets.map(r => r === null ? '-' : r).join('-');
    exHTML += `
      <div style="display:flex; justify-content:space-between; margin-bottom:4px; border-bottom:1px solid rgba(120,120,120,0.05); padding-bottom:3px;">
        <strong style="color:var(--text-color); font-size:0.85rem;">${ex.name}</strong>
        <span style="color:var(--text-secondary); font-family:var(--font-mono); font-size:0.85rem;">${formatWeight(ex.weight)} &times; ${repsStr}</span>
      </div>
    `;
  });
  exContainer.innerHTML = exHTML;

  notesContainer.innerHTML = workout.notes 
    ? `<strong style="color:var(--text-color); font-size:0.8rem;">Notes:</strong> <span style="font-style:italic; font-size:0.8rem;">"${workout.notes}"</span>`
    : `<span style="color:var(--text-secondary); font-style:italic; font-size:0.8rem;">No session notes recorded.</span>`;

  card.classList.remove('hidden');
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderProgressChart() {
  const history = state.workoutHistory || [];
  const exercise = document.getElementById('progress-exercise-select').value;
  const timeframe = document.querySelector('#timeframe-filters .filter-pill.active').getAttribute('data-timeframe');
  
  const showWeight = document.getElementById('chart-show-weight').checked;
  const showe1rm = document.getElementById('chart-show-e1rm').checked;
  const showVolume = document.getElementById('chart-show-volume').checked;
  const showReps = document.getElementById('chart-show-reps').checked;

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

    let displayedWeight = matchedEx.weight;
    
    // Calculate e1RM
    const maxReps = Math.max(...matchedEx.sets.filter(r => r !== null), 0);
    let e1rmVal = displayedWeight;
    if (maxReps > 0) {
      e1rmVal = Math.round(displayedWeight * (1 + maxReps / 30));
    }

    // Calculate Volume & Reps
    const totalReps = matchedEx.sets.reduce((sum, r) => sum + (r || 0), 0);
    const volumeVal = displayedWeight * totalReps;

    chartPoints.push({
      date: wDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }),
      weight: displayedWeight,
      e1rm: e1rmVal,
      volume: volumeVal,
      reps: totalReps,
      workout: w
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

  const labelColor = state.settings.theme === 'light' ? '#4b5563' : '#9ca3af';
  const gridColor = state.settings.theme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';

  // Build datasets dynamically
  const datasets = [];
  const primaryAccent = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#00e676';
  
  if (showWeight) {
    datasets.push({
      label: 'Weight',
      data: chartPoints.map(p => p.weight),
      borderColor: primaryAccent,
      backgroundColor: 'transparent',
      yAxisID: 'y-weight',
      borderWidth: 3,
      tension: 0.25,
      pointRadius: 4,
      pointHoverRadius: 7
    });
  }

  if (showe1rm) {
    datasets.push({
      label: 'e1RM',
      data: chartPoints.map(p => p.e1rm),
      borderColor: '#ffd740', // Yellow
      backgroundColor: 'transparent',
      yAxisID: 'y-weight',
      borderWidth: 2,
      borderDash: [5, 5],
      tension: 0.25,
      pointRadius: 4,
      pointHoverRadius: 7
    });
  }

  if (showVolume) {
    datasets.push({
      label: 'Volume',
      data: chartPoints.map(p => p.volume),
      borderColor: '#29b6f6', // Light Blue
      backgroundColor: 'rgba(41, 182, 246, 0.05)',
      yAxisID: 'y-volume',
      borderWidth: 2,
      tension: 0.25,
      fill: true,
      pointRadius: 4,
      pointHoverRadius: 7
    });
  }

  if (showReps) {
    datasets.push({
      label: 'Reps',
      data: chartPoints.map(p => p.reps),
      borderColor: '#ec4899', // Pink
      backgroundColor: 'transparent',
      yAxisID: 'y-reps',
      borderWidth: 2,
      tension: 0.25,
      pointRadius: 4,
      pointHoverRadius: 7
    });
  }

  state.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartPoints.map(p => p.date),
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (e, activeEls) => {
        if (activeEls && activeEls.length > 0) {
          const index = activeEls[0].index;
          const pointData = chartPoints[index];
          if (pointData && pointData.workout) {
            showChartPointDetails(pointData.workout);
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: labelColor,
            font: { family: 'Outfit', size: 11 }
          }
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
          grid: { color: gridColor },
          ticks: { color: labelColor, font: { family: 'Outfit' } }
        },
        'y-weight': {
          type: 'linear',
          display: showWeight || showe1rm,
          position: 'left',
          grid: { color: gridColor },
          ticks: { color: labelColor, font: { family: 'Outfit' } },
          title: { display: true, text: `Weight / e1RM (${state.settings.unit === 'kg' ? 'KGS' : 'LBS'})`, color: labelColor }
        },
        'y-volume': {
          type: 'linear',
          display: showVolume,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: labelColor, font: { family: 'Outfit' } },
          title: { display: true, text: `Volume (${state.settings.unit === 'kg' ? 'KGS' : 'LBS'})`, color: labelColor }
        },
        'y-reps': {
          type: 'linear',
          display: showReps,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: labelColor, font: { family: 'Outfit' } },
          title: { display: true, text: 'Reps Count', color: labelColor }
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

    const isoDate = normalizeDate(row[dateIndex]);

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

  // Normalize parsed dates
  parsedWorkoutsToImport.forEach(w => {
    w.date = normalizeDate(w.date);
  });

  // If app is currently using kg, convert the parsed workouts (assumed to be in lbs in the StrongLifts CSV) to kg
  if (state.settings.unit === 'kg') {
    parsedWorkoutsToImport.forEach(workout => {
      workout.exercises.forEach(ex => {
        ex.weight = Math.round((ex.weight * 0.45359237) / 2.5) * 2.5;
      });
    });
  }

  const existingDates = new Set(state.workoutHistory.map(w => normalizeDate(w.date)));
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

  deduplicateWorkoutHistory();

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

  saveStateToStorage();

  if (state.supabaseClient && state.currentUserSession) {
    const workoutsToUpload = [];
    parsedWorkoutsToImport.forEach(workout => {
      if (!existingDates.has(workout.date)) {
        workoutsToUpload.push({
          user_id: state.currentUserSession.user.id,
          date: workout.date,
          workout_name: workout.workoutName,
          duration: parseFloat(workout.duration || 1.0),
          exercises: workout.exercises
        });
      }
    });

    if (workoutsToUpload.length > 0) {
      try {
        const { error: uploadErr } = await state.supabaseClient
          .from('workouts')
          .insert(workoutsToUpload);
        if (uploadErr) throw uploadErr;
      } catch (err) {
        console.error('Failed to batch upload imported workouts to cloud:', err);
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

      const headerLoginBtn = document.getElementById('header-login-btn');
      const headerProfileBadge = document.getElementById('header-profile-badge');
      const headerUserEmail = document.getElementById('header-user-email');
      const avatarEl = headerProfileBadge.querySelector('.profile-avatar');

      if (session) {
        if (statusEl) {
          statusEl.innerHTML = `<span style="color:#10b981; font-weight:bold;">● Connected</span> as ${session.user.email}`;
        }
        if (connectBtn) {
          connectBtn.textContent = 'Sync Now (Force Sync)';
        }
        if (disconnectBtn) {
          disconnectBtn.classList.remove('hidden');
        }

        // Upsert user profile to public.profiles table
        const profileData = {
          id: session.user.id,
          updated_at: new Date().toISOString(),
          email: session.user.email,
          full_name: session.user.user_metadata.full_name || session.user.user_metadata.name || '',
          avatar_url: session.user.user_metadata.avatar_url || session.user.user_metadata.picture || ''
        };
        state.supabaseClient
          .from('profiles')
          .upsert(profileData)
          .then(({ error: profErr }) => {
            if (profErr) {
              console.warn('Failed to upsert profile in public table:', profErr.message);
            }
          });
        
        // Update header UI
        if (headerLoginBtn) headerLoginBtn.classList.add('hidden');
        if (headerProfileBadge) headerProfileBadge.classList.remove('hidden');
        if (headerUserEmail) {
          const displayName = session.user.user_metadata.full_name || session.user.user_metadata.name || session.user.email.split('@')[0];
          headerUserEmail.textContent = displayName;
        }
        if (avatarEl) {
          const avatarUrl = session.user.user_metadata.avatar_url || session.user.user_metadata.picture;
          if (avatarUrl) {
            avatarEl.innerHTML = `<img src="${avatarUrl}" alt="Avatar" referrerpolicy="no-referrer" style="width:24px; height:24px; border-radius:50%; object-fit:cover; display:block;">`;
          } else {
            avatarEl.textContent = '👤';
          }
        }
        
        if (window.location.hash.includes('access_token')) {
          history.replaceState(null, document.title, window.location.pathname + window.location.search);
        }

        syncAllWorkoutsWithCloud();
        checkSubscriptionStatus();
      } else {
        if (statusEl) {
          statusEl.textContent = 'Status: Disconnected';
        }
        if (connectBtn) {
          connectBtn.textContent = 'Connect & Sign in with Google';
        }
        if (disconnectBtn) {
          disconnectBtn.classList.add('hidden');
        }
        
        // Update header UI
        if (headerLoginBtn) headerLoginBtn.classList.remove('hidden');
        if (headerProfileBadge) headerProfileBadge.classList.add('hidden');
        if (avatarEl) avatarEl.textContent = '👤';

        state.subscription = null;
        updateSubscriptionUI();
      }
    });
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    const statusEl = document.getElementById('cloud-sync-status');
    if (statusEl) {
      statusEl.textContent = 'Status: Connection Configuration Error';
    }
  }
}

async function checkSubscriptionStatus() {
  if (!state.supabaseClient || !state.currentUserSession) {
    state.subscription = null;
    updateSubscriptionUI();
    return;
  }

  try {
    const { data, error } = await state.supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', state.currentUserSession.user.id)
      .maybeSingle();

    if (error) throw error;
    state.subscription = data;
    updateSubscriptionUI();
  } catch (err) {
    console.error('Error checking subscription status:', err);
    state.subscription = null;
    updateSubscriptionUI();
  }
}

function updateSubscriptionUI() {
  const card = document.getElementById('subscription-card');
  const badge = document.getElementById('premium-status-badge');
  const desc = document.getElementById('premium-status-desc');
  const actionContainer = document.getElementById('premium-action-container');

  if (!card) return;

  if (!state.currentUserSession) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';

  const sub = state.subscription;
  const isPremiumActive = sub && (sub.status === 'active' || sub.status === 'trialing');

  if (isPremiumActive) {
    badge.textContent = 'Premium Active';
    badge.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    badge.style.color = '#fff';
    
    const nextBill = new Date(sub.current_period_end).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    desc.innerHTML = `Thank you for being a premium member! Your subscription status is <strong>${sub.status}</strong>. ${sub.cancel_at_period_end ? 'Expires' : 'Renews'} on: <strong>${nextBill}</strong>.`;

    actionContainer.innerHTML = `
      <button class="btn btn-outline" id="btn-manage-subscription" style="width: 100%; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px;">
        💳 Manage Subscription / Billing Portal
      </button>
    `;

    document.getElementById('btn-manage-subscription').addEventListener('click', async () => {
      try {
        const btn = document.getElementById('btn-manage-subscription');
        btn.textContent = 'Opening Customer Portal...';
        btn.disabled = true;

        const response = await fetch('/api/create-portal-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscriptionId: sub.id })
        });
        const resData = await response.json();
        if (resData.url) {
          window.location.href = resData.url;
        } else {
          alert('Failed to launch portal: ' + (resData.error || 'Unknown error'));
          btn.textContent = '💳 Manage Subscription';
          btn.disabled = false;
        }
      } catch (err) {
        console.error(err);
        alert('Failed to connect to billing portal.');
        const btn = document.getElementById('btn-manage-subscription');
        if (btn) {
          btn.textContent = '💳 Manage Subscription';
          btn.disabled = false;
        }
      }
    });
  } else {
    badge.textContent = 'Free Version';
    badge.style.background = 'rgba(255,255,255,0.08)';
    badge.style.color = 'var(--text-secondary)';
    
    desc.textContent = 'Access premium features like unlimited custom workout templates, PR tracking badges, streak achievements, and automatic cloud sync.';

    actionContainer.innerHTML = `
      <button class="btn btn-primary" id="btn-upgrade-premium" style="background: linear-gradient(135deg, #ec4899, #8b5cf6); border: none; width: 100%; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px;">
        🚀 Upgrade to Premium - $4.99/mo (7-day Trial)
      </button>
    `;

    document.getElementById('btn-upgrade-premium').addEventListener('click', async () => {
      try {
        const btn = document.getElementById('btn-upgrade-premium');
        btn.textContent = 'Preparing checkout...';
        btn.disabled = true;

        const response = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: state.currentUserSession.user.id,
            email: state.currentUserSession.user.email
          })
        });
        const resData = await response.json();
        if (resData.url) {
          window.location.href = resData.url;
        } else {
          alert('Failed to launch checkout: ' + (resData.error || 'Unknown error'));
          btn.innerHTML = '🚀 Upgrade to Premium - $4.99/mo (7-day Trial)';
          btn.disabled = false;
        }
      } catch (err) {
        console.error(err);
        alert('Failed to start checkout process.');
        const btn = document.getElementById('btn-upgrade-premium');
        if (btn) {
          btn.innerHTML = '🚀 Upgrade to Premium - $4.99/mo (7-day Trial)';
          btn.disabled = false;
        }
      }
    });
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

    // Deduplicate cloud workouts
    const cloudDates = new Map();
    const duplicateIdsToDelete = [];
    cloudWorkouts.forEach(cw => {
      cw.date = normalizeDate(cw.date);
      const key = `${cw.date}_${cw.workout_name}`;
      if (!cloudDates.has(key)) {
        cloudDates.set(key, cw);
      } else {
        duplicateIdsToDelete.push(cw.id);
      }
    });

    if (duplicateIdsToDelete.length > 0) {
      console.log(`Deleting ${duplicateIdsToDelete.length} duplicate workouts from cloud...`);
      const { error: delErr } = await state.supabaseClient
        .from('workouts')
        .delete()
        .in('id', duplicateIdsToDelete);
      if (delErr) {
        console.error('Failed to clean up duplicate cloud records:', delErr);
      }
    }

    // Deduplicate local workouts first
    deduplicateWorkoutHistory();

    const localDates = new Map();
    state.workoutHistory.forEach(lw => {
      lw.date = normalizeDate(lw.date);
      localDates.set(`${lw.date}_${lw.workoutName}`, lw);
    });

    let mergedCount = 0;

    // Add unique cloud workouts to local history
    cloudDates.forEach((cw, key) => {
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

    // Add unique local workouts to cloud
    const workoutsToUpload = [];
    state.workoutHistory.forEach(lw => {
      const key = `${lw.date}_${lw.workoutName}`;
      if (!cloudDates.has(key)) {
        workoutsToUpload.push({
          user_id: state.currentUserSession.user.id,
          date: lw.date,
          workout_name: lw.workoutName,
          duration: parseFloat(lw.duration || 1.0),
          exercises: lw.exercises
        });
      }
    });

    if (workoutsToUpload.length > 0) {
      const { error: uploadError } = await state.supabaseClient
        .from('workouts')
        .insert(workoutsToUpload);
      if (uploadError) throw uploadError;
      mergedCount += workoutsToUpload.length;
    }

    if (mergedCount > 0 || duplicateIdsToDelete.length > 0) {
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

  // Volume Metric Selector Setup
  const volMetricSelect = document.getElementById('setting-volume-metric');
  if (volMetricSelect) {
    volMetricSelect.value = state.settings.volumeMetric || 'lifetime';
    volMetricSelect.addEventListener('change', (e) => {
      state.settings.volumeMetric = e.target.value;
      saveStateToStorage();
      renderHistory();
    });
  }

  // CSV Export Button Setup
  const exportCsvBtn = document.getElementById('btn-export-csv');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', exportHistoryToCSV);
  }

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

  const summaryCloseBtn = document.getElementById('btn-summary-close');
  if (summaryCloseBtn) {
    summaryCloseBtn.addEventListener('click', () => {
      document.getElementById('workout-summary-modal').classList.add('hidden');
    });
  }

  const summaryShareBtn = document.getElementById('btn-summary-share');
  if (summaryShareBtn) {
    summaryShareBtn.addEventListener('click', () => {
      if (state.lastFinishedWorkout) {
        shareWorkoutSummary(state.lastFinishedWorkout);
      }
    });
  }

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
  const handleAuthRedirect = async () => {
    if (state.supabaseClient) {
      if (state.currentUserSession) {
        syncAllWorkoutsWithCloud();
      } else {
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
  };

  document.getElementById('btn-cloud-connect').addEventListener('click', handleAuthRedirect);
  document.getElementById('header-login-btn').addEventListener('click', handleAuthRedirect);

  document.getElementById('header-profile-badge').addEventListener('click', () => {
    showView('tab-settings');
  });

  const handleSignOut = async (e) => {
    if (e) e.stopPropagation();
    if (state.supabaseClient) {
      await state.supabaseClient.auth.signOut();
    }
    state.currentUserSession = null;
    saveStateToStorage();

    const statusEl = document.getElementById('cloud-sync-status');
    const connectBtn = document.getElementById('btn-cloud-connect');
    const disconnectBtn = document.getElementById('btn-cloud-disconnect');

    if (statusEl) statusEl.textContent = 'Status: Disconnected';
    if (disconnectBtn) disconnectBtn.classList.add('hidden');
    if (connectBtn) connectBtn.textContent = 'Connect & Sign in with Google';
    alert("Disconnected from cloud storage. Running local-only mode.");
  };

  document.getElementById('btn-cloud-disconnect').addEventListener('click', handleSignOut);

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

  // --- Color Gradient Accent Events ---
  document.querySelectorAll('.theme-swatch').forEach(sw => {
    sw.addEventListener('click', (e) => {
      const themeId = e.target.getAttribute('data-theme-id');
      applyGradientTheme(themeId);
      saveStateToStorage();
      renderProgressChart();
    });
  });

  // --- Exertion / RPE Click Listeners ---
  document.querySelectorAll('#session-rpe-container .rpe-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#session-rpe-container .rpe-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const rpeVal = parseInt(e.target.getAttribute('data-rpe'), 10);
      if (state.activeWorkout) {
        state.activeWorkout.rpe = rpeVal;
      }
      
      const hints = {
        1: "RPE 1: Extremely light effort, warm up weight",
        2: "RPE 2: Very light, easy speed work",
        3: "RPE 3: Light, fast speed work",
        4: "RPE 4: Moderate speed, warm up threshold",
        5: "RPE 5: Easy, multiple reps in reserve (>5)",
        6: "RPE 6: Moderate, 4 reps left in reserve",
        7: "RPE 7: Moderate-hard, 3 reps left in reserve",
        8: "RPE 8: Hard, 2 reps left in reserve",
        9: "RPE 9: Very hard, 1 rep left in reserve",
        10: "RPE 10: Maximum effort, absolute failure limit"
      };
      const hintEl = document.getElementById('rpe-label-hint');
      if (hintEl) hintEl.textContent = hints[rpeVal] || "";
    });
  });

  // --- Manual Deload Control ---
  const deloadBtn = document.getElementById('btn-trigger-manual-deload');
  if (deloadBtn) {
    deloadBtn.addEventListener('click', () => {
      const exName = document.getElementById('deload-exercise-select').value;
      if (confirm(`Are you sure you want to deload ${exName} by 10%?`)) {
        const currentW = state.currentWeights[exName] || DEFAULT_WEIGHTS[exName];
        const increment = state.settings.unit === 'kg' ? 2.5 : 5;
        let deloadedW = currentW * 0.9;
        deloadedW = Math.round(deloadedW / increment) * increment;
        state.currentWeights[exName] = deloadedW;
        saveStateToStorage();
        alert(`${exName} working weight decreased from ${currentW} to ${deloadedW}.`);
        checkDeloadRecommendation();
      }
    });
  }

  // --- Deload Warning Banner Handlers ---
  const applyDeloadBtn = document.getElementById('btn-apply-deload');
  if (applyDeloadBtn) {
    applyDeloadBtn.addEventListener('click', () => {
      const banner = document.getElementById('deload-alert-banner');
      const exName = banner.getAttribute('data-recommended-exercise');
      if (exName) {
        const currentW = state.currentWeights[exName] || DEFAULT_WEIGHTS[exName];
        const increment = state.settings.unit === 'kg' ? 2.5 : 5;
        let deloadedW = currentW * 0.9;
        deloadedW = Math.round(deloadedW / increment) * increment;
        state.currentWeights[exName] = deloadedW;
        saveStateToStorage();
        alert(`Deload applied! ${exName} working weight decreased from ${currentW} to ${deloadedW}.`);
        banner.classList.add('hidden');
      }
    });
  }

  const dismissDeloadBtn = document.getElementById('btn-dismiss-deload');
  if (dismissDeloadBtn) {
    dismissDeloadBtn.addEventListener('click', () => {
      document.getElementById('deload-alert-banner').classList.add('hidden');
    });
  }

  // --- Chart Overlay Toggles & Close ---
  const chartWeightCb = document.getElementById('chart-show-weight');
  if (chartWeightCb) chartWeightCb.addEventListener('change', renderProgressChart);
  const chartE1rmCb = document.getElementById('chart-show-e1rm');
  if (chartE1rmCb) chartE1rmCb.addEventListener('change', renderProgressChart);
  const chartVolumeCb = document.getElementById('chart-show-volume');
  if (chartVolumeCb) chartVolumeCb.addEventListener('change', renderProgressChart);
  const chartRepsCb = document.getElementById('chart-show-reps');
  if (chartRepsCb) chartRepsCb.addEventListener('change', renderProgressChart);
  
  const closeDetailsBtn = document.getElementById('btn-close-chart-details');
  if (closeDetailsBtn) {
    closeDetailsBtn.addEventListener('click', () => {
      document.getElementById('chart-point-details-card').classList.add('hidden');
    });
  }

  // --- Workout Customizer Modal Handlers ---
  let currentModalWorkout = 'Workout A';
  const addExA = document.getElementById('btn-add-ex-a');
  if (addExA) {
    addExA.addEventListener('click', () => {
      currentModalWorkout = 'Workout A';
      document.getElementById('add-exercise-modal').classList.remove('hidden');
    });
  }
  const addExB = document.getElementById('btn-add-ex-b');
  if (addExB) {
    addExB.addEventListener('click', () => {
      currentModalWorkout = 'Workout B';
      document.getElementById('add-exercise-modal').classList.remove('hidden');
    });
  }
  const modalCancel = document.getElementById('btn-modal-cancel');
  if (modalCancel) {
    modalCancel.addEventListener('click', () => {
      document.getElementById('add-exercise-modal').classList.add('hidden');
    });
  }
  const modalAdd = document.getElementById('btn-modal-add');
  if (modalAdd) {
    modalAdd.addEventListener('click', () => {
      const name = document.getElementById('modal-exercise-select').value;
      const sets = parseInt(document.getElementById('modal-sets-input').value, 10) || 5;
      const reps = parseInt(document.getElementById('modal-reps-input').value, 10) || 5;
      
      if (!state.settings.workoutTemplates) {
        state.settings.workoutTemplates = { 'Workout A': [], 'Workout B': [] };
      }
      state.settings.workoutTemplates[currentModalWorkout].push({ name, sets, reps });
      saveStateToStorage();
      
      document.getElementById('add-exercise-modal').classList.add('hidden');
      renderWorkoutTemplates();
      updateWorkoutSuggestion();
    });
  }

  // --- Notification Scheduler Setup ---
  const schedFrequency = document.getElementById('setting-reminder-frequency');
  const schedDaysSelector = document.getElementById('reminder-days-selector');
  if (schedFrequency) {
    schedFrequency.addEventListener('change', (e) => {
      if (!state.settings.schedule) state.settings.schedule = { frequency: '3x', days: [1, 3, 5] };
      state.settings.schedule.frequency = e.target.value;
      if (e.target.value === 'days') {
        schedDaysSelector.style.display = 'flex';
      } else {
        schedDaysSelector.style.display = 'none';
      }
      saveStateToStorage();
    });
  }

  document.querySelectorAll('#reminder-days-selector .day-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const day = parseInt(e.target.getAttribute('data-day'), 10);
      if (!state.settings.schedule) state.settings.schedule = { frequency: '3x', days: [1, 3, 5] };
      const days = state.settings.schedule.days || [];
      const index = days.indexOf(day);
      if (index > -1) {
        days.splice(index, 1);
        e.target.classList.remove('active');
      } else {
        days.push(day);
        e.target.classList.add('active');
      }
      state.settings.schedule.days = days.sort();
      saveStateToStorage();
    });
  });

  // Populate Schedule UI initially
  const sched = state.settings.schedule || { frequency: '3x', days: [1, 3, 5] };
  if (schedFrequency) schedFrequency.value = sched.frequency;
  if (schedDaysSelector) {
    schedDaysSelector.style.display = sched.frequency === 'days' ? 'flex' : 'none';
  }
  document.querySelectorAll('#reminder-days-selector .day-btn').forEach(btn => {
    const day = parseInt(btn.getAttribute('data-day'), 10);
    if (sched.days.includes(day)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Render template customizer lists
  renderWorkoutTemplates();

  // Initial runs
  updateWorkoutSuggestion();
  renderHistory();
  renderCalendar();
  checkDeloadRecommendation();

  // --- App Shortcut Intent Deep Link Handler ---
  const urlParams = new URLSearchParams(window.location.search);
  const action = urlParams.get('action');
  if (action === 'start_workout') {
    const lastWorkoutName = state.workoutHistory.length > 0 ? state.workoutHistory[0].workoutName : 'Workout B';
    const nextWorkoutName = lastWorkoutName === 'Workout A' ? 'Workout B' : 'Workout A';
    initWorkout(nextWorkoutName);
    showView('tab-workout');
  } else if (action === 'view_progress') {
    showView('tab-progress');
  }
});

// --- Template Customizer helpers ---
function renderWorkoutTemplates() {
  const listA = document.getElementById('template-a-exercises');
  const listB = document.getElementById('template-b-exercises');
  if (!listA || !listB) return;
  
  listA.innerHTML = '';
  listB.innerHTML = '';

  const templates = state.settings.workoutTemplates || { 'Workout A': [], 'Workout B': [] };

  templates['Workout A'].forEach((ex, idx) => {
    const row = document.createElement('div');
    row.className = 'template-ex-row';
    row.innerHTML = `
      <span class="template-ex-name" style="font-weight:600; font-size:0.9rem;">${ex.name}</span>
      <div class="template-ex-inputs" style="display:flex; align-items:center; gap:5px;">
        <input type="number" class="form-select form-select-sm" value="${ex.sets}" min="1" max="10" onchange="updateTemplateEx('Workout A', ${idx}, 'sets', this.value)" style="width: 50px; text-align: center; padding: 4px;">
        <span style="font-size:0.8rem; color:var(--text-secondary);">x</span>
        <input type="number" class="form-select form-select-sm" value="${ex.reps}" min="1" max="20" onchange="updateTemplateEx('Workout A', ${idx}, 'reps', this.value)" style="width: 50px; text-align: center; padding: 4px;">
      </div>
      <button class="history-delete-btn" onclick="deleteTemplateEx('Workout A', ${idx})">🗑️</button>
    `;
    listA.appendChild(row);
  });

  templates['Workout B'].forEach((ex, idx) => {
    const row = document.createElement('div');
    row.className = 'template-ex-row';
    row.innerHTML = `
      <span class="template-ex-name" style="font-weight:600; font-size:0.9rem;">${ex.name}</span>
      <div class="template-ex-inputs" style="display:flex; align-items:center; gap:5px;">
        <input type="number" class="form-select form-select-sm" value="${ex.sets}" min="1" max="10" onchange="updateTemplateEx('Workout B', ${idx}, 'sets', this.value)" style="width: 50px; text-align: center; padding: 4px;">
        <span style="font-size:0.8rem; color:var(--text-secondary);">x</span>
        <input type="number" class="form-select form-select-sm" value="${ex.reps}" min="1" max="20" onchange="updateTemplateEx('Workout B', ${idx}, 'reps', this.value)" style="width: 50px; text-align: center; padding: 4px;">
      </div>
      <button class="history-delete-btn" onclick="deleteTemplateEx('Workout B', ${idx})">🗑️</button>
    `;
    listB.appendChild(row);
  });
}

window.updateTemplateEx = function(workoutName, index, field, value) {
  const val = parseInt(value, 10);
  if (val > 0) {
    state.settings.workoutTemplates[workoutName][index][field] = val;
    saveStateToStorage();
    updateWorkoutSuggestion();
  }
};

window.deleteTemplateEx = function(workoutName, index) {
  state.settings.workoutTemplates[workoutName].splice(index, 1);
  saveStateToStorage();
  renderWorkoutTemplates();
  updateWorkoutSuggestion();
};
