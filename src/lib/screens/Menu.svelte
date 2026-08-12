<script>
    import { menuHighlightedIndex, currentScreenId } from '$lib/console-store.js';
    import { menuItems } from '$lib/console-map.js';
    import { gsap } from 'gsap';
    import { playHoverSound, playClickSound } from '../utils/sounds.js';

    let arrowElement;

    function handleMouseOver(index) {
        menuHighlightedIndex.set(index);
        playHoverSound();
    }

    function handleClick(index) {
        const selectedScreenId = menuItems[index].id;
        currentScreenId.set(selectedScreenId);
        playClickSound();
    }

    // Reactive statement to trigger animation when the highlighted index changes
    $: if (arrowElement) {
        gsap.fromTo(arrowElement, { x: -10, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, ease: 'elastic.out(1, 0.5)' });
    }
</script>

<div class="menu-container">
    <ul>
        {#each menuItems as item, i}
            <li 
                class="menu-item"
                class:highlighted={i === $menuHighlightedIndex}
                on:mouseover={() => handleMouseOver(i)}
                on:click={() => handleClick(i)}
            >
                <div class="arrow-container">
                    {#if i === $menuHighlightedIndex}
                        <img src="/right-arrow.png" alt=">" class="arrow" bind:this={arrowElement} />
                    {/if}
                </div>
                <span>{item.label}</span>
            </li>
        {/each}
    </ul>
</div>
<p>Press A to select (or click/tap)</p>

<style>
    p {
        text-align: center;
        color: antiquewhite;
        font-family: "Dogica Pixel";
        font-size: .5rem;
    }
    .menu-container {
        padding: 2rem;
        font-family: 'Silkscreen', monospace; /* Assuming you have this font */
        color: white;
        font-size: 1.5rem;
    }
    ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    .menu-item {
        display: flex;
        align-items: center;
        padding: 0.5rem 0;
    }
    .arrow-container {
        width: 40px; /* a bit of space for the arrow */
        height: 30px;
    }
    .arrow {
        width: 30px;
        height: 30px;
    }

    .menu-item span, .menu-item .arrow {
        transition: transform 0.2s ease-out;
    }

    .menu-item.highlighted span {
        transform: translateX(10px);
        text-decoration: underline;
        color: rgb(122, 193, 136);
        cursor: pointer;
    }

    .menu-item.highlighted .arrow {
        transform: translateX(-10px);
    }

    .menu-item:hover span {
        transform: translateX(10px);
        text-decoration: underline;
    }

    .menu-item:hover .arrow {
        transform: translateX(-10px);
    }
</style>
