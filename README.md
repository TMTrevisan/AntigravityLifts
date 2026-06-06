# AntigravityLifts - Premium StrongLifts 5x5 Tracker

**AntigravityLifts** is a premium, client-side Single Page Application (SPA) workout logger designed to track the StrongLifts 5x5 routine. Engineered using vanilla HTML, CSS, and JS, it provides local-first storage, dynamic plate visualizers, progressive warmup calculations, and cloud-synchronized multi-device logging via Google Sign-In.

---

## Key Features

- **Workout Logger**: Track Workout A (Squat, Bench Press, Barbell Row) and Workout B (Squat, Overhead Press, Deadlift). Tapping set circles toggles states (Complete/Fail/Incomplete) with weight increments applied automatically on success.
- **Supabase Cloud Sync & Google Auth**: Log in securely using Google OAuth. Sync workouts automatically across multiple devices while keeping user databases isolated and private via Row Level Security (RLS).
- **Batch-Processing Sync Engine**: Engineered for optimal speed. Sync workflows and CSV file imports use bulk database inserts (`insert([array])`), avoiding sequential loop requests for instant load times.
- **Dynamic Plate Barbell Calculator**: Tap target weights on active exercises to display an interactive visualizer mapping exactly which color-coded plates (complying with international lifting standards) to load on each side of the barbell.
- **Warmup Progression Generator**: Toggle between working sets and warmup sets. Generates calculated warmups starting with an empty barbell and building up to target thresholds, complete with automated 60-second rest intervals.
- **Chart.js Progress Analytics**: Visual dashboards showing Lift Weight, volume, total reps, and estimated 1-Rep Max (e1RM) with selectable time ranges (1M to Max).
- **Responsive Header (Mobile-First)**: Hides layout-heavy elements (like name tags and sign-out controls) in the header on mobile viewports, leaving a compact circular profile avatar that links directly to the **Settings** view for account management.
- **PWA & Offline Gym Ready**: Completely offline-capable using a custom Progressive Web App service worker cache. Install it as a standalone app shortcut on iOS or Android.

---

## Tech Stack

- **Core**: Semantic HTML5, Vanilla CSS3 (Custom design tokens, glassmorphism templates, flexible grids)
- **Logic**: Vanilla ES6+ JavaScript (State management machine)
- **Libraries**: Chart.js (CDN-loaded progress visualizations), Supabase JS Client v2 (CDN-loaded DB connection)

---

## Installation & Local Development

### 1. Spin up locally
To run without CORS errors while reading local PWA icons and service worker scripts, launch a local web server:
```bash
# Using Python
python3 -m http.server 8000
```
Navigate to `http://localhost:8000`.

### 2. Configure Database Tables
If deploying your own backend instance, run the creation queries detailed in [future_enhancements_guide.md](future_enhancements_guide.md) in the Supabase SQL editor to create the `workouts` and `profiles` tables and enable RLS policies.

---

## Deployment

AntigravityLifts is static and zero-config:
1. Push changes to GitHub.
2. Link your repository to **Vercel**.
3. Vercel automatically deploys the directory. Ensure redirect URLs in the Supabase OAuth dashboard point to your Vercel domain.
