<script>
    import { currentScreenId } from '$lib/console-store.js';
    const base = '.';
</script>

<div class="project-container">
    <button class="back-button" on:click={() => currentScreenId.set('projects')}>(B)ack</button>

    <div class="project-item">
        <p>
            The Idea : Thinking of your tools, your skills as a weapon. Sharpened, ever-ready to take on challenges! </p>
    </div>

    <div class="project-item">
        <img src="{base}/forge-scimitar.svg" alt="Forge Scimitar" />
        <p>A brush-shaped-leaf-shaped scimitar.</p>
    </div>

    <div class="project-item">
        <img src="{base}/forge-shield.svg" alt="Forge Shield" />
        <p>Tortoise shell shield, because you know web dev takes tenacity.</p>
    </div>

    <div class="project-item">
        <img src="{base}/forge-spear.svg" alt="Forge Spear" />
        <p>And a mountain/wall inspired spear, to break through your creative block.</p>
    </div>

</div>

<style>
    .project-container {
        position: relative;
        height: 100%;
        width: 100%;
        overflow-y: auto;
        scrollbar-width: none;
        padding: 2rem;
        color: white;
        font-family: 'Ubuntu Mono', monospace;
    }
    .project-container::-webkit-scrollbar {
        display: none;
    }
    .project-item {
        position: relative;
        margin-bottom: 3rem;
        text-align: center;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }
    .project-item img {
        max-width: 80%;
        height: auto;
        margin-bottom: 1rem;
        background-color: #ffffff1a; /* Light background to see the SVGs */
        border-radius: 10px;
        padding: 1rem;
        box-sizing: border-box;
    }
    .project-item p {
        max-width: 60ch;
        margin-left: auto;
        margin-right: auto;
        text-align: justify;
        color: #cacaca;
        padding-inline: 1rem;
    }
    .back-button {
        position: sticky;
        top: -1rem;
        margin-left: 1rem;
        width: fit-content;
        margin-bottom: 1rem;
        background: #383838;
        border: 1px solid white;
        color: white;
        font-family: 'Silkscreen', monospace;
        padding: 0.25rem .5rem;
        cursor: pointer;
        z-index: 10;
    }
</style>