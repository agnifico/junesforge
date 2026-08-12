

<script>
    import { currentScreenId } from '$lib/console-store.js';
</script>

<div class="screentab" id="wd-screen">
    <button class="back-button" on:click={() => currentScreenId.set('menu')}>(B)ack</button>
    
    <div class="screen-left">
        <div class="sc-heading">Web Design</div>
        <div class="sc-text">
            <span class="red">
                - Anyone can make a website (try Framer).<br />
                - Every brand has one.<br />
            </span>
            How do you make yours stand out?
            <br /><br />
            With human-centric sensibilities in UX/UI, stimulating sound design, and thoughtful content,
            <span class="green">the audience is at least curious, and at best a customer;</span>
            whatever it is that you're trying to "sell" - ideas / products / yourself.
            <br />
            <span class="green"> I make stuff that sells. </span>
        </div>
        <img src="/down-arrow.png" alt="scroll down" class="scroll-indicator" />
    </div>
    <div class="screen-right">
        <div class="text-bubbles">
            <li class="tool">Svelte ♥︎</li>
            <li class="tool">node.js</li>
            <li class="tool">Github Pages</li>
            <li class="tool">Wordpress/Wix</li>
            <li class="tool">HTML / CSS / JS (obviously)</li>
            <li>UX / UI</li>
            <li>Portfolio Websites</li>
            <li>Product Listings</li>
            <li>Content Management System</li>
            <li>Branding</li>
            <li>Single Page Apps</li>
            <li>Restaurant Web Menus</li>
            <li>Responsive Design</li>
            <li>Custom Design</li>
        </div>
    </div>
</div>

<style>
    .screentab {
        display: flex;
        height: 100%;
        width: 100%;
        padding: 1rem;
        padding-top: 0;
        gap: 1rem;
        font-family: 'Fira Code';
    }

    .screen-left, .screen-right {
        padding-top: 1rem;
        height: 100%;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: none; /* For Firefox */
    }
    .screen-left::-webkit-scrollbar, .screen-right::-webkit-scrollbar {
        display: none; /* For Chrome, Safari, and Opera */
    }

    .screen-left {
        flex: 1; /* Takes up the remaining space */
        position: relative;
    }

    .screen-right {
        flex-basis: 12rem;
        width: 200px; /* Keeping user's width */
        background-color: #00000039;
        padding-inline: 1rem 2rem;
        border-radius: 0px; /* Keeping user's radius */
        box-sizing: border-box;
        transform: translateY(6px);
        height: calc(100% - 6px);
    }

    .sc-heading {
        width: 100%;
        color: #44c6a7;
        font-size: 1.3rem;
        text-align: left;
        border-bottom: 2px solid #44c6a7;
        margin-bottom: 0.5rem;
        font-family: 'Silkscreen';
    }

    .sc-text {
        font-size: 1rem;
        color: #cacaca;
        font-family: 'Ubuntu Mono';
    }

    .sc-text .red {
        color: #d88383;
    }

    .sc-text .green {
        color: #44c6a7;
    }

    .text-bubbles {
        height: min-content;
        font-family: 'Raleway';
        font-size: 0.8rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .text-bubbles li {
        color: #1d1d1d;
        height: max-content;
        word-wrap: normal;
        list-style: none;
        padding: 4px 8px;
        background-color: #cacaca;
        border-radius: 6px;
        flex-grow: 1;
        box-shadow: 2px 2px 0 0 #21715e;
        font-weight: 600;
    }

    .text-bubbles .tool {
        background-color: #21715e;
        color: #bcf8ea;
        box-shadow: 2px 2px 0 0 #bfe1d9ab;
    }

    .scroll-indicator {
        display: none; /* Hidden by default */
        position: relative;
        left: 0rem;
        bottom: -1rem;
        /* transform: translateX(-50%); */
        width: 30px;
        height: 30px;
        opacity: 0.7;
        /* animation: bounce 2s infinite; */
    }

    @keyframes bounce {
        0%, 20%, 50%, 80%, 100% {
            transform: translateX(-50%) translateY(0);
        }
        40% {
            transform: translateX(-50%) translateY(-10px);
        }
        60% {
            transform: translateX(-50%) translateY(-5px);
        }
    }

    /* Mobile responsiveness */
    @media (max-width: 768px) {
        .screentab {
            flex-direction: column;
            overflow-y: auto;
            overscroll-behavior: contain;
            padding: 0;
            scrollbar-width: none;
        }

        .screen-left, .screen-right {
            overflow-y: visible;
            height: auto;
            flex-basis: auto;
            width: 90%;
            padding-inline: 1rem;
        }

        .screen-right {
            width: 100%;
            flex-shrink: 0;
            margin-top: 2rem;
            margin-inline: auto;
        }

        .scroll-indicator {
            display: block; /* Show on mobile */
        }
    }

    
.back-button {
        position: absolute;
        bottom: 1rem;
        left: 1rem;
        background: #383838;
        border: 1px solid white;
        color: white;
        font-family: 'Silkscreen', monospace;
        padding: 0.25rem .5rem;
        cursor: pointer;
        z-index: 10;
    }

    @media (max-width: 768px) {
        .back-button {
            left: auto;
            right: 1rem;
        }
    }
    
</style>