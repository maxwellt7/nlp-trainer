# Mobile Layout Audit & Fixes

## Issues Found

### 1. **Chat Input Hidden Behind Keyboard (Critical)**
**Location:** `src/pages/Hypnosis.tsx`, `src/components/Chat.tsx`
**Problem:** When the on-screen keyboard appears, the input textarea and send button are hidden behind it, especially in iOS Safari standalone PWA mode.
**Root Cause:** Fixed positioning without accounting for visual viewport changes

### 2. **Viewport Height Issues**
**Location:** `src/components/rd/AppShell.tsx`, `src/index.css`
**Problem:** iOS standalone PWA can report incorrect viewport heights, leaving dead space at the bottom
**Current State:** Partially addressed but can be improved

### 3. **Input Zoom on Focus (iOS)**
**Location:** Multiple input/textarea elements
**Problem:** iOS Safari zooms in when font-size < 16px, disrupting the layout
**Impact:** Unwanted zoom breaks the fixed layout

### 4. **Safe Area Insets**
**Location:** Chat input forms, bottom navigation
**Problem:** Inconsistent safe-area-inset handling, especially on notched devices
**Impact:** Content can be hidden behind home indicator or notch

### 5. **Scroll Jumping**
**Location:** Chat containers
**Problem:** When keyboard appears/disappears, scroll position jumps unexpectedly
**Impact:** Poor UX, loses context

### 6. **Tap Target Sizes**
**Location:** Various buttons and controls
**Problem:** Some tap targets are smaller than the recommended 44x44px
**Impact:** Difficult to tap accurately on mobile

### 7. **Console Errors**
**To be checked:** Browser console for any runtime errors

## Fixes Applied

### Fix 1: Dynamic Viewport Height for Chat Input
- Monitor `visualViewport` changes to reposition input above keyboard
- Use `position: fixed` with dynamic bottom positioning
- Ensure send button always visible when keyboard is open

### Fix 2: Prevent Input Zoom
- Set `font-size: 16px` minimum on all inputs/textareas
- Add `touch-action: manipulation` to prevent double-tap zoom

### Fix 3: Improved Safe Area Handling
- Use `env(safe-area-inset-bottom)` consistently
- Add extra padding when keyboard is open

### Fix 4: Better Scroll Management
- Lock scroll position when keyboard opens
- Smooth scroll to bottom after keyboard appears
- Prevent overscroll bounce during typing

### Fix 5: Enhanced Tap Targets
- Ensure all interactive elements are at least 44x44px
- Add larger touch areas for small buttons

### Fix 6: Keyboard Resize Handling
- Listen to visualViewport resize events
- Adjust layout dynamically as keyboard opens/closes
- Maintain scroll position relative to bottom

## Testing Checklist

- [ ] iOS Safari standalone PWA mode
- [ ] iOS Safari in-browser mode
- [ ] Android Chrome PWA mode
- [ ] Various iPhone sizes (SE, standard, Pro Max)
- [ ] Various Android sizes
- [ ] Landscape orientation
- [ ] Keyboard appearance/disappearance
- [ ] Input focus/blur
- [ ] Send button always reachable
- [ ] No zoom on focus
- [ ] Safe areas respected
- [ ] Smooth scrolling
