# Contributing to TELAIO

Thank you for contributing. The project owner retains review and merge authority.

## Workflow
1. Create a focused branch from the current approved development baseline.
2. Keep changes small enough to review.
3. Run `npm run build` before requesting review.
4. Update documentation when behaviour, architecture or data assumptions change.
5. Open a pull request with scope, verification steps, limitations and screenshots where useful.
6. Do not merge directly to `main`; the project owner reviews and merges.

## Engineering data
Never invent vehicle specifications. Mark every numerical value as sourced, derived, estimated, illustrative or unknown. Include units, source/method, assumptions and limitations.

## Assets and identity
Use original or properly licensed assets. Do not add Ferrari shields, team marks, sponsor marks or proprietary CAD. TELAIO is an independent project.

## Code quality
Prefer semantic component IDs, typed data contracts, small components and reversible state transitions. Avoid coupling component identity to render-mesh names.
