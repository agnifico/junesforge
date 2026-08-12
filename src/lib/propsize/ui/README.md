# Propsize — port scaffold

Four core modules, the ones where a wrong decision propagates everywhere. Drop
into your SvelteKit project under `src/lib/`.

```
src/lib/core/types.ts             document model, assets, node union
src/lib/core/document.svelte.ts   store, keyed lookups, history, duplication
src/lib/library/fs.ts             local model folder via File System Access
src/lib/import/loaders.ts         GLB / glTF / OBJ import with real materials
```

## Install

```bash
npm i three
npm i -D @types/three
npm i -D @sveltejs/adapter-static   # if going fully static
```

DRACO decoders: copy `node_modules/three/examples/jsm/libs/draco/` into
`static/draco/`. Self-hosted, so the tool works offline and doesn't depend on a
CDN staying up.

## Route layout

```
/propsize            prerendered landing page
/propsize/app        the editor        → export const ssr = false
/propsize/[slug]     preset + content pages, prerendered
```

## Build order

1. `geometry.ts` — port `GEO_DEFS` from the prototype to typed definitions.
2. Three.js sync layer: document → scene graph, reading `docStore`.
3. Viewport + gizmos: port the maths from the prototype as-is, it works.
4. Inspector panels on the existing field components.
5. Library gallery + drag-to-place.
6. Code emitters (`emit/three.ts`, `emit/threlte.ts`, `emit/r3f.ts`).
7. URL scene encoding → share links and preset pages.

## Delegate to the free model

Mechanical, verifiable in seconds:

- `geometry.ts` — all 11 primitives in the `{defaults, fields, build, code}`
  shape, plus the new ones (Capsule, Ring, Lathe, Tube, Extrude).
- Icon components for each primitive.
- The R3F and Threlte emitters, given the three.js emitter as reference.
- Vitest fixtures: malformed documents, v1→v2 migration cases.
- Tooltips, empty states, README, page copy.

Keep for yourself: the three.js sync layer, gizmo interaction, the import
pipeline's failure paths, and anything visual.

## Decisions encoded here

**Assets are not in the document.** An imported GLB is an `Asset` referenced by
id; the node stores only the reference and its transform. Documents stay
URL-encodable, undo snapshots stay cheap, and a scene can point at files in your
own model folder rather than embedding 40 MB.

**Snapshot history, not commands.** I argued for a command pattern earlier;
revising that. With binaries outside the document a full snapshot is a few KB,
snapshots can't corrupt state through a buggy revert, and the approach is
already proven in the prototype. Revisit at thousands of nodes.

**Materials are shared assets.** `PrimitiveNode.materialId` points into
`doc.materials`. One edit repaints every prop using it, and the emitters dedupe
for free. Imported nodes keep their file's materials unless explicitly
overridden.

**Duplication.** Only X is offset, by the source's own width, so two of three
coordinates stay identical and the copy lands beside rather than inside. The
clone is inserted directly after its original, making it an adjacent sibling in
the hierarchy.

## Library constraints

The File System Access API is Chromium only — Chrome, Edge, Opera. Firefox and
Safari ship only OPFS, which is a sandboxed store, not your folders. It requires
a secure context, so **the tool must be served over https or localhost; it will
not work from a `file://` page.**

The fallback (`pickFolderFallback`) uses `<input webkitdirectory>`: the gallery
works for that session but the folder isn't remembered. Feature-detect and say
which mode the user is in rather than silently degrading.

Permission persists across sessions until revoked, so `restore()` on load and
only call `pick()` from a click.
