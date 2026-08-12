<div class="bg-layer">
  <video autoplay muted loop id="myVideo">
    <source src="https://videos.pexels.com/video-files/9665235/9665235-hd_1920_1080_25fps.mp4" type="video/mp4">
  </video>
</div>

<style>
    .bg-layer {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: -1; /* Behind everything */
    }
    #myVideo {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 100%;
        height: 100%;
        object-fit: cover;
        transform: translate(-50%, -50%);
        filter: grayscale(0);
    }
</style>