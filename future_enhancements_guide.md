# AntigravityLifts: Roadmap & Architecture Guide

This guide details the integration plans for cloud database storage, authentication, device health syncs, and additional premium feature recommendations to transition **AntigravityLifts** into a production-grade application.

---

## 1. Supabase & Google Authentication Integration

To allow users to access their workouts from any device and keep data isolated (so you and your wife have distinct databases), we recommend **Supabase**. It provides PostgreSQL database storage and built-in Google OAuth authentication out-of-the-box.

### Step 1: Supabase Setup
1. Create a free account at [Supabase](https://supabase.com).
2. Create a project named `AntigravityLifts`.
3. In the SQL Editor, create the following two tables:

```sql
-- Profiles table to store user settings
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  updated_at timestamp with time zone,
  unit text default 'lb',
  timer_enabled boolean default true,
  timer_duration integer default 180,
  current_weights jsonb
);

-- Workouts table to store history logs
create table workouts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  date date not null,
  workout_name text not null,
  duration numeric not null,
  exercises jsonb not null
);
```

### Step 2: Google OAuth Configuration
1. Go to the [Google Cloud Console](https://console.cloud.google.com).
2. Create a project and configure the OAuth consent screen.
3. Create Credentials -> **OAuth client ID** (Web application).
4. Add the Supabase redirect URI (found in your Supabase Project -> Settings -> Auth -> Site URL) to the Authorized redirect URIs.
5. In Supabase, enable Google Auth and copy over the Google Client ID and Secret.

### Step 3: Frontend SDK Integration
Load the Supabase CDN in `index.html`:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```
In `app.js`, initialize client and swap `localStorage` save/load methods with database queries:
```javascript
const supabase = supabase.createClient('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_ANON_KEY');

// Sign-In trigger
async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
  });
}

// Fetch user history from cloud
async function loadHistoryFromSupabase() {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .order('date', { ascending: false });
  if (data) state.workoutHistory = data;
}
```

---

## 2. Google Health Connect Sync (Android)

**Google Health Connect** allows AntigravityLifts to write workout duration, active calories burned, and exercise metadata directly to the user's Android health profiles.

### Integration Requirements
- **WebView Context / Native Wrapper**: Health Connect is a native Android API. A standard browser web-app cannot write directly to it. To make this work, you must wrap AntigravityLifts using a hybrid framework like **CapacitorJS** (Ionic) or **Tauri**, which builds the web-app code into a native Android APK package.
- **Permissions**: You must declare the following permissions in the native `AndroidManifest.xml`:
  ```xml
  <uses-permission android:name="android.permission.permission.WRITE_HEALTH_DATA_IN_PROGRESS" />
  ```
- **Code implementation**: Use the `@capacitor-community/health-connect` plugin in JavaScript to request permissions and write data when hitting "Finish Workout":
  ```javascript
  import { HealthConnect } from '@capacitor-community/health-connect';

  async function syncWorkoutToHealthConnect(workout) {
    const isAvailable = await HealthConnect.isProviderAvailable();
    if (!isAvailable.value) return;

    await HealthConnect.requestPermissions({
      read: [],
      write: ['ActiveCaloriesBurned', 'ExerciseSession']
    });

    await HealthConnect.writeRecords({
      records: [
        {
          type: 'ExerciseSession',
          startTime: new Date(workout.startTime).toISOString(),
          endTime: new Date().toISOString(),
          exerciseType: 'strength_training',
          title: workout.workoutName
        }
      ]
    });
  }
  ```

---

## 3. Recommended Production Enhancements

To make the app stand out and gain traction on social media, we recommend these additional interactive features:

1. **Audio Speech/Voice Cues**:
   - Integrate the browser's native **SpeechSynthesis API** to announce when a rest timer ends, or read out target weights: *"Next set: Squat at 135 pounds, load one 45 plate on each side"*.

2. **Progression Graph Customizations**:
   - Add **1-Rep Max Calculator** input widgets in the Progress tab.
   - Let users overlay target milestone lines on progress charts (e.g. "Road to 225 lb Squat").

3. **Rest Timer Sound Customizer**:
   - Let users pick different timer alerts (e.g. Ringing Bell, Boxing Bell, Digital Beep, Zen Chime).

4. **Lifting Rate-of-Perceived-Exertion (RPE) Logger**:
   - Add a slider or selector from 1-10 on completed sets so users can log how difficult the lift felt (RPE), which is a key metric in modern strength training.

5. **Barbell Velocity Tracker (Device Camera integration)**:
   - Use simple computer vision scripts to track the movement of barbell colors during lifts to report bar speed (velocity-based training).
