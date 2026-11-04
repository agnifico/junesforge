<script lang="ts">
	import { docStore } from '$lib/propsize/core/document.svelte';
	import { editorStore } from '$lib/propsize/core/editor.svelte';
	import { GEO_DEFS } from '$lib/propsize/core/geometry';
	import { defaultMaterial, shadeColor } from '$lib/propsize/core/materials';
	import { isGroup, isPrimitive, isImported, isAuthoredMesh, isMeshNode, isProfile } from '$lib/propsize/core/types';
	import ProfileEditor from './ProfileEditor.svelte';
	import type { SceneNode, PrimitiveNode, ImportedNode, MeshNode, MaterialSpec, PrimitiveType } from '$lib/propsize/core/types';
	import { round3, MIXED, commonValue, avgValue } from '$lib/propsize/core/utils';
	import type { Axis } from '$lib/propsize/core/editor.svelte';
	import type { SceneEngine } from '$lib/propsize/core/scene-engine.svelte';
	import FieldSlider from './fields/FieldSlider.svelte';
	import FieldToggle from './fields/FieldToggle.svelte';
	import FieldColor from './fields/FieldColor.svelte';
	import FieldSelect from './fields/FieldSelect.svelte';
	import FieldMiniNumbers from './fields/FieldMiniNumbers.svelte';
	import FieldSegmented from './fields/FieldSegmented.svelte';
	import BtnRow from './fields/BtnRow.svelte';
	import Swatches from './fields/Swatches.svelte';

	let { engine }: { engine: SceneEngine } = $props();
	let insetAmt = $state(0.2);
	let bevelAmt = $state(0.15);
	/** Which axes a dimension paste writes. Matching a cylinder's radius
	 *  without also forcing its height is the common case, so these are
	 *  individually armable rather than all-or-nothing. */
	let pasteAxes = $state({ x: true, y: true, z: true });

	let selected = $derived(
		docStore.selectedIds.map((id) => docStore.node(id)).filter((n): n is SceneNode => !!n)
	);
	let single = $derived(selected.length === 1 ? selected[0] : null);

	// Self-heals a dangling materialId rather than handing the fields an
	// undefined spec (which throws during render). Loads are normalized, so this
	// only fires for documents patched in from elsewhere.
	function material(node: PrimitiveNode | MeshNode): MaterialSpec {
		const existing = docStore.doc.materials[node.materialId];
		if (existing) return existing;
		const fresh = defaultMaterial();
		docStore.doc.materials[node.materialId] = fresh;
		return fresh;
	}

	// ---- single-node mutation helpers (each marks history, then syncs) ------
	function renameNode(node: SceneNode, name: string) {
		docStore.mark('name:' + node.id);
		node.name = name;
		engine.requestSync();
	}
	function setPosition(node: SceneNode, axis: 'x' | 'y' | 'z', v: number) {
		docStore.mark('pos:' + axis);
		node.transform.position[axis] = v;
		engine.requestSync();
	}
	function setRotation(node: SceneNode, axis: 'x' | 'y' | 'z', v: number) {
		docStore.mark('rot:' + axis);
		node.transform.rotation[axis] = v;
		engine.requestSync();
	}
	function setScale(node: SceneNode, axis: Axis, v: number) {
		docStore.mark('scale:' + axis);
		applyLinkedScale(node, axis, v);
		engine.requestSync();
	}
	function applyLinkedScale(node: SceneNode, axis: Axis, v: number) {
		const prev = node.transform.scale[axis];
		const axes = editorStore.linkedScaleAxes(axis);
		const factor = prev === 0 ? null : v / prev;
		for (const a of axes) {
			node.transform.scale[a] = round3(factor === null ? v : node.transform.scale[a] * factor);
		}
	}
	function materialShared(node: SceneNode) {
		if (!isPrimitive(node) && !isAuthoredMesh(node)) return false;
		return engine.materialUserCount(node.materialId) > 1;
	}
	function setGeometry(node: PrimitiveNode, key: string, v: number | boolean) {
		docStore.mark('geo:' + key);
		node.geometry[key] = v;
		engine.syncLinked(node);
		engine.requestSync();
	}
	// Spec-based rather than node-based, so the same editor drives a primitive's
	// own material and an imported model's override material. Linked copies
	// share the spec itself, so a paint edit reaches them with nothing to
	// propagate — but the person doing it still deserves to be told.
	function setMaterial(m: MaterialSpec, key: string, mutate: (m: MaterialSpec) => void) {
		docStore.mark('mat:' + key);
		if (m) mutate(m);
		noticePaintReach();
		engine.requestSync();
	}
	function setTexture(m: MaterialSpec, key: string, mutate: (t: MaterialSpec['texture']) => void) {
		docStore.mark('tex:' + key);
		if (m) mutate(m.texture);
		noticePaintReach();
		engine.requestSync();
	}
	function noticePaintReach() {
		if (single) engine.noticeLinkedEdit(docStore.linkedSiblingCount(single));
	}
	function setShadow(node: PrimitiveNode | ImportedNode | MeshNode, key: 'castShadow' | 'receiveShadow', v: boolean) {
		docStore.mark(key + ':' + node.id);
		node[key] = v;
		engine.requestSync();
	}
	function assignImageTexture(...targets: MaterialSpec[]) {
		const mats = targets.filter(Boolean);
		if (!mats.length) return;
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/png,image/jpeg,image/webp';
		input.addEventListener('change', () => {
			const file = input.files?.[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = () => {
				const dataUrl = String(reader.result);
				const ext = (file.name.split('.').pop() ?? 'png').toLowerCase();
				const format = ext === 'jpg' || ext === 'jpeg' ? 'jpg' : ext === 'webp' ? 'webp' : 'png';
				docStore.mark(null);
				const id = docStore.newId('tex');
				docStore.doc.assets[id] = {
					id,
					name: file.name,
					kind: 'texture',
					format,
					source: { type: 'embedded', dataUrl }
				};
				for (const m of mats) {
					m.texture.type = 'image';
					m.texture.assetId = id;
				}
				engine.requestSync();
			};
			reader.readAsDataURL(file);
		}, { once: true });
		input.click();
	}
	function clearImageTexture(m: MaterialSpec) {
		setTexture(m, 'type', (t) => {
			t.type = 'none';
			t.assetId = null;
		});
	}
	function scaleAll(list: SceneNode[], factor: number) {
		if (!list.length) return;
		docStore.mark(null);
		list.forEach((n) => {
			n.transform.scale.x = round3(n.transform.scale.x * factor);
			n.transform.scale.y = round3(n.transform.scale.y * factor);
			n.transform.scale.z = round3(n.transform.scale.z * factor);
		});
		engine.requestSync();
	}
</script>

<!-- ============================== single node ============================== -->
{#snippet transformSection(node: SceneNode)}
	<div class="section">
		<div class="section-title">Transform</div>
		<FieldMiniNumbers
			label="Position"
			triple={node.transform.position}
			step={0.1}
			onchange={(axis, v) => setPosition(node, axis, v)}
		/>
		<FieldMiniNumbers
			label="Rotation °"
			triple={node.transform.rotation}
			step={5}
			onchange={(axis, v) => setRotation(node, axis, v)}
		/>
		<FieldMiniNumbers
			label="Scale"
			triple={node.transform.scale}
			step={0.1}
			locks={editorStore.scaleLink}
			onLockToggle={(axis) => editorStore.toggleScaleLink(axis)}
			onchange={(axis, v) => setScale(node, axis, v)}
		/>
		{#if engine.selectionDims}
			<FieldMiniNumbers
				label="Dimensions"
				triple={engine.selectionDims}
				step={0.1}
				onchange={(axis, v) => engine.setDimension(node, axis, v)}
			/>
			<BtnRow
				buttons={[
					{
						label: 'Apply scale',
						title: 'Fold the scale into the shape itself and reset scale to 1',
						onClick: () => engine.applyScaleToSelection()
					},
					{
						label: 'Copy size',
						title: 'Copy these dimensions, to size another object to match',
						onClick: () => engine.copyDimensionsFrom(node)
					},
					{
						label: `Round ${editorStore.snapStep}`,
						title: `Round dimensions to whole ${editorStore.snapStep}-unit steps so kit pieces tile`,
						onClick: () => engine.roundDimensionsToStep()
					}
				]}
			/>
			{#if editorStore.dimensionClipboard}
				<BtnRow
					label={`Paste size from ${editorStore.dimensionClipboard.from}`}
					buttons={[
						{ label: 'X', active: pasteAxes.x, onClick: () => (pasteAxes.x = !pasteAxes.x) },
						{ label: 'Y', active: pasteAxes.y, onClick: () => (pasteAxes.y = !pasteAxes.y) },
						{ label: 'Z', active: pasteAxes.z, onClick: () => (pasteAxes.z = !pasteAxes.z) },
						{ label: 'Paste', onClick: () => engine.pasteDimensionsToSelection(pasteAxes) }
					]}
				/>
			{/if}
		{/if}
		<BtnRow
			label="Flip across plane"
			buttons={[
				{ label: 'XY', title: 'Mirror front-to-back (flips Z)', onClick: () => engine.flipAcross('xy') },
				{ label: 'YZ', title: 'Mirror left-to-right (flips X)', onClick: () => engine.flipAcross('yz') },
				{ label: 'ZX', title: 'Mirror top-to-bottom (flips Y)', onClick: () => engine.flipAcross('zx') }
			]}
		/>
		<BtnRow
			buttons={[
				{ label: 'Drop to ground', onClick: () => engine.dropToGround() },
				{ label: 'Reset rot', onClick: () => engine.resetTransform('rotation') },
				{ label: 'Reset scale', onClick: () => engine.resetTransform('scale') }
			]}
		/>
		<FieldToggle
			label="Lock"
			value={node.locked}
			onchange={(v) => {
				docStore.mark('lock:' + node.id);
				node.locked = v;
				engine.requestSync();
			}}
		/>
		{#if node.dataLink}
			{@const others = docStore.linkedSiblingCount(node)}
			<p class="link-note">
				<b>Linked copy</b> — shape and colour are shared with {others}
				{others === 1 ? 'other' : 'others'}. Editing any of them edits all of them. Position, rotation and
				scale below are this copy alone.
			</p>
		{/if}
	</div>
{/snippet}

{#snippet geometrySection(node: PrimitiveNode)}
	{#if GEO_DEFS[node.type].profile}
		{@const p = node.geometry.profile}
		{#if isProfile(p)}
			<ProfileEditor
				profile={p}
				kind={GEO_DEFS[node.type].profileKind ?? 'lathe'}
				onchange={(next, key) => {
					docStore.mark(key);
					node.geometry.profile = next;
					engine.syncLinked(node);
					engine.requestSync();
				}}
			/>
		{/if}
	{/if}
	<div class="section">
		<div class="section-title">{GEO_DEFS[node.type].label} geometry</div>
		{#each GEO_DEFS[node.type].fields as fld (fld.key)}
			{#if fld.bool}
				<FieldToggle
					label={fld.label}
					value={!!node.geometry[fld.key]}
					onchange={(v) => setGeometry(node, fld.key, v)}
				/>
			{:else}
				<FieldSlider
					label={fld.label}
					value={node.geometry[fld.key] as number}
					min={fld.min ?? 0}
					max={fld.max ?? 1}
					step={fld.step ?? 0.01}
					int={fld.int}
					unit={fld.unit}
					oninput={(v) => setGeometry(node, fld.key, v)}
				/>
			{/if}
		{/each}
	</div>
{/snippet}

{#snippet textureSection(m: MaterialSpec)}
	{@const tex = m.texture}
	<div class="section">
		<div class="section-title">Texture</div>
		<BtnRow
			label="Image map"
			buttons={[
				{
					label: tex.type === 'image' && tex.assetId ? 'Replace' : 'Choose',
					onClick: () => assignImageTexture(m)
				},
				...(tex.type === 'image'
					? [{ label: 'Clear', onClick: () => clearImageTexture(m) }]
					: [])
			]}
		/>
		{#if tex.type === 'image'}
			<div class="batch-note">
				{docStore.doc.assets[tex.assetId ?? '']?.name ?? 'Embedded image'}
			</div>
		{:else}
			<FieldSelect
				label="Pattern"
				value={tex.type}
				options={[
					{ value: 'none', label: 'None' },
					{ value: 'checker', label: 'Checker' },
					{ value: 'stripes', label: 'Stripes' },
					{ value: 'speckle', label: 'Speckle' }
				]}
				onchange={(v) => setTexture(m, 'type', (t) => (t.type = v as MaterialSpec['texture']['type']))}
			/>
			{#if tex.type === 'checker' || tex.type === 'stripes' || tex.type === 'speckle'}
				<FieldColor
					label="Color A"
					value={tex.colorA || m.color}
					onchange={(v) => setTexture(m, 'colorA', (t) => (t.colorA = v))}
				/>
				<FieldColor
					label="Color B"
					value={tex.colorB || shadeColor(m.color, -0.22)}
					onchange={(v) => setTexture(m, 'colorB', (t) => (t.colorB = v))}
				/>
				<FieldSlider
					label={tex.type === 'speckle' ? 'Density' : 'Tiles'}
					value={tex.tiles}
					min={2}
					max={24}
					step={1}
					int
					oninput={(v) => setTexture(m, 'tiles', (t) => (t.tiles = v))}
				/>
			{/if}
		{/if}
		{#if tex.type !== 'none'}
			<FieldSlider
				label="Repeat X"
				value={tex.repeatX}
				min={0.25}
				max={8}
				step={0.25}
				oninput={(v) => setTexture(m, 'repeatX', (t) => (t.repeatX = v))}
			/>
			<FieldSlider
				label="Repeat Y"
				value={tex.repeatY}
				min={0.25}
				max={8}
				step={0.25}
				oninput={(v) => setTexture(m, 'repeatY', (t) => (t.repeatY = v))}
			/>
		{/if}
	</div>
{/snippet}

{#snippet materialSection(m: MaterialSpec, title: string)}
	<div class="section">
		<div class="section-title">{title}</div>
		<FieldColor label="Color" value={m.color} onchange={(v) => setMaterial(m, 'color', (mm) => (mm.color = v))} />
		<Swatches onPick={(c) => setMaterial(m, 'color', (mm) => (mm.color = c))} />
		<FieldSlider
			label="Roughness"
			value={m.roughness}
			min={0}
			max={1}
			step={0.01}
			oninput={(v) => setMaterial(m, 'roughness', (mm) => (mm.roughness = v))}
		/>
		<FieldSlider
			label="Metalness"
			value={m.metalness}
			min={0}
			max={1}
			step={0.01}
			oninput={(v) => setMaterial(m, 'metalness', (mm) => (mm.metalness = v))}
		/>
		<FieldToggle
			label="Flat shading"
			value={m.flatShading}
			onchange={(v) => setMaterial(m, 'flatShading', (mm) => (mm.flatShading = v))}
		/>
		<FieldToggle
			label="Wireframe"
			value={m.wireframe}
			onchange={(v) => setMaterial(m, 'wireframe', (mm) => (mm.wireframe = v))}
		/>
		<FieldToggle
			label="Transparent"
			value={m.transparent}
			onchange={(v) => setMaterial(m, 'transparent', (mm) => (mm.transparent = v))}
		/>
		{#if m.transparent}
			<FieldSlider
				label="Opacity"
				value={m.opacity}
				min={0}
				max={1}
				step={0.01}
				oninput={(v) => setMaterial(m, 'opacity', (mm) => (mm.opacity = v))}
			/>
		{/if}
		<FieldColor
			label="Emissive"
			value={m.emissive}
			onchange={(v) => setMaterial(m, 'emissive', (mm) => (mm.emissive = v))}
		/>
		<FieldSlider
			label="Emissive intensity"
			value={m.emissiveIntensity}
			min={0}
			max={3}
			step={0.05}
			oninput={(v) => setMaterial(m, 'emissiveIntensity', (mm) => (mm.emissiveIntensity = v))}
		/>
		<FieldSegmented
			label="Side"
			value={m.side}
			options={[
				{ value: 'front', label: 'Front' },
				{ value: 'back', label: 'Back' },
				{ value: 'double', label: 'Double' }
			]}
			onchange={(v) => setMaterial(m, 'side', (mm) => (mm.side = v as MaterialSpec['side']))}
		/>
	</div>
	{@render textureSection(m)}
{/snippet}

{#snippet shadowSection(node: PrimitiveNode | ImportedNode | MeshNode)}
	<div class="section">
		<div class="section-title">Shadows</div>
		<FieldToggle label="Cast shadow" value={node.castShadow} onchange={(v) => setShadow(node, 'castShadow', v)} />
		<FieldToggle
			label="Receive shadow"
			value={node.receiveShadow}
			onchange={(v) => setShadow(node, 'receiveShadow', v)}
		/>
	</div>
{/snippet}

{#snippet importedMaterialSection(node: ImportedNode)}
	{@const override = node.materialOverride ? docStore.doc.materials[node.materialOverride] : null}
	<div class="section">
		<div class="section-title">Material</div>
		<FieldToggle
			label="Override the file's materials"
			value={!!node.materialOverride}
			onchange={(v) => (v ? engine.enableMaterialOverride(node) : engine.clearMaterialOverride(node))}
		/>
		<div class="batch-note">
			{#if node.materialOverride}
				Every mesh in this model is painted with the material below. Turn this off to go back to the materials
				that came with the file.
			{:else}
				This model is using the materials from its own file, which Propsize can't edit directly. Turn this on
				to paint the whole model with one material instead — useful when a model arrives untextured (a common
				case for an .obj imported without its .mtl).
			{/if}
		</div>
	</div>
	{#if override}
		{@render materialSection(override, 'Override material')}
	{/if}
{/snippet}

{#snippet importedInfoSection(node: ImportedNode)}
	{@const asset = docStore.doc.assets[node.assetId]}
	<div class="section">
		<div class="section-title">Imported model</div>
		<div class="batch-note">
			{node.stats.meshes} mesh{node.stats.meshes === 1 ? '' : 'es'}, {node.stats.triangles} triangles.
			{#if node.part}
				Part "{node.part.name}" of {asset?.name ?? 'the imported file'}.
			{/if}
			{#if asset}
				Format {asset.format.toUpperCase()}.
				{#if asset.source.type === 'library'}
					From your model library ({asset.source.path}).
				{:else if asset.source.type === 'embedded'}
					Embedded in this document.
				{:else}
					Loaded from {asset.source.url}.
				{/if}
			{/if}
			Materials come from the source file — Propsize doesn't edit them yet.
		</div>
	</div>
{/snippet}

{#snippet meshInfoSection(node: MeshNode)}
	<div class="section">
		<div class="section-title">Mesh</div>
		<div class="batch-note">
			{engine.modelVertCount || node.stats.vertices} vertices, {node.stats.triangles} triangles
			{#if engine.modelFaceCount} · {engine.modelFaceCount} faces{/if}. Size sliders are gone; undo restores a
			parametric primitive.
		</div>
	</div>
{/snippet}

{#snippet isolationShell(node: SceneNode)}
	<div class="section">
		<div class="section-title">{editorStore.isolationTool === 'paint' ? 'Paint' : 'Model'}</div>
		{#if editorStore.isolationTool === 'paint'}
			<div class="batch-note">
				Paint-on-mesh (fill, wear, pixel size) lands in the next paint pass. The surface colour below still
				works.
			</div>
		{:else if isAuthoredMesh(node)}
			<FieldSegmented
				label="Select"
				value={editorStore.editSelectMode}
				options={[
					{ value: 'vertex', label: 'Vertex', title: '1' },
					{ value: 'edge', label: 'Edge', title: '2' },
					{ value: 'face', label: 'Face', title: '3' }
				]}
				onchange={(v) => engine.setEditSelectMode(v as 'vertex' | 'edge' | 'face')}
			/>
			<div class="batch-note">
				{engine.modelSelCount} selected · click to pick, Shift-click to add, Shift-drag to box-select, drag
				to move. Esc clears the selection, then leaves isolation.
			</div>
			<BtnRow
				label="Edit"
				buttons={[
					{ label: 'Move', title: 'G', onClick: () => engine.startModelGrab() },
					{ label: 'Extrude', title: 'E — faces', onClick: () => engine.modelExtrude() },
					{ label: 'Inset', title: 'I — faces', onClick: () => engine.modelInset(insetAmt) },
					{ label: 'Loop cut', title: 'C — one edge', onClick: () => engine.modelLoopCut() }
				]}
			/>
			<BtnRow
				buttons={[
					{ label: 'Bevel', title: 'B — edges', onClick: () => engine.modelBevel(bevelAmt) },
					{ label: 'Merge', title: 'M — vertices', onClick: () => engine.modelMerge() },
					{ label: 'Delete', title: 'X', onClick: () => engine.modelDelete() }
				]}
			/>
			<FieldSlider
				label="Inset"
				value={insetAmt}
				min={0.02}
				max={0.45}
				step={0.01}
				oninput={(v) => (insetAmt = v)}
			/>
			<FieldSlider
				label="Bevel"
				value={bevelAmt}
				min={0.02}
				max={0.45}
				step={0.01}
				oninput={(v) => (bevelAmt = v)}
			/>
			<FieldToggle
				label="Proportional"
				value={editorStore.modelProportional}
				onchange={(v) => (editorStore.modelProportional = v)}
			/>
			{#if editorStore.modelProportional}
				<FieldSlider
					label="Falloff radius"
					value={editorStore.modelPropRadius}
					min={0.1}
					max={8}
					step={0.1}
					oninput={(v) => (editorStore.modelPropRadius = v)}
				/>
			{/if}
		{:else}
			<div class="batch-note">
				Modelling needs an authored mesh. Convert a primitive to isolate it for vertex tools. Imports stay
				view-only until a later convert pass.
			</div>
		{/if}
	</div>
{/snippet}

<!--
	A link shares shape *and* paint, so there is one thing to break, not two.
	"Make unique" stays for the other, unrelated way objects end up sharing a
	material — an imported file that points a dozen parts at one entry — which
	has nothing to do with linked duplicates and shouldn't be worded as if it
	did.
-->
{#snippet unlinkButtons(node: SceneNode)}
	{@const linked = !!node.dataLink}
	{@const shareMat = !linked && materialShared(node)}
	{#if shareMat || linked}
		<div class="insp-unlinks">
			{#if linked}
				{@const others = docStore.linkedSiblingCount(node)}
				<button
					type="button"
					class="mini-btn warn"
					title={`Give this copy its own shape and its own colour. The other ${others} ${others === 1 ? 'copy keeps' : 'copies keep'} following each other.`}
					onclick={() => engine.unlinkNode(node)}
				>
					Unlink
				</button>
			{:else if isPrimitive(node) || isAuthoredMesh(node)}
				<button
					type="button"
					class="mini-btn"
					title="This object keeps its colour but stops sharing the material entry, so recolouring it no longer repaints the others."
					onclick={() => engine.unlinkMaterial(node)}
				>
					Make unique
				</button>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet singleInspector(node: SceneNode)}
	{@const isolated = editorStore.isolatedId === node.id}
	<div class="insp-sticky">
		<input
			class="name-input"
			value={node.name}
			oninput={(e) => renameNode(node, (e.currentTarget as HTMLInputElement).value)}
		/>
		{#if isolated}
			<div class="itabs">
				<div
					class="itab"
					class:active={editorStore.isolationTool === 'model'}
					onclick={() => (editorStore.isolationTool = 'model')}
				>
					Model
				</div>
				<div
					class="itab"
					class:active={editorStore.isolationTool === 'paint'}
					onclick={() => (editorStore.isolationTool = 'paint')}
				>
					Paint
				</div>
			</div>
		{:else}
			<div class="insp-tabs-row">
				<div class="itabs">
					<div
						class="itab"
						class:active={editorStore.inspectorTab === 'shape'}
						onclick={() => (editorStore.inspectorTab = 'shape')}
					>
						Shape
					</div>
					<div
						class="itab"
						class:active={editorStore.inspectorTab === 'surface'}
						onclick={() => (editorStore.inspectorTab = 'surface')}
					>
						Surface
					</div>
				</div>
				{@render unlinkButtons(node)}
			</div>
		{/if}
	</div>

	{#if isolated}
		{@render isolationShell(node)}
		{@render transformSection(node)}
		{#if isAuthoredMesh(node)}
			{@render meshInfoSection(node)}
			{#if editorStore.isolationTool === 'paint'}
				{@render materialSection(material(node), 'Material')}
				{@render shadowSection(node)}
			{/if}
		{:else if isImported(node)}
			{@render importedInfoSection(node)}
			{#if editorStore.isolationTool === 'paint'}
				{@render importedMaterialSection(node)}
				{@render shadowSection(node)}
			{/if}
		{:else if isPrimitive(node)}
			{@render geometrySection(node)}
		{/if}
	{:else if isGroup(node)}
		{@const paintable = docStore.descendants(node.id).filter(isMeshNode)}
		{@const meshes = paintable.filter(isPrimitive)}
		{#if editorStore.inspectorTab === 'shape'}
			{@render transformSection(node)}
			{@render batchGeometrySection(meshes)}
		{:else}
			{@render batchMaterialSection(meshes)}
			{@render batchShadowSection(paintable)}
			{@render importedOverrideSection(paintable)}
		{/if}
	{:else if isPrimitive(node)}
		{#if editorStore.inspectorTab === 'shape'}
			{@render transformSection(node)}
			{@render geometrySection(node)}
		{:else}
			{@render materialSection(material(node), 'Material')}
			{@render shadowSection(node)}
		{/if}
	{:else if isAuthoredMesh(node)}
		{#if editorStore.inspectorTab === 'shape'}
			{@render transformSection(node)}
			{@render meshInfoSection(node)}
		{:else}
			{@render materialSection(material(node), 'Material')}
			{@render shadowSection(node)}
		{/if}
	{:else if isImported(node)}
		{#if editorStore.inspectorTab === 'shape'}
			{@render transformSection(node)}
			{@render importedInfoSection(node)}
		{:else}
			{@render importedMaterialSection(node)}
			{@render shadowSection(node)}
		{/if}
	{/if}
{/snippet}

<!-- ============================== batch (multi-select) ====================== -->
{#snippet batchTriple(label: string, roots: SceneNode[], key: 'position' | 'rotation' | 'scale', step: number)}
	<div class="field">
		<div class="field-label"><span class="fname">{label}</span></div>
		<div class="row3">
			{#each ['x', 'y', 'z'] as const as axis (axis)}
				{@const cv = commonValue(roots, (n) => round3(n.transform[key][axis]))}
				<div class="minifield">
					<label for="bt-{key}-{axis}">
						{axis.toUpperCase()}
						{#if key === 'scale'}
							<button
								type="button"
								class="axis-link"
								class:on={editorStore.scaleLink[axis]}
								title="Link this axis"
								onclick={() => editorStore.toggleScaleLink(axis)}
							></button>
						{/if}
					</label>
					<input
						id="bt-{key}-{axis}"
						type="number"
						{step}
						class:mixed={cv === MIXED}
						value={cv === MIXED ? '' : cv}
						placeholder={cv === MIXED ? '—' : ''}
						oninput={(e) => {
							const raw = (e.currentTarget as HTMLInputElement).value;
							if (raw === '') return;
							const v = parseFloat(raw);
							if (isNaN(v)) return;
							docStore.mark('bt:' + key + axis);
							roots.forEach((n) => {
								if (key === 'scale') applyLinkedScale(n, axis, v);
								else n.transform[key][axis] = v;
							});
							engine.requestSync();
						}}
					/>
				</div>
			{/each}
		</div>
	</div>
{/snippet}

{#snippet offsetRow(roots: SceneNode[])}
	<div class="field">
		<div class="field-label"><span class="fname">Offset all</span><span class="fval">enter to apply</span></div>
		<div class="row3">
			{#each ['x', 'y', 'z'] as const as axis (axis)}
				<div class="minifield">
					<label for="offset-{axis}">Δ{axis.toUpperCase()}</label>
					<input
						id="offset-{axis}"
						type="number"
						step="0.1"
						value="0"
						onkeydown={(e) => {
							if (e.key !== 'Enter') return;
							const input = e.currentTarget as HTMLInputElement;
							const d = parseFloat(input.value) || 0;
							if (!d) return;
							docStore.mark(null);
							roots.forEach((n) => {
								n.transform.position[axis] = round3(n.transform.position[axis] + d);
							});
							input.value = '0';
							engine.requestSync();
						}}
					/>
				</div>
			{/each}
		</div>
	</div>
{/snippet}

{#snippet batchTransformSection(roots: SceneNode[])}
	<div class="section">
		<div class="section-title">Transform (batch)</div>
		{@render batchTriple('Position', roots, 'position', 0.1)}
		{@render batchTriple('Rotation °', roots, 'rotation', 5)}
		{@render batchTriple('Scale', roots, 'scale', 0.1)}
		{@render offsetRow(roots)}
		<BtnRow
			label="Uniform scale"
			buttons={[
				{ label: '×0.9', onClick: () => scaleAll(roots, 0.9) },
				{ label: '×1.1', onClick: () => scaleAll(roots, 1.1) },
				{ label: '×0.5', onClick: () => scaleAll(roots, 0.5) },
				{ label: '×2', onClick: () => scaleAll(roots, 2) }
			]}
		/>
		<BtnRow
			label="Size"
			buttons={[
				{
					label: 'Apply scale',
					title: 'Fold each scale into its own shape and reset scale to 1',
					onClick: () => engine.applyScaleToSelection()
				},
				{
					label: `Round ${editorStore.snapStep}`,
					title: `Round every dimension to whole ${editorStore.snapStep}-unit steps`,
					onClick: () => engine.roundDimensionsToStep()
				}
			]}
		/>
		{#if editorStore.dimensionClipboard}
			<BtnRow
				label={`Paste size from ${editorStore.dimensionClipboard.from}`}
				buttons={[
					{ label: 'X', active: pasteAxes.x, onClick: () => (pasteAxes.x = !pasteAxes.x) },
					{ label: 'Y', active: pasteAxes.y, onClick: () => (pasteAxes.y = !pasteAxes.y) },
					{ label: 'Z', active: pasteAxes.z, onClick: () => (pasteAxes.z = !pasteAxes.z) },
					{ label: 'Paste', onClick: () => engine.pasteDimensionsToSelection(pasteAxes) }
				]}
			/>
		{/if}
		<BtnRow
			label="Flip across plane"
			buttons={[
				{ label: 'XY', onClick: () => engine.flipAcross('xy') },
				{ label: 'YZ', onClick: () => engine.flipAcross('yz') },
				{ label: 'ZX', onClick: () => engine.flipAcross('zx') }
			]}
		/>
		<BtnRow
			label="Reset"
			buttons={[
				{ label: 'Position', onClick: () => engine.resetTransform('position') },
				{ label: 'Rotation', onClick: () => engine.resetTransform('rotation') },
				{ label: 'Scale', onClick: () => engine.resetTransform('scale') }
			]}
		/>
	</div>
{/snippet}

{#snippet arrangeSection(roots: SceneNode[])}
	<div class="section">
		<div class="section-title">Arrange</div>
		{#each ['x', 'y', 'z'] as const as axis (axis)}
			<BtnRow
				label={'Align ' + axis.toUpperCase()}
				buttons={[
					{ label: 'min', onClick: () => engine.alignSelection(axis, 'min') },
					{ label: 'center', onClick: () => engine.alignSelection(axis, 'center') },
					{ label: 'max', onClick: () => engine.alignSelection(axis, 'max') },
					{ label: 'spread', title: 'Distribute evenly', onClick: () => engine.distributeSelection(axis) }
				]}
			/>
		{/each}
		<BtnRow
			label="Tools"
			buttons={[
				{ label: 'Drop to ground', onClick: () => engine.dropToGround() },
				{ label: 'Randomize', title: 'Jitter rotation + scale', onClick: () => engine.randomizeSelection() }
			]}
		/>
	</div>
{/snippet}

{#snippet batchGeometrySection(meshes: PrimitiveNode[])}
	{#if meshes.length}
		{@const type = commonValue(meshes, (n) => n.type)}
		<div class="section">
			{#if type === MIXED}
				<div class="section-title">Shape (batch)</div>
				<div class="batch-note">
					Selection mixes shape types, so shape parameters are hidden. Select objects of a single type to
					batch-edit their geometry.
				</div>
			{:else}
				{@const t = type as PrimitiveType}
				<div class="section-title">{GEO_DEFS[t].label} shape (batch)</div>
				{#each GEO_DEFS[t].fields as fld (fld.key)}
					{@const cv = commonValue(meshes, (n) => n.geometry[fld.key])}
					{#if fld.bool}
						<FieldToggle
							label={fld.label}
							value={cv === MIXED ? false : !!cv}
							mixed={cv === MIXED}
							onchange={(v) => {
								docStore.mark('bg:' + fld.key);
								meshes.forEach((n) => {
									n.geometry[fld.key] = v;
									engine.syncLinked(n);
								});
								engine.requestSync();
							}}
						/>
					{:else}
						{@const val = cv === MIXED ? avgValue(meshes, (n) => n.geometry[fld.key] as number) : (cv as number)}
						<FieldSlider
							label={fld.label}
							value={val}
							min={fld.min ?? 0}
							max={fld.max ?? 1}
							step={fld.step ?? 0.01}
							int={fld.int}
							unit={fld.unit}
							mixed={cv === MIXED}
							oninput={(v) => {
								docStore.mark('bg:' + fld.key);
								meshes.forEach((n) => {
									n.geometry[fld.key] = v;
									engine.syncLinked(n);
								});
								engine.requestSync();
							}}
						/>
					{/if}
				{/each}
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet batchSlider(
	meshes: PrimitiveNode[],
	label: string,
	get: (n: PrimitiveNode) => number,
	set: (id: string, v: number) => void,
	min: number,
	max: number,
	step: number,
	int: boolean
)}
	{@const cv = commonValue(meshes, get)}
	{@const val = cv === MIXED ? avgValue(meshes, get) : (cv as number)}
	<FieldSlider
		{label}
		value={val}
		{min}
		{max}
		{step}
		{int}
		mixed={cv === MIXED}
		oninput={(v) => engine.batchEditMaterial(meshes, (id) => {
			docStore.mark('bm:' + label);
			set(id, v);
		})}
	/>
{/snippet}

{#snippet batchToggle(
	meshes: PrimitiveNode[],
	label: string,
	get: (n: PrimitiveNode) => boolean,
	set: (id: string, v: boolean) => void
)}
	{@const cv = commonValue(meshes, get)}
	<FieldToggle
		{label}
		value={cv === MIXED ? false : !!cv}
		mixed={cv === MIXED}
		onchange={(v) => engine.batchEditMaterial(meshes, (id) => {
			docStore.mark('bm:' + label);
			set(id, v);
		})}
	/>
{/snippet}

{#snippet batchMaterialSection(meshes: PrimitiveNode[])}
	{#if meshes.length}
		{@const cvColor = commonValue(meshes, (n) => material(n).color)}
		{@const cvEm = commonValue(meshes, (n) => material(n).emissive)}
		{@const cvSide = commonValue(meshes, (n) => material(n).side)}
		{@const cvTex = commonValue(meshes, (n) => material(n).texture.type)}
		<div class="section">
			<div class="section-title">Material (batch)</div>
			<FieldColor
				label="Color"
				value={cvColor === MIXED ? '#96897c' : (cvColor as string)}
				mixed={cvColor === MIXED}
				onchange={(v) => engine.batchEditMaterial(meshes, (id) => {
					docStore.mark('bm:color');
					docStore.doc.materials[id].color = v;
				})}
			/>
			<Swatches
				onPick={(c) => engine.batchEditMaterial(meshes, (id) => {
					docStore.mark('bm:swatch');
					docStore.doc.materials[id].color = c;
				})}
			/>

			{@render batchSlider(
				meshes,
				'Roughness',
				(n) => material(n).roughness,
				(id, v) => (docStore.doc.materials[id].roughness = v),
				0,
				1,
				0.01,
				false
			)}
			{@render batchSlider(
				meshes,
				'Metalness',
				(n) => material(n).metalness,
				(id, v) => (docStore.doc.materials[id].metalness = v),
				0,
				1,
				0.01,
				false
			)}
			{@render batchToggle(
				meshes,
				'Flat shading',
				(n) => material(n).flatShading,
				(id, v) => (docStore.doc.materials[id].flatShading = v)
			)}
			{@render batchToggle(
				meshes,
				'Wireframe',
				(n) => material(n).wireframe,
				(id, v) => (docStore.doc.materials[id].wireframe = v)
			)}
			{@render batchToggle(
				meshes,
				'Transparent',
				(n) => material(n).transparent,
				(id, v) => (docStore.doc.materials[id].transparent = v)
			)}
			{@render batchSlider(
				meshes,
				'Opacity',
				(n) => material(n).opacity,
				(id, v) => (docStore.doc.materials[id].opacity = v),
				0,
				1,
				0.01,
				false
			)}

			<FieldColor
				label="Emissive"
				value={cvEm === MIXED ? '#000000' : (cvEm as string)}
				mixed={cvEm === MIXED}
				onchange={(v) => engine.batchEditMaterial(meshes, (id) => {
					docStore.mark('bm:emissive');
					docStore.doc.materials[id].emissive = v;
				})}
			/>
			{@render batchSlider(
				meshes,
				'Emissive intensity',
				(n) => material(n).emissiveIntensity,
				(id, v) => (docStore.doc.materials[id].emissiveIntensity = v),
				0,
				3,
				0.05,
				false
			)}

			<FieldSegmented
				label="Side"
				value={cvSide === MIXED ? 'front' : (cvSide as string)}
				options={[
					{ value: 'front', label: cvSide === MIXED ? 'Front (mixed)' : 'Front' },
					{ value: 'back', label: 'Back' },
					{ value: 'double', label: 'Double' }
				]}
				onchange={(v) => engine.batchEditMaterial(meshes, (id) => {
					docStore.mark('bm:side');
					docStore.doc.materials[id].side = v as MaterialSpec['side'];
				})}
			/>

			<BtnRow
				label="Image map"
				buttons={[
					{
						label: 'Choose',
						onClick: () => assignImageTexture(...meshes.map((n) => material(n)))
					}
				]}
			/>
			<FieldSelect
				label="Pattern"
				value={cvTex === MIXED || cvTex === 'image' ? 'none' : (cvTex as string)}
				options={[
					{ value: 'none', label: cvTex === MIXED ? 'None (mixed)' : 'None' },
					{ value: 'checker', label: 'Checker' },
					{ value: 'stripes', label: 'Stripes' },
					{ value: 'speckle', label: 'Speckle' }
				]}
				onchange={(v) => {
					docStore.mark('btex');
					meshes.forEach((n) => {
						const m = material(n);
						m.texture.type = v as MaterialSpec['texture']['type'];
						if (v !== 'image') m.texture.assetId = null;
						if (v !== 'none' && !m.texture.colorA) {
							m.texture.colorA = m.color;
							m.texture.colorB = shadeColor(m.color, -0.2);
						}
					});
					engine.requestSync();
				}}
			/>
			{#if cvTex !== MIXED && cvTex !== 'none' && cvTex !== 'image'}
				{@render batchSlider(
					meshes,
					cvTex === 'speckle' ? 'Density' : 'Tiles',
					(n) => material(n).texture.tiles,
					(id, v) => (docStore.doc.materials[id].texture.tiles = v),
					2,
					24,
					1,
					true
				)}
				<BtnRow
					label="Texture colors"
					buttons={[
						{
							label: 'Auto from base',
							title: "Derive A/B from each object's own color",
							onClick: () => {
								docStore.mark(null);
								meshes.forEach((n) => {
									const m = material(n);
									m.texture.colorA = m.color;
									m.texture.colorB = shadeColor(m.color, -0.2);
								});
								engine.requestSync();
								editorStore.toast('Texture colors matched');
							}
						}
					]}
				/>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet batchShadowSection(meshes: (PrimitiveNode | MeshNode | ImportedNode)[])}
	{#if meshes.length}
		{@const cvCast = commonValue(meshes, (n) => n.castShadow)}
		{@const cvRecv = commonValue(meshes, (n) => n.receiveShadow)}
		<div class="section">
			<div class="section-title">Shadows (batch)</div>
			<FieldToggle
				label="Cast shadow"
				value={cvCast === MIXED ? false : !!cvCast}
				mixed={cvCast === MIXED}
				onchange={(v) => {
					docStore.mark('bcast');
					meshes.forEach((n) => (n.castShadow = v));
					engine.requestSync();
				}}
			/>
			<FieldToggle
				label="Receive shadow"
				value={cvRecv === MIXED ? false : !!cvRecv}
				mixed={cvRecv === MIXED}
				onchange={(v) => {
					docStore.mark('brecv');
					meshes.forEach((n) => (n.receiveShadow = v));
					engine.requestSync();
				}}
			/>
			<BtnRow label="Material" buttons={[{ label: 'Paste copied material', onClick: () => engine.pasteMaterialToSelection() }]} />
		</div>
	{/if}
{/snippet}

<!--
	Imported meshes can't have their file materials edited in place, but they
	can all be given one override colour — which is the only way to paint a
	group of GLB parts, and previously wasn't offered at all because every
	batch panel filtered down to primitives first.
-->
{#snippet importedOverrideSection(nodes: (PrimitiveNode | MeshNode | ImportedNode)[])}
	{@const imports = nodes.filter(isImported)}
	{#if imports.length}
		{@const overridden = imports.filter((n) => n.materialOverride).length}
		<div class="section">
			<div class="section-title">Imported meshes ({imports.length})</div>
			<div class="batch-note">
				{#if overridden === imports.length}
					All {imports.length} are painted with an override colour. Select one on its own to change it.
				{:else}
					{imports.length - overridden} of these use the materials from their own file, which Propsize can't
					edit directly. Override them to paint them with one colour.
				{/if}
			</div>
			<BtnRow
				buttons={[
					{
						label: overridden === imports.length ? 'Restore file materials' : `Override ${imports.length - overridden}`,
						onClick: () => {
							docStore.mark(null);
							if (overridden === imports.length) imports.forEach((n) => engine.clearMaterialOverride(n));
							else imports.filter((n) => !n.materialOverride).forEach((n) => engine.enableMaterialOverride(n));
							engine.requestSync();
						}
					},
					{ label: 'Paste copied material', onClick: () => engine.pasteMaterialToSelection() }
				]}
			/>
		</div>
	{/if}
{/snippet}

{#snippet multiInspector()}
	{@const roots = docStore.selectionRoots()}
	{@const paintable = docStore.selectionMeshes(editorStore.batchIncludeChildren)}
	{@const meshes = paintable.filter(isPrimitive)}

	<div class="section-title">{selected.length} objects selected</div>

	<div class="section">
		<FieldToggle
			label="Include children"
			value={editorStore.batchIncludeChildren}
			onchange={(v) => (editorStore.batchIncludeChildren = v)}
		/>
		<div class="batch-note">
			Transforms apply to {roots.length} top-level object{roots.length === 1 ? '' : 's'}. Surface applies to
			{paintable.length} mesh{paintable.length === 1 ? '' : 'es'}{meshes.length !== paintable.length
				? `, of which ${meshes.length} ${meshes.length === 1 ? 'has' : 'have'} editable shape fields`
				: ''}.
		</div>
	</div>

	<div class="itabs">
		<div
			class="itab"
			class:active={editorStore.inspectorTab === 'shape'}
			onclick={() => (editorStore.inspectorTab = 'shape')}
		>
			Shape
		</div>
		<div
			class="itab"
			class:active={editorStore.inspectorTab === 'surface'}
			onclick={() => (editorStore.inspectorTab = 'surface')}
		>
			Surface
		</div>
	</div>

	{#if editorStore.inspectorTab === 'shape'}
		{@render batchTransformSection(roots)}
		{@render arrangeSection(roots)}
		{@render batchGeometrySection(meshes)}
	{:else}
		{@render batchMaterialSection(meshes)}
		{@render batchShadowSection(paintable)}
		{@render importedOverrideSection(paintable)}
	{/if}
{/snippet}

<div id="inspect">
	<div class="panel-head">
		<span>Inspector</span>
		<button class="panel-collapse" title="Collapse panel" onclick={() => (editorStore.rightPanelOpen = false)}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6 L15 12 L9 18" /></svg>
		</button>
	</div>
	<div id="inspect-body">
		{#if selected.length === 0}
			<div class="empty-inspect">
				Select an object in the viewport or hierarchy to edit it.<br /><br />
				Add primitives from the shape tray, then use the actions under the hierarchy to group, duplicate or delete.
			</div>
		{:else if single}
			<!-- Keyed on the selected id so switching objects tears down and
			     rebuilds the fields below rather than patching them in place.
			     Matters most for the native colour <input>s: a browser's colour
			     picker (particularly macOS's floating system panel, which isn't
			     otherwise tied to page focus) can be left open across a
			     selection change, and only destroying the input closes it and
			     guarantees the next open shows the newly-selected object's
			     actual colour instead of a stale one. -->
			{#key single.id}
				{@render singleInspector(single)}
			{/key}
		{:else}
			<!-- Sorted before joining so the key reflects *membership*, not click
			     order — ctrl-clicking the same set of objects in a different
			     sequence (e.g. deselect-then-reselect one) would otherwise still
			     change the key and tear the fields down, the same colour-picker
			     problem the single-selection key above exists to avoid. -->
			{#key [...docStore.selectedIds].sort().join(',')}
				{@render multiInspector()}
			{/key}
		{/if}
	</div>
</div>
