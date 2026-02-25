# Quick Task 2: Update Color Scheme — Green to Soft Blue

## Goal
Replace all green accent colors with a soft blue palette for better accessibility and contrast, especially for users with glasses or color vision deficiency.

## Color Mapping

| Token | Old (Green) | New (Blue) |
|-------|-------------|------------|
| accent | `#5B8C5A` | `#4A7FB5` |
| accent-light | `#7DB87C` | `#6BA3D6` |
| accent-dark | `#3D6B3C` | `#365F8C` |
| accent-subtle | `rgba(91, 140, 90, 0.12)` | `rgba(74, 127, 181, 0.12)` |
| tag-bg (dark) | `rgba(91, 140, 90, 0.25)` | `rgba(74, 127, 181, 0.25)` |
| tag-text (dark) | `#a3d4a2` | `#8DC4F0` |
| tag-text (light) | `#2d5a2c` | `#2A5278` |
| admin message dot | `#4caf50` | `#5C9FD0` |
| admin mini-app badge bg | `rgba(76,175,80,0.15)` | `rgba(92,159,208,0.15)` |
| admin mini-app badge text | `#4caf50` | `#5C9FD0` |

## Tasks

### Task 1: Update CSS variables (variables.css)
- **files:** `mini-app/src/theme/variables.css`
- **action:** Replace all green hex values and rgba values with blue equivalents per mapping table above
- **verify:** `grep -c "5B8C5A\|7DB87C\|3D6B3C\|a3d4a2\|2d5a2c\|91, 140, 90" mini-app/src/theme/variables.css` returns 0
- **done:** All CSS custom properties use blue palette

### Task 2: Update TypeScript tokens and ThemeContext
- **files:** `mini-app/src/theme/tokens.ts`, `mini-app/src/theme/ThemeContext.tsx`
- **action:** Replace green hex values with blue equivalents in both files
- **verify:** `grep -c "5B8C5A\|7DB87C\|3D6B3C\|91, 140, 90" mini-app/src/theme/tokens.ts mini-app/src/theme/ThemeContext.tsx` returns 0
- **done:** TypeScript color exports and inline theme overrides use blue palette

### Task 3: Update Admin.tsx hardcoded greens
- **files:** `mini-app/src/pages/Admin.tsx`
- **action:** Replace `#4caf50` → `#5C9FD0` and `rgba(76,175,80,0.15)` → `rgba(92,159,208,0.15)` in event dot colors and source badge
- **verify:** `grep -c "4caf50\|76,175,80" mini-app/src/pages/Admin.tsx` returns 0
- **done:** Admin page uses blue for message dots and mini-app badges
