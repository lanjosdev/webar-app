# AGENTS.md

## Project Goal

Build a minimal and production-oriented WebAR prototype using:

- TypeScript
- Vite
- Three.js
- 8th Wall Engine
- 8th Wall World Tracking / SLAM

Primary target environment:

- Safari on iPhone
- supported mobile browser on Android, with Chrome as the initial validation target
- rear camera
- HTTPS
- mobile-first experience

The initial objective is to validate reliable World Tracking and simple object placement before adding application complexity.

---

## Primary Milestone

The first milestone is complete only when all of the following work on both a real iPhone using Safari and a representative real Android device using a browser supported by the current 8th Wall Engine:

1. The 8th Wall Engine loads correctly.
2. The SLAM functionality required for World Tracking loads correctly.
3. Rear camera access works.
4. World Tracking starts successfully.
5. Three.js is integrated with the 8th Wall camera pipeline.
6. A basic 3D object can be rendered.
7. The object remains spatially coherent while the user moves the device.
8. The experience runs over HTTPS.
9. The application handles initialization and camera errors clearly.

Do not add React, GLTF assets, physics, analytics, CMS integration, or advanced UI before this milestone works.

---

# Source of Truth

Before implementing, changing, or assuming any 8th Wall API behavior, consult the current official documentation.

Local project reference:

- `docs/8thwall-webar-world-tracking-research-flow.md`

Official sources, in priority order:

1. https://8thwall.org/docs
2. https://8thwall.org/docs/getting-started
3. https://8thwall.org/docs/engine
4. https://8thwall.org/docs/engine/overview
5. https://8thwall.org/docs/api/engine
6. https://8thwall.org/docs/api/engine/threejs
7. https://8thwall.org/docs/api/engine/xrcontroller/configure
8. https://8thwall.org/docs/api/engine/xr8/run
9. https://8thwall.org/docs/troubleshooting/world-tracking-issues
10. https://8thwall.org/docs/engine/release-notes
11. https://github.com/8thwall

Prefer official documentation and examples over model memory.

If an API cannot be confirmed in current official documentation, do not invent it.

---

# Important 8th Wall Context

The hosted 8th Wall platform was retired in 2026.

Do not automatically use implementation patterns from older tutorials targeting the previous hosted platform.

The current project should use the current 8th Wall Engine workflow.

World Tracking depends on the SLAM capabilities distributed with the current Engine.

Verify the current installation and loading mechanism before implementation.

---

# Do Not Mix WebXR APIs Accidentally

8th Wall World Tracking is not equivalent to native WebXR Hit Test or Plane Detection.

Do not introduce APIs such as:

```ts
navigator.xr;
session.requestHitTestSource();
XRHitTestResult;
```

unless the task explicitly requires WebXR.

This project should initially use the 8th Wall Engine tracking system.

Never invent methods such as:

```ts
XR8.hitTest();
XR8.detectPlane();
XR8.createAnchor();
```

unless those exact APIs are confirmed in current official documentation.

---

# Surface / Plane AR Terminology

Do not assume that "Surface AR" means ARKit-style multi-plane detection.

For this project, the initial Surface/World Tracking experience should target the capabilities actually exposed by 8th Wall World Tracking.

The first implementation goal is:

```text
Camera
  ↓
SLAM / World Tracking
  ↓
tracked world
  ↓
horizontal world/ground positioning
  ↓
user placement
  ↓
stable Three.js object
```

If requirements evolve toward:

- multiple planes;
- wall detection;
- table detection;
- semantic scene understanding;
- persistent anchors;

verify current 8th Wall support before implementing.

---

# Technology Stack

Initial stack:

```text
Vite
TypeScript
Three.js
8th Wall Engine
```

Do not add React initially.

React may be added after the AR pipeline is validated.

---

# Architecture

Keep the AR implementation isolated.

Recommended structure:

