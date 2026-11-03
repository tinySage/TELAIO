# Workstation and Workspace Specification

## Global workstation
A persistent CAD-style shell with a compact header, left assembly navigator, central 3D viewport, right contextual inspector and optional bottom command/task strip. The viewport must remain the dominant region. Panels should adapt to the active task rather than showing every tool simultaneously.

## 1. Vehicle / Assembly Explorer
- Full vehicle in a large viewport.
- Assembly tree grouped by major systems: aerodynamics, chassis, powertrain, suspension, braking, wheels/tyres, steering and controls.
- Orbit, pan, zoom, fit, standard views, isolate, hide/show.
- Hover preselection and click selection.
- Acceptance: selected mesh maps to a stable component ID and correct tree node.

## 2. Component Inspector
- Component name, purpose, parent/child relationships, connected interfaces and available properties.
- Geometry close-up, coordinate frame and optional section view.
- Material, mass and dimensions only when sourced or explicitly labelled illustrative/unknown.
- Acceptance: technical facts show provenance and confidence; no invented specifications.

## 3. Exploded Assembly
- Explode by vehicle, system, subsystem or selected assembly.
- Adjustable separation amount, callouts and relationship lines.
- Select parts while exploded; reset to exact original transforms.
- Acceptance: deterministic, reversible transforms preserve component identity.

## 4. Disassembly
- Dependency-aware removal sequence.
- Show prerequisites and affected interfaces before removal.
- Remove, undo, restore and reset.
- Acceptance: blocked actions explain the dependency; hidden is never confused with removed.

## 5. Assembly
- Available-parts tray, target assembly, guided steps and progress.
- Drag/select placement, preview, snap, orientation and validation.
- Explicit constraints and tolerances appropriate to model fidelity.
- Acceptance: valid/invalid placement tests; accessible feedback; deterministic undo.

## 6. Engineering Workbench
- Dedicated studies for mass properties, braking, suspension geometry, aerodynamics and vehicle dynamics.
- Inputs with units/ranges, assumptions, equations/method, outputs and plots.
- Acceptance: every result is reproducible and model-versioned; illustrative inputs are clearly labelled.

## Shared requirements
- Consistent component identity and selection across workspaces.
- Loading, empty, error and unsupported-data states.
- Keyboard alternatives and accessible labels.
- Reduced-motion option.
- Responsive behaviour defined for desktop and tablet.
- No decorative or fabricated performance numbers.
