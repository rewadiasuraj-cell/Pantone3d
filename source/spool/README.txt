PANTONE FILAMENT SPOOL — 200 MM

FILES
Pantone_Spool_200mm.glb: self-contained PBR model, embedded base-color and normal textures, nine named parts. Import in Blender with File > Import > glTF 2.0. The spool stands upright; dimensions are in meters.
Pantone_Spool_Quads.obj + Pantone_Spool.mtl: editable quad-dominant mesh, Z up, axle Y. Keep the PNG textures beside the OBJ/MTL. Import with scale 1; do not apply a millimeter conversion. OBJ material support varies; prefer GLB for PBR appearance.
Spool_BaseColor.png / Spool_Normal.png: 2048 x 2048 label/detail textures.
Pantone_Spool_Preview.png: shaded software preview of the actual geometry, not a separate AI image. Final lighting and shading will differ in Blender.
build_spool.py: reproducible mesh, material and export source; requires Python, numpy, scipy, Pillow, and DejaVuSans.ttf at the path in the script.
validate_model.py / Validation_Report.json: GLB structure, normals and manifold checks.
Model_Report.json: dimensions and mesh counts.

DIMENSIONS
Flange diameter: 200 mm.
Flange outer width: 68 mm; overall width including collars: 71.4 mm.
Axle bore: 52 mm; hub outer diameter: 80 mm.
Outer visible filament strand: 1.75 mm, 34 continuous helical turns.

PARTS
Front and rear flanges, hollow hub, front and rear collars, filament pack, outer continuous helix, front and rear end winding.

MATERIALS
Matte black molded plastic and slightly glossy yellow filament, metalness 0. Base color, roughness and normal mapping are included in GLB. The wordmark is recreated as a texture with a normal-map recess effect, not engraved letter geometry.

EDITING
The OBJ preserves approximately 98% quad faces. There are localized triangles around flange openings and strand end caps. GLB uses triangles as required by its mesh format. Hard-surface seams intentionally have split vertices/normals; weld by distance only when necessary. Each part is closed after positional welding. The full assembly intentionally contains contacting/overlapping separate meshes; it is a visualization asset, not a single printable manufacturing solid. The end winding uses concentric strands backed by a solid filament pack; only the outer winding is a continuous helix. Hidden internal winding is not modeled strand by strand.

REFERENCE LIMITATIONS
Modeled from one perspective image, not manufacturer CAD. The 200 mm diameter follows the requested scale. Width, bore, thickness and small feature dimensions are estimated. The black/yellow palette, viewing slots and visible pantone lettering are recreated. The wordmark uses substitute lettering, and small molded details are simplified; exact brand artwork was not supplied. Rear details are inferred by symmetry. This is not an exact dimensional replica.

VALIDATION SCOPE
GLB binary structure, buffer ranges, finite/unit normals, face orientation, dimensions, welded manifold edges and a rendered mesh preview were checked. Blender/FBX software was unavailable in the execution environment, so no native Blender round-trip or FBX export is claimed. GLB is the requested delivered interchange format.
