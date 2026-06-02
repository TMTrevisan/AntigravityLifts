# AntigravityLifts - StrongLifts 5x5 Clone

A premium, client-side Single Page Application (SPA) that clones the core features of the StrongLifts 5x5 app. Built with vanilla HTML, CSS, and JS, featuring a dark/light theme, progress dashboards, rest timer, local multi-user support, and CSV history importer.

## Features

- **Workout Logger**: Log Workout A (Squat, Bench Press, Barbell Row) and Workout B (Squat, Overhead Press, Deadlift). Automatically increments weights (+5 lb / +10 lb for Deadlift) on success.
- **Progress Charts**: Interactive dashboards powered by Chart.js. Visualizes weight, estimated 1-Rep Max (e1RM), total volume, or total reps across multiple timeframes (1m, 3m, 6m, 1y, 2y, max).
- **Rest Timer**: Integrated timer triggers automatically after logging sets, complete with manual controls and synthesized sound alerts.
- **Settings Panel**: Customize unit weights (lb/kg), toggle timer options, switch dark/light modes, configure reminders, and manage multi-user local profiles.
- **CSV Data Importer**: Import raw CSV outputs matching standard fitness app templates.
- **PWA Ready**: Install as a mobile app directly on your phone home screen using Progressive Web App standard.

## Technologies Used

- HTML5 (Semantic shell, dialog inputs)
- CSS3 (Vanilla design tokens, CSS variables, glassmorphism, responsive grids)
- JavaScript (ES6+ client-side state)
- Chart.js (Interactive graphs via CDN)

## Running Locally

1. Open `index.html` directly in any web browser.
2. Or spin up a local server:
   ```bash
   python3 -m http.server 8000
   ```
   Navigate to `http://localhost:8000`.

## Deployment to Vercel

This is a zero-config static site:
1. Push the code to GitHub.
2. Link the repository to Vercel.
3. Vercel will automatically build and deploy the root directory as a static site.
