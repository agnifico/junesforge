
// portfolio/src/lib/utils/sounds.js

// Configuration object for easy sound switching
export const soundConfig = {
    hover: 'none',
    click: 'soft-click',
    external: 'hard-click',
    // You can add more sound types here
};

/**
 * Plays a sound based on its ID.
 * @param {string} soundId - The ID of the audio element to play.
 */
function playSound(soundId) {
    const audio = document.getElementById(soundId);
    if (audio) {
        audio.currentTime = 0; // Rewind to the start
        audio.play().catch(e => console.error("Error playing sound:", e));
    }
}

export function playHoverSound() {
    playSound(soundConfig.hover);
}

export function playClickSound() {
    playSound(soundConfig.click);
}

export function playExternalClickSound() {
    playSound(soundConfig.external);
}
