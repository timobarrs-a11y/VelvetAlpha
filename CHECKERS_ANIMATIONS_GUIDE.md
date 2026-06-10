# Checkers Animations Visual Guide

## Animation Types & When They Trigger

### 1. Walk Animation (60% of normal moves)
```
Trigger: Player moves piece without capturing
Path: Straight line with subtle up-down bounce
Duration: 600ms
Visual: Piece appears to walk/glide across board
Easing: Ease-in-out for natural motion
```

### 2. Flip Animation (40% of normal moves)
```
Trigger: Player moves piece without capturing
Path: Straight line with 720° rotation
Duration: 900ms
Visual: Piece spins twice while moving
Easing: Smooth rotation throughout
Feeling: Playful, confident
```

### 3. Fly Animation (100% of capturing moves)
```
Trigger: Piece captures opponent
Path: Curved arc above board
Duration: 800ms
Visual: Piece launches in parabolic path with rotation
Peak Height: ~120px above board
Easing: Cubic ease-in-out
Feeling: Aggressive, powerful
```

### 4. Capture Animation (Every piece taken)
```
Trigger: Piece is removed from board
Path: In-place rotation
Duration: 700ms
Visual: Piece spins while shrinking and fading
Scale: 1.0 → 0.7
Opacity: 1.0 → 0.0
Feeling: Defeated, explosion effect
```

### 5. Bounce Animation (Piece becomes king)
```
Trigger: Piece reaches back row
Path: Vertical bounces with rotation
Duration: 500ms
Visual: Piece bounces 3-4 times, rotating
Height: 20px bounce each time
Easing: Spring-like motion
Feeling: Celebratory, achievement
```

### 6. Victory Animation (Reserved)
```
Trigger: Could trigger on multi-jumps
Path: Floating with spiraling motion
Duration: 1200ms
Visual: Piece floats up and spins in place
Height: Gradually increases
Feeling: Triumphant, special moment
```

## Animation Sequences

### Normal Move
```
Player clicks → Piece selected
Player clicks target → Animate walk/flip → Board updates → Next turn
                       600-900ms
```

### Capture Move
```
Player clicks target with capture → Animate fly + capture(s) → Bounce if promotion → Board updates
                                    800ms + 700ms each + 500ms
```

### Multi-Capture (future)
```
Jump 1: Animate fly → Capture animation
Jump 2: Wait 100ms → Animate fly → Capture animation
Jump 3: Wait 100ms → Animate fly → Capture animation
Promote: Bounce animation
Then: Board updates
```

## Animation Parameters

### Walk Animation
- Start: Piece starting position
- End: Piece target position
- Frame count: 11 frames (0-10)
- Scale: 1.0 (constant)
- Rotation: 0° (constant)

### Flip Animation
- Rotation: 0° → 720° (2 full rotations)
- Scale: 1.0 + sin(t) * 0.15 (slight pulsing)
- Path: Straight line
- Total frames: 15

### Fly Animation
- Path: Quadratic Bézier curve (parabolic)
- Control point: Center X, -120px Y
- Rotation: 0° → 360° (1 full rotation)
- Scale: 1.0 + sin(t) * 0.2 (pulsing effect)
- Total frames: 13

### Capture Animation
- Center: Piece position (no movement)
- Rotation: 0° → 540° (1.5 rotations)
- Scale: 1.0 → 0.7
- Opacity: 1.0 → 0.0
- Bounce: sin(t * π * 3) * (1 - t) * 0.3

## Performance Considerations

### Animation Rendering
- Animations use Framer Motion for GPU acceleration
- `transform` and `opacity` changes only (no layout thrashing)
- Separate layer prevents board reflow
- 60fps target on modern devices

### Bundle Impact
- Animation engine: ~3 KB
- Board component updates: <1 KB
- Game page updates: ~1.5 KB
- **Total impact: ~4.5 KB gzipped**

### Timing Budget
- Walk: 600ms
- Flip: 900ms
- Fly: 800ms
- Capture: 700ms (per piece)
- Bounce: 500ms
- **Max sequence: ~2.5s for multi-capture promotion**

## User Experience Flow

### Move Sequence
1. **0ms**: Player makes selection
2. **0ms**: Animation starts
3. **500-900ms**: Visual feedback (piece moving/spinning)
4. **700-900ms**: Any captures animate out
5. **500ms**: King promotion bounce (if applicable)
6. **+200ms buffer**: Board state updates invisibly
7. **Next turn**: Ready for next move

### Feedback Timeline
- **Immediate**: Visual response to piece movement
- **During animation**: Can see capture "defeats"
- **After animation**: Board reflects final state
- **Throughout**: Chat companion reacts

## Customization Points

### Adjust Animation Speed
```typescript
// In checkersAnimationEngine.ts
generateWalkAnimation(from, to) {
  duration: 400, // Faster
  // or
  duration: 800, // Slower
}
```

### Change Animation Style
```typescript
// Add custom easing
const easeT = Math.pow(t, 3); // Cubic
// or custom function
const easeT = t < 0.5 ? 2*t*t : -1+(4-2*t)*t; // Current
```

### Add New Animation Type
```typescript
generateCustomAnimation(from, to) {
  const frames = [];
  for (let i = 0; i <= frameCount; i++) {
    frames.push({
      x: customX(i/frameCount),
      y: customY(i/frameCount),
      rotation: customRotation(i/frameCount),
      scale: customScale(i/frameCount),
      opacity: customOpacity(i/frameCount),
    });
  }
  return { type: 'custom', fromPos: from, toPos: to, duration: 700, frames };
}
```

## Browser Compatibility
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (iOS 12+)
- Mobile browsers: Full support with 60fps

## Sound Integration (Ready to add)
Each animation has reserved sound property:
```typescript
walk: 'piece-move',
fly: 'piece-fly',
flip: 'piece-flip',
capture: 'piece-capture',
bounce: 'piece-bounce',
victory: 'piece-victory'
```

Can easily integrate audio context to play these sounds.
