# Pulse - NEET PG planner

A responsive, dependency-free personal study planner.

## Run

Requires Node.js 18 or newer.

```sh
npm start
```

Open http://localhost:3000. Use `PORT=3001 npm start` for a different port.
The server binds to localhost by default.

## Publish online with GitHub Pages

The app is entirely static: no installation, build, server, or API keys are
needed for hosting. Asset links support GitHub Pages repository subpaths.

1. Open this repository on GitHub.
2. For free GitHub Pages hosting, make the repository public under **Settings >
   General > Danger Zone > Change repository visibility**. Private repository
   Pages hosting requires an eligible paid GitHub plan.
3. Go to **Settings > Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the **main** branch and **/ (root)** folder, then click **Save**.
6. Wait for GitHub's Pages deployment to finish. The site will be available at
   **https://pulkit25121997.github.io/neet-pg-planner/**.

These are publication instructions; creating the repository does not publish
the app automatically. The source will be public if you change visibility, but
personal study tasks are stored in the user's browser, not in this repository.
Export a backup before moving from localhost to the hosted site: browser data
does not automatically transfer between these addresses.

## Features

- Add, edit, complete, filter, and remove dated study tasks across all 19 NEET PG subjects.
- Browse weekly schedules with overlap and overnight-task validation.
- Generate revision/MCQ study blocks with 15-minute breaks around existing tasks.
- Track completed task hours, active study days, and subject task completion.
- Set a personal target date and daily study goal. No official exam date is assumed.
- Use a 25-minute focus timer and 5/15-minute breaks. Timer countdown uses wall-clock time when a tab is backgrounded; it resets on page reload.
- Download and restore JSON backups. Restoring merges tasks by ID, keeps existing tasks when IDs match, merges focus sessions, and applies the backup's settings.

## Data and privacy

No account, analytics, backend database, external fonts, or third-party requests.
Plans and completed focus sessions are stored in localStorage for this browser
and origin. Clearing browser data removes them; download backups regularly.
The planner does not automatically sync devices. Avoid editing in multiple tabs
at once; a warning appears if another tab changes the saved plan.
Subject progress measures completed planned tasks, not medical syllabus mastery.

## Tests

```sh
npm test
```

Core tests cover calendar boundaries, schedule overlaps, automatic plan creation,
and task validation.
