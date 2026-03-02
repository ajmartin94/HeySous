---
created: 2026-02-28T17:00:05.959Z
title: Fix mini app layout for large screens
area: ui
files:
  - mini-app/src/App.tsx
  - mini-app/src/index.css
---

## Problem

On larger screens like iPad, the mini app stretches to fill the entire window width, making the layout look awkward and hard to use. Content becomes too spread out and the UI loses its mobile-optimized feel.

## Solution

Add responsive CSS to constrain the mini app to a reasonable max-width on larger viewports (e.g., `max-width: 480px` or similar mobile-width cap) and center it. Consider a container wrapper with appropriate breakpoints so the app looks intentional on tablets and desktops while preserving the mobile-first design.
