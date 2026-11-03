# Assembly and Disassembly Lab

## Scope
The lab adds reversible component removal and restoration to the generic study assembly. Installed state is tracked independently from selection and visibility. Removed components are hidden from the viewport but remain available in the explorer for restoration.

## Workflow
1. Select a component in the explorer or viewport.
2. Choose Remove part. The operation is rejected if an installed component depends on the selected component.
3. Remove dependent components first, then remove the target.
4. Choose Install part to restore a component. Installation is rejected until all declared prerequisites are installed.
5. The workstation status line explains blocked operations.

## Study prerequisite order
- Chassis interface: no prerequisites.
- Front upright: chassis interface.
- Upper wishbone, lower wishbone and push-rod: chassis interface and front upright.
- Brake disc: front upright.
- Wheel & tyre: front upright and brake disc.

These simplified ordering rules are explicitly a study-lab model. They are not verified workshop procedures, fastener sequences or official race-car service instructions.

## Validation
The installed-set validator checks that every installed component's prerequisites are present. It does not solve mechanical constraints, check interference, torque, safety or structural integrity.

## Known limitations
- No drag-and-drop placement or mating solver.
- Removed parts are hidden rather than moved to a parts tray.
- No persistent project save/load.
- Geometry remains generic illustrative study geometry.
