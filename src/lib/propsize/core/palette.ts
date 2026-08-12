export const PALETTE: [string, string][] = [
	['#9a938c', 'Stone'],
	['#6b6560', 'Stone dark'],
	['#6b4a35', 'Bark'],
	['#d8cdb8', 'Birch bark'],
	['#4f7a3d', 'Leaf'],
	['#7fae57', 'Leaf light'],
	['#d8c48a', 'Sand'],
	['#4c88a0', 'Water']
];

export const randomPaletteColor = () => PALETTE[Math.floor(Math.random() * PALETTE.length)][0];
