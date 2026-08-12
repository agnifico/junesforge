<!-- <p>
    Hey there! <br>
    Hope you stay a while. <br>
    Enjoy! :)
</p> -->

<div class="cube-container">
    <div class="cube">
      <div class="face front"></div>
      <div class="face back"></div>
      <div class="face left"></div>
      <div class="face right"></div>
      <div class="face top"></div>
      <div class="face bottom"></div>
    </div>
  </div>
  
  <style>
      :root {
        --vibranium: #131313;
          --cross-shape: polygon(0 30%, 30% 30%, 30% 0, 70% 0, 70% 30%, 100% 30%, 100% 70%, 70% 70%, 70% 100%, 30% 100%, 30% 70%, 0 71%);
          --x-shape: polygon(20% 0%, 0% 20%, 30% 50%, 0% 80%, 20% 100%, 50% 70%, 80% 100%, 100% 80%, 70% 50%, 100% 20%, 80% 0%, 50% 30%);
          --square-shape: polygon(0% 30%, 0 0, 30% 0%, 70% 0%, 100% 0, 100% 30%, 100% 70%, 100% 100%, 70% 100%, 30% 100%, 0 100%, 0% 70%);
          --leaf-shape: polygon(12% 56%, 30% 31%, 50% 16%, 75% 6%, 100% 0, 94% 25%, 84% 50%, 70% 70%, 51% 84%, 23% 96%, 0 100%, 4% 77%);
          --star-shape: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%, 39% 35%, 39% 35%);
      }
  
      p {
          color: var(--malachite);
          font-family: "Dogica Pixel";
          font-size: .75rem;
          text-align: center;
          margin: auto 1rem 0;
          
      }
  
      .cube-container {
          width: 200px;
          height: 200px;
          perspective: 500px;
          margin: auto;
      }
  
      .cube {
          position: relative;
          width: 200px;
          height: 200px;
          transform-style: preserve-3d;
          /* animation: turn 20s linear infinite; */
      }
  
      .face {
          width: 200px;
          height: 200px;
          /* background: #7b18bd; */
          opacity: .8;
          border: 2px solid var(--gold, rgb(130, 121, 70)); /* Added fallback for --gold */
          border: 2px solid #46b08b;
          position: absolute;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: Arial, sans-serif;
          font-size: 2rem;
          transition: all 2s ease-in-out;
          clip-path: var(--leaf-shape);
  
      }
  
      .front {
          transform: rotateZ(15deg);
          animation: front-ani 5s ease-in-out infinite;
      }
  
      .back {
          transform: rotateZ(30deg);
          animation: back-ani 5s ease-in-out infinite;
      }
  
      .left {
          transform: rotateZ(45deg);
          animation: left-ani 5s ease-in-out infinite;
      }
  
      .right {
          transform: rotateZ(-15deg);
          animation: right-ani 5s ease-in-out infinite;
      }
  
      .top {
          transform: rotateZ(-30deg);
          animation: top-ani 5s ease-in-out infinite;
      }
  
      .bottom {
          transform: rotateZ(-45deg);
          animation: bottom-ani 5s ease-in-out infinite;
      }
  
      @media (prefers-reduced-motion: reduce) {
          .cube {
              animation: none;
              transform: rotate3d(1, 1, 0, 45deg);
          }
      }
  
      @keyframes turn {
          from {
              transform: rotate3d(0, 0, 0, 0);
          }
          to {
              transform: rotate3d(-1, 1, 0, 900deg);
          }
      }
  
      @keyframes front-ani {
          0%, 100% {
              clip-path: var(--square-shape);
              transform: translateZ(100px);
              background-color: var(--vibranium);
              background: transparent;
          }
          25%, 75% {
              clip-path: var(--leaf-shape);
              background: rgb(63,153,119,.1);
          }
          50% {
              transform-origin: bottom left;
              clip-path: var(--leaf-shape);
              transform: rotateZ(45deg);
              background-color: #46b08b;
          }
      }
  
      @keyframes back-ani {
          0%, 100% {
              clip-path: var(--square-shape);
              transform: translateZ(-100px) rotatey(180deg);
              background-color: var(--vibranium);
              background: transparent;
          }
          25%, 75% {
              clip-path: var(--leaf-shape);
              background: rgb(63,153,119,.1);
          }
          50% {
              transform-origin: bottom left;
              clip-path: var(--leaf-shape);
              transform: rotateZ(30deg);
              background-color: #3a9c7a;
          }
      }
  
      @keyframes left-ani {
          0%, 100% {
              clip-path: var(--square-shape);
              transform: translateX(-100px) rotateY(90deg) rotateZ(90deg);
              background-color: var(--vibranium);
              background: transparent;
          }
          25%, 75% {
              clip-path: var(--leaf-shape);
              background: rgb(63,153,119,.1);
          }
          50% {
              transform-origin: bottom left;
              clip-path: var(--leaf-shape);
              transform: rotateZ(15deg);
              background-color: #49c398;
          }
      }
  
      @keyframes right-ani {
          0%, 100% {
              clip-path: var(--square-shape);
              transform: translateX(100px) rotateY(-90deg) rotateZ(90deg);
              background-color: var(--vibranium);
              background: transparent;
          }
          25%, 75% {
              clip-path: var(--leaf-shape);
              background: rgb(63,153,119,.1);
          }
          50% {
              transform-origin: bottom left;
              clip-path: var(--leaf-shape);
              transform: rotateZ(-15deg);
              background-color: #54c89f;
          }
      }
  
      @keyframes top-ani {
          0%, 100% {
              clip-path: var(--square-shape);
              transform: translateY(100px) rotateX(90deg);
              background-color: var(--vibranium);
              background: transparent;
          }
          25%, 75% {
              clip-path: var(--leaf-shape);
              background: rgb(63,153,119,.1);
          }
          50% {
              transform-origin: bottom left;
              clip-path: var(--leaf-shape);
              transform: rotateZ(-30deg);
              background-color: #46b08b;
          }
      }
  
      @keyframes bottom-ani {
          0%, 100% {
              clip-path: var(--square-shape);
              transform: translateY(-100px) rotateX(-90deg);
              background-color: var(--vibranium);
              background: transparent;
          }
          25%, 75% {
              clip-path: var(--leaf-shape);
              background: rgb(63,153,119,.1);
          }
          50% {
              transform-origin: bottom left;
              clip-path: var(--leaf-shape);
              transform: rotateZ(-45deg);
              background-color: rgb(63, 150, 119);
          }
      }
  </style>