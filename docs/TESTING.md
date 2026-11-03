# Testing and Quality Gates

## Commands
- `npm install` — install dependencies.
- `npm run typecheck` — TypeScript project check.
- `npm run build` — typecheck and create the production bundle.
- `npm run dev` — run the browser development server.

## Phase 2 model integrity
- [ ] Every interface owner and target resolves to a component ID.
- [ ] Every dependency target resolves to a component ID.
- [ ] Component IDs remain stable when render geometry changes.
- [ ] All segments belonging to one rod component share its explode transform.
- [ ] Explode at 0 restores the assembled baseline; explode at 1 applies the defined offsets.

## Interaction acceptance
- [ ] Tree selection updates viewport highlight and inspector.
- [ ] Geometry selection updates tree and inspector.
- [ ] Hide/show affects actual component geometry.
- [ ] Isolate toggles the selected component without losing selection.
- [ ] Inspector lists interface targets and conceptual status.
- [ ] Unknown engineering values are never replaced with plausible-looking numbers.

## Fidelity
Generic study geometry is not official vehicle CAD. Conceptual interface records are not verified mechanical constraints. No vehicle-specific numerical properties may appear without traceable provenance.