```text
src/
├── main.ts
│
├── ar/
│   ├── engine/
│   │   ├── init8thWall.ts
│   │   ├── pipeline.ts
│   │   └── engineTypes.ts
│   │
│   ├── three/
│   │   ├── scene.ts
│   │   ├── lighting.ts
│   │   └── objects.ts
│   │
│   ├── tracking/
│   │   ├── trackingState.ts
│   │   └── trackingEvents.ts
│   │
│   └── world/
│       ├── placement.ts
│       └── coordinates.ts
│
├── ui/
│   ├── status.ts
│   └── errors.ts
│
└── styles/
    └── global.css
```

The exact structure may change if there is a strong technical reason, but preserve separation between:

- Engine initialization
- 8th Wall camera pipeline
- Three.js scene
- tracking state
- world placement
- application UI

---

# Three.js Integration

Prefer the official 8th Wall integration with Three.js.

Research and validate the current usage of:

```text
XR8.Threejs
```

and its pipeline module before implementation.

Do not create a completely separate camera/render pipeline if the official Three.js integration already provides the required behavior.

---

# Camera Pipeline

Understand the current 8th Wall camera pipeline before customizing it.

Research the current official usage of components such as:

```text
XR8.GlTextureRenderer
XR8.Threejs
XR8.XrController
XR8.run
```

Only use APIs confirmed in current documentation.

The rear camera is the primary target for World Tracking.

---

# SLAM / World Tracking

World Tracking must remain enabled.

Verify the current default and configuration options for:

```ts
XR8.XrController.configure(...)
```

Do not disable World Tracking.

Verify how the current Engine requires the SLAM component/chunk to be loaded.

Do not assume an old loading pattern is still correct.

---

# Initialization Order

The application should use an explicit initialization flow similar to:

```text
Page loaded
   ↓
Engine loading
   ↓
SLAM capability ready
   ↓
Three.js / pipeline setup
   ↓
camera request
   ↓
XR8.run
   ↓
tracking initialization
   ↓
tracking ready
```

Avoid race conditions.

Do not call `XR8.run()` until required modules and configuration are ready.

---

# Error Handling

Handle at least:

```text
ENGINE_LOAD_ERROR
CAMERA_PERMISSION_DENIED
CAMERA_UNAVAILABLE
UNSUPPORTED_BROWSER
TRACKING_INITIALIZATION_ERROR
UNKNOWN_AR_ERROR
```

Errors should be visible to the user and logged with enough detail for debugging.

Do not silently fail.

---

# Tracking State

Use an explicit tracking state model.

Recommended high-level states:

```ts
type ARState =
  | "idle"
  | "loading-engine"
  | "requesting-camera"
  | "tracking-initializing"
  | "tracking-ready"
  | "tracking-limited"
  | "object-placed"
  | "error";
```

Do not update application UI state on every camera frame.

Only propagate meaningful state transitions.

---

# First Visual Test

The first rendered object should be a simple primitive such as:

```text
THREE.BoxGeometry
```

Do not use GLTF/GLB for the first milestone.

Add only minimal lighting necessary to evaluate spatial behavior.

The objective is to observe tracking stability, not visual quality.

---

# Placement

Implement placement only after World Tracking is working.

Before implementing touch-to-world conversion:

1. Search current official 8th Wall documentation.
2. Search official examples.
3. Verify what spatial information the Engine exposes.
4. Determine the correct supported placement technique.
5. Document the approach in code comments or project documentation.

Do not simulate plane detection using undocumented assumptions.

---

# React Rule

React should not be introduced before the AR pipeline works.

When React is eventually introduced:

React owns:

- onboarding;
- menus;
- buttons;
- loading UI;
- status messages;
- application-level state.

8th Wall + Three.js own:

- camera updates;
- pose;
- scene transforms;
- frame processing;
- rendering;
- AR tracking.

Never send camera pose or object transforms through React state every frame.

---

# Performance Rules

Mobile performance is a first-class requirement.

Avoid:

