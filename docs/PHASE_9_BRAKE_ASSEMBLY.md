# Phase 9 — Front-left brake corner assembly

Phase 9 builds the mechanical assembly around the Phase 8 brake rotor: the parts that carry, clamp and locate it, with explicit interfaces and a dependency order that matches how a brake corner is serviced.

## Components

All new components are procedural study envelopes with provenance `ILLUSTRATIVE`. Dimensions, materials, masses and performance values are not established.

| Component ID | Name | Role |
| --- | --- | --- |
| `front-hub` | Front hub & wheel interface | Runs in the upright bearing; carries the rotor and locates the wheel |
| `caliper-mount` | Caliper mounting bracket | Locates the caliper on the upright |
| `brake-caliper` | Brake caliper body | Fixed caliper straddling the rotor; carries the pads |
| `pad-inner-backing` | Inner pad backing plate | Carrier for the inner lining; reacts piston load |
| `pad-inner` | Inner brake pad lining | Friction lining on the inboard rotor face |
| `pad-outer-backing` | Outer pad backing plate | Carrier for the outer lining |
| `pad-outer` | Outer brake pad lining | Friction lining on the outboard rotor face |

The rotor (`brake-disc`) now mounts to the hub rather than directly to the upright. Its asset manifest entry records `parentComponentId: front-hub`.

## Installation order

Each arrow means "must be installed before".

```
front-upright → front-hub → brake-disc ─┐
front-upright → caliper-mount ──────────┴→ brake-caliper → backing plates → linings
front-hub, brake-disc, brake-caliper, linings → wheel-tyre
```

The caliper requires the rotor because it straddles it. The wheel requires the linings so that it is always the first part removed for brake service. Removal is the reverse: trying to remove a part with installed dependants is refused, and the status bar lists the full removal sequence, for example:

> Remove first, in order: Front-left wheel & tyre → Inner brake pad lining → Inner pad backing plate → …

## Interfaces

Interface records cover hub bearing, rotor bell mounting, wheel centring, caliper bolting, piston-to-backing-plate contact, lining bond faces and lining-to-rotor friction contact. All are `CONCEPTUAL`: they describe which parts meet, not validated constraint geometry.

## Acceptance criteria

From the roadmap: *select the rotor, isolate it, remove the pads and caliper in a valid dependency order, and rebuild the assembly without breaking the hierarchy.*

Automated (`npm test`, `src/model/brakeAssembly.test.ts`):

- [x] No dangling interface or dependency references.
- [x] Every brake component has illustrative provenance, "Not established" dimensions, install rules and at least one interface.
- [x] Prerequisites are acyclic; the full vehicle can be built from an empty set.
- [x] Rotor removal is blocked while the caliper or wheel is installed.
- [x] The generated removal sequence starts with the wheel, removes linings before backing plates and backing plates before the caliper; executing it, then reversing it, restores the full valid assembly.
- [x] Invalid installs (caliper before rotor, lining before backing plate) are refused.

Browser check (headless Chrome, production build):

- [x] Rotor, caliper and pads selectable from the tree; inspector shows provenance and relations.
- [x] Removing the rotor with brakes installed shows the ordered removal sequence.
- [x] Full removal down to the rotor and rebuild returns to 29 / 29 installed with integrity VALID.
- [x] Exploded view separates the corner and returns to baseline at 0%.

Still to do by eye on the Vercel preview: confirm caliper and pad placement reads correctly from several orbit angles.

## Limitations

- Only the front-left corner is modelled. Front-right and rear corners follow in Phase 10.
- The new parts are procedural boxes and cylinders. Authoring them as glTF assets through the Phase 6 pipeline is a follow-up.
- No braking calculations are attached; those belong to the Phase 14 braking laboratory.
