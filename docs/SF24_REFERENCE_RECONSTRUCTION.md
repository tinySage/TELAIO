# SF-24 Reference Reconstruction

## Reference scope
TELAIO's first detailed reference vehicle is the **Ferrari SF-24 (2024)**. This is an independent engineering study informed by publicly available photographs and technical journalism. It is not official Ferrari CAD, a licensed replica, or a claim of access to Scuderia Ferrari's internal engineering data.

## Publicly documented architectural cues
The following design cues are supported by public technical reporting:
- The SF-24 retained a push-rod front suspension and pull-rod rear suspension layout.
- Its sidepod concept moved towards a more pronounced front undercut and downwash-oriented upper bodywork.
- The car retained a relatively wide nose concept.
- Public technical analysis described separate rear upper arms rather than a conventional converging upper wishbone arrangement (multi-link description).

Sources:
1. Formula 1, “What's new on Ferrari's SF-24 with the 2024 challenger a big departure from its predecessor” (13 February 2024): https://www.formula1.com/en/latest/article/tech-analysis-whats-new-on-ferraris-sf-24-with-the-2024-challenger-a-big.5xRmOCcG6nZT70IxSXpPPR
2. Formula 1, “The intriguing Ferrari SF-24 design detail that broke cover in the Middle East” (19 March 2024): https://www.formula1.com/en/latest/article/tech-weekly-the-intriguing-ferrari-sf-24-design-detail-that-broke-cover-in.3IJqWNmmDeqhDZgUUsf5G3
3. Motorsport.com, “Why Ferrari bucked the trend with its F1 2024 suspension choice” (20 March 2024): https://www.motorsport.com/f1/news/why-ferrari-bucked-the-trend-with-its-f1-2024-suspension-choice/10589033/
4. Racecar Engineering, “Ferrari SF-24”: https://www.racecar-engineering.com/cars/ferrari-sf-24/

## Reconstruction rules
- The cited sources establish broad architectural cues only. They do not provide complete CAD surfaces, pickup coordinates, tolerances, dimensions or internal packaging.
- All TELAIO mesh geometry is original procedural reconstruction and remains marked ILLUSTRATIVE.
- No exact wheelbase, track, suspension hardpoint, mass, material grade, aerodynamic coefficient, brake dimension or power-unit specification is asserted.
- Scene coordinates are dimensionless study coordinates, not SI dimensions.
- Each component has a stable semantic ID. Geometry can be replaced without changing identity.
- Rear suspension components are represented as separate upper links, a pull-rod and a lower link to reflect the publicly described layout at a conceptual level. Their geometry and joint locations are not measured.

## Next engineering asset milestone
Replace procedural envelopes with original high-detail, segmented meshes authored from a documented reference workflow. Maintain a component manifest mapping every mesh to a semantic ID, system, parent, provenance and interface records. Keep source images and reconstruction notes in the repository where licensing permits.
