# Testing and Quality Gates

## Local commands
- `npm ci` — install locked dependencies.
- `npm run typecheck` — TypeScript project check.
- `npm run build` — typecheck and create the production bundle.
- `npm run dev` — run the browser development server.

## Phase 1 manual acceptance
- [ ] App loads without runtime errors.
- [ ] Assembly tree filters components by name and system.
- [ ] Selecting a tree row updates the 3D highlight and inspector.
- [ ] Selecting visible geometry updates the tree and inspector.
- [ ] Hide/show changes actual component visibility.
- [ ] Isolate toggles the selected component without losing selection.
- [ ] Explode slider applies reversible transforms; reset restores the assembled state.
- [ ] Unknown engineering values are not replaced with plausible-looking numbers.
- [ ] Desktop layout remains usable at common laptop widths.
- [ ] Reduced-motion and keyboard accessibility are reviewed before release.

## CI
The GitHub Actions workflow runs dependency installation and the production build on pushes and pull requests. Visual/browser interaction tests will be added when a stable browser test environment is introduced.