- unnecessary allocations per frame;
- large textures;
- excessive draw calls;
- complex post-processing;
- expensive real-time shadows;
- React re-renders per frame;
- loading large assets during critical camera startup.

After the basic POC works, measure:

- FPS;
- memory usage;
- device temperature;
- tracking stability;
- startup time;
- recovery after tracking loss.

---

# iOS and Android Testing

Desktop testing is not sufficient.

The milestone must be tested on both platforms:

```text
real iPhone
+
Safari
+
rear camera
+
HTTPS

and

real Android device
+
supported mobile browser (Chrome is the initial target)
+
rear camera
+
HTTPS
```

Before selecting minimum OS or browser versions, verify the current 8th Wall Engine compatibility documentation. Do not assume that all Android devices, browsers, camera implementations, or GPU combinations behave equivalently.

Test different environments:

- well-lit textured floor;
- low-texture floor;
- low lighting;
- reflective surface;
- rapid movement;
- slow movement.

On Android, also test at least one mid-range device when available and record the device model, Android version, browser version, startup time, tracking stability, and any camera or GPU-specific issue.

---

# Local Mobile Development

Camera access and mobile WebAR testing should use HTTPS.

The expected workflow is approximately:

```text
Vite dev server
   ↓
HTTPS tunnel
   ↓
public HTTPS URL
   ↓
Safari on iPhone or a supported browser on Android
```

ngrok or another suitable HTTPS tunnel may be used.

Document the exact workflow in the README.

---

# Development Workflow

Work incrementally.

For every task:

1. inspect existing project structure;
2. read relevant documentation;
3. implement the smallest correct change;
4. run TypeScript checks;
5. run the production build;
6. fix errors;
7. summarize changed files;
8. explain how to test the result.

Do not combine many unrelated features into one change.

---

# Validation Commands

Before declaring a task complete, run the relevant project commands.

At minimum:

```bash
npm run build
```

If a dedicated TypeScript command exists:

```bash
npm run typecheck
```

Also run lint when configured.

Do not report success if build/typecheck fails.

---

# Code Quality

Use:

- TypeScript strict typing when practical;
- small modules;
- explicit lifecycle management;
- clear error messages;
- cleanup functions;
- descriptive names.

Avoid:

- giant `main.ts`;
- excessive globals;
- `any` without justification;
- hidden side effects;
- undocumented magic numbers.

---

# Documentation

When implementing an important 8th Wall integration, document:

```text
API used:
Official source:
Why it is used:
Relevant version/date:
Known limitations:
```

This is especially important for:

- Engine loading;
- SLAM loading;
- XrController configuration;
- pipeline modules;
- placement;
- tracking state.

---

# Research Rule

If uncertain about an 8th Wall API:

```text
STOP
 ↓
Search official docs
 ↓
Search API reference
 ↓
Search official examples
 ↓
Check release notes
 ↓
Check troubleshooting
 ↓
Implement
```

Do not guess.

---

# Current Development Roadmap

The intended order is:

```text
1. Project setup
2. 8th Wall Engine loading
3. SLAM loading
4. Camera
5. XR8 pipeline
6. Three.js integration
7. Basic cube
8. World Tracking validation
9. iPhone Safari and Android browser validation
10. Tracking state UX
11. Placement
12. GLB loading
13. Interaction
14. React UI
15. Production optimization
```

Do not jump ahead unless explicitly requested.

---

# Definition of Done for Initial POC

The initial POC is complete when:

- 8th Wall Engine loads successfully;
- World Tracking initializes;
- rear camera works;
- Three.js renders through the AR pipeline;
- a simple object appears in the tracked world;
- the object remains reasonably stable during device movement;
- the app works in Safari on a real iPhone;
- the app works in a supported browser on a representative real Android device;
- the application is served through HTTPS;
- errors are handled;
- build and typecheck pass;
- setup/testing instructions exist in README.

Only then proceed to advanced Surface AR placement and product features.
