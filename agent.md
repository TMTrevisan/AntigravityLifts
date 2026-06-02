# Developer Guidelines - AntigravityLifts

This document outlines state architecture, styling patterns, and configuration instructions for subsequent agents modifying this codebase.

## Application Architecture

The application is structured as a client-side Single Page Application (SPA). All state is kept in-memory and synchronized automatically to `localStorage` under specific keys:
- `sl_users`: List of user names.
- `sl_current_user`: Currently active profile.
- `sl_history`: History records grouped by user.
- `sl_weights`: Current base/starting weights for each exercise per user.

### State Model
```json
{
  "users": ["Todd", "Wife"],
  "currentUser": "Todd",
  "workoutHistory": {
    "Todd": [
      {
        "date": "2026-06-02",
        "workoutName": "Workout A",
        "duration": "1.00",
        "exercises": [
          { "name": "Squat", "weight": 115, "sets": [5, 5, 5, 5, 5] },
          { "name": "Bench Press", "weight": 100, "sets": [5, 5, 5, 5, 5] },
          { "name": "Barbell Row", "weight": 65, "sets": [5, 5, 5, 5, 5] }
        ]
      }
    ]
  },
  "currentWeights": {
    "Todd": { "Squat": 115, "Bench Press": 100, "Barbell Row": 65, "Overhead Press": 45, "Deadlift": 135 }
  }
}
```

## Design Guidelines

- **Vanilla CSS**: Do not introduce CSS frameworks like Tailwind without user direction.
- **Theme Variables**: All colors must use CSS variables mapping back to light and dark theme classes on the `body` tag (e.g. `.dark-theme` / `.light-theme`).
- **Responsive Layout**: Design layouts to scale on mobile screens, as users log workouts in real-time from mobile device viewports.

## Chart.js Configuration

- Line charts should use a smooth bezier curve (`tension: 0.3`).
- Clean visual grid lines using semi-transparent colors.
- Tooltips configured to show weight values combined with units dynamically.
