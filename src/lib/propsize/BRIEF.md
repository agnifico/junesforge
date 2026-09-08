# Propsize — guiding brief

This is the product document for Propsize. Implementation follows it; a UI pass after each phase can change chrome without changing the decisions here.

## Product

Propsize is a **browser 3D editor for composing a prop or a small set**.

You assemble a scene from parametric primitives, groups, and imported models. That scene is the unit of work: save it, share it, export it, dress a medieval inn with it.

It is **not** Blender. It is **not** a level editor. It is **not** an animation suite.

The north star, stolen from [Stove](https://unidaystudio.itch.io/stove) without copying Stove’s “one asset, no scenes” constraint:

> Compose in the scene. Isolate a piece when you need to *author* it (model, paint). Come back to the scene.

## What Stove taught us (and what we will not copy)

Stove is a Windows tool for low-poly / stylized / retro *game assets*. Four modes:

| Mode | Job |
|---|---|
| **View** | Inspect without editing overlays |
| **Model** | Vertex / edge / face modelling |
| **Paint** | Paint on the mesh; UVs are automatic |
| **Zoo** | See every asset in the project as a pack |

Stove’s loop is **Model. Paint. Export.** It is explicitly not for scene composition, bones, PBR graphs, or high-poly.

**We keep** scene composition, parametric primitives, shared materials, the model library, snapshot undo, and three.js code emit. Those are Propsize.

**We take** mode-shaped isolation, a small modelling set, auto-UVs, paint-on-mesh, and game-ready file export (GLB/OBJ + texture).

**We do not take** “you cannot compose a scene.” Zoo is a *view of a pack*, not a replacement for the hierarchy.

## Architecture: scene + isolation

### Scene (always)

The document is a tree of nodes:

- `primitive` — parametric Three.js geometry + `materialId`
- `group` — transform parent
- `imported` — reference to an `Asset` (GLB / glTF / OBJ)
- later: `mesh` — authored topology (isolation writes here)

Binary bytes never live in the JSON document. Assets are referenced by id (`library` / `embedded` / `remote`). That keeps undo snapshots cheap and documents URL-sized.

### Isolation (later — not in Phase 0)

A special mode entered on a **single mesh-capable target** (a primitive after convert-to-mesh, an imported part, or a `mesh` node).

While isolated:

- The rest of the scene is dimmed or hidden; you work on one object.
- **Model** and **Paint** become available. Their shortcuts are *isolation-only* so they never fight scene gizmos (`1`/`2`/`3`, WASD, X snap).
- Exiting isolation returns to the scene with that object still in place.

Isolation is how we get Stove-weight modelling without turning the whole app into a DCC.

Suggested chrome (UI pass can rename):

```
[ Scene ]     [ Isolate ▸ Model | Paint ]
```

**View** in Stove ≈ scene with gizmos off, or isolation with overlays off. Not a fourth product.

## Phases

Do not start a later phase until the previous one is in the user’s hands for a **UI pass**. Chrome, copy, spacing, and shortcut discoverability are out of scope for implementation phases unless they block a feature.

### Phase 0 — Finish the compose editor (now)

Ship what the current document model already promises, then stop.

Current capabilities (this is the inventory to test):

- Add primitives (box, sphere, cylinder, cone, torus, torus knot, platonic solids, plane, circle, ring, capsule, lathe). **Extrude** is added in this phase — the profile type already existed for it.
- Empty groups; group / ungroup; hierarchy drag reparent/reorder; visibility; **lock** (wired in this phase — the field already existed).
- Gizmos: move / rotate / scale; snap; drop to ground; align / distribute; flip across plane; nudge; duplicate; frame selection.
- Shared materials: color, roughness, metalness, flat/wire, opacity, emissive, side, procedural textures (checker / stripes / speckle), **image map** (wired in this phase — the type already existed).
- Import GLB / glTF / OBJ (drop on viewport, library folder, split multi-object, missing `.mtl` prompt).
- Sessions + autosave; JSON import (settings); three.js code + JSON export.
- Lathe 2D profile editor; lighting / background / orbit-around-selection settings.

**Out of Phase 0:** vertex modelling, paint, auto-UV, GLB mesh export, R3F/Threlte emitters, Tube-along-path, boolean ops, bones.

After Phase 0 the user lists UI changes. Do not invent a redesign in code first.

### Phase 1 — Isolation chrome

- Enter / exit isolation on the current selection (one object, or one group treated as a single target later — v1 is one node).
- Dim the rest of the scene; hide scene gizmos; swap the shortcut strip and help overlay.
- Model / Paint tabs visible only while isolated. They can be empty shells until Phase 2/3.
- Convert primitive → `mesh` (bake current geometry, keep transform and material). Irreversible except undo. Required before Model/Paint do anything real.

### Phase 2 — Model (isolation)

Small set, Stove-sized, not Blender:

- Select vertex / edge / face
- Extrude, inset, loop cut, bevel, merge, delete
- Optional: proportional editing

Primitives stay parametric in the scene. Isolation is where topology is edited. Join (several nodes → one mesh) can follow once convert works.

### Phase 3 — Paint (isolation)

- Auto UV unwrap (no UV editor in v1)
- Paint on the 3D surface: fill, gradient, mask, pixel size, edge wear, optional AO bake
- Scene materials remain lookdev; paint bakes into a texture asset on the mesh

### Phase 4 — Game-ready export and pack view

- Export selection or scene as GLB (geometry + textures)
- OBJ + MTL as a secondary
- Keep JSON + three.js emit as the web/authoring path
- Zoo-like pack view: thumbnails of exportable roots (library already lists files; Zoo is *this project’s assets side by side*)

## Document model rules (do not casually break)

1. **Assets stay out of the document JSON.** Paint maps and baked meshes are assets, same as imports.
2. **Snapshot undo** until measurement says otherwise.
3. **Materials stay shared** by `materialId`. Convert-to-mesh may snapshot a material; it should not silently unlink every crate in the set.
4. **Isolation must not fork the document.** It is a view on the same node ids. Cancel/exit does not create a parallel scene.
5. **New node kinds need a normalize path.** Unknown future fields must round-trip through `normalize.ts` without dropping the file.

## Shortcut policy

- **Scene:** object gizmos, camera, snap, group, duplicate, frame. Current help overlay.
- **Isolation / Model:** Blender-ish modelling keys. Only bound while isolated.
- **Isolation / Paint:** brush keys. Only bound while isolated.

Never bind isolation keys globally “so they’re faster.” Context is the product.

## What success looks like

A user can block out a watchtower from primitives and imports (today), isolate a merlon, cut and paint it, exit isolation, instance that piece in the scene, and export a GLB for a game engine — without opening Blender.

Phase 0 success is narrower: that same user can **reliably compose** with every control that already exists in the document, including lock, image textures, and extrude profiles, then we freeze features for a UI pass.
