# Developer Guidelines - AntigravityLifts

This document outlines state architecture, cloud synchronization patterns, styling rules, and development guidelines for subsequent agents modifying this codebase.

## Application Architecture

The application is structured as a client-side Single Page Application (SPA). Global state is held in-memory in `app.js` and synchronized automatically to `localStorage` (for offline local-first use) and Supabase (for multi-device cloud backup when authenticated).

### Conserved Local Storage Keys
- `al_history`: Local historical workouts.
- `al_weights`: Local active working weight thresholds.
- `al_settings`: Visual preferences, timer parameters, and units.

### Cloud Synchronization Architecture
- **Provider**: Supabase DB (PostgreSQL) + Google OAuth (provider `google`).
- **Database Schema**:
  - `workouts` table:
    * `id` (uuid, primary key)
    * `user_id` (uuid, reference to `auth.users`)
    * `date` (date)
    * `workout_name` (text)
    * `duration` (numeric)
    * `exercises` (jsonb)
- **Security Constraints**: Row Level Security (RLS) is strictly enabled on the backend (`auth.uid() = user_id`). Client code uses the public `anon` credentials to query but can only see rows belonging to their signed-in identity.
- **Batch Processing Optimization**: Full syncs and CSV imports do NOT execute queries in a loop. They collect payloads and run single-request batch inserts (`supabase.from('workouts').insert(array)`) to avoid connection timeouts and UI hangs.

---

## State Model

The runtime state structure in `app.js`:
```javascript
let state = {
  workoutHistory: [], // Array of workout objects
  currentWeights: {
    'Squat': 45,
    'Bench Press': 45,
    'Barbell Row': 65,
    'Overhead Press': 45,
    'Deadlift': 135
  },
  activeWorkout: null, // Workout in-progress details
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
  chartInstance: null, // Chart.js render instance
  supabaseClient: null, // Supabase SDK client instance
  currentUserSession: null // Supabase active session metadata
};
```

---

## Styling & Responsive Layout Rules

- **Vanilla CSS**: Avoid importing styling frameworks. Adjust variables and utility tokens inside `styles.css`.
- **Media Query Layouts**:
  - Keep the app layout container centered and restricted to a max-width of `650px` for optimal viewing on desktop and tablets.
  - On screens under `650px` (mobile):
    * Hide the profile text name (`.profile-name`) and the header log-out button (`#header-signout-btn`) in the header to save space.
    * Display only the circular Google profile picture or avatar icon.
    * Route profile badge clicks on mobile to open the **Settings** view, which displays full profile connection details and log-out controls.
