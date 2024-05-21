<template>
  <div>
    <canvas id="renderCanvas" touch-action="none" style="width: 100%; height: 100%;"></canvas>
  </div>
</template>

<script>
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  Layer,
  SceneLoader,
  HemisphericLight,
  VideoTexture
} from "@babylonjs/core";
import "@babylonjs/loaders";

export default {
  name: "BabylonCpn",
  data() {
    return {
      engine: null,
      scene: null,
      camera: null,
    };
  },
  mounted() {
    this.initializeBabylon();
  },
  methods: {
    async initializeBabylon() {
      // Lấy thẻ canvas
      var canvas = document.getElementById("renderCanvas");

      // Khởi tạo Babylon.js Engine
      var engine = new Engine(canvas, true);

      // Tạo một scene
      var createScene = async () => {
        var scene = new Scene(engine);

        // Thêm ánh sáng để có thể thấy được mô hình
        var light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
        light.intensity = 0.7;
            // Thêm camera
        const camera = new ArcRotateCamera('mainCam', 0, Math.PI/2, 6, Vector3.Zero(), scene, true);
        camera.attachControl(canvas, true);
        camera.attachControl(canvas);

     // Tạo một phần tử video
     const videoLayer = new Layer('videoLayer', null, scene, true);
     const videoTexture = 
        VideoTexture
        .CreateFromWebCam(
            scene, (videoTexture) => {
                videoTexture._invertY = false;
                videoTexture
                videoLayer.texture = videoTexture;
            }, {
                minWidth: 640,
                minHeight: 480,
                maxWidth: 1920,
                maxHeight: 1080,
                deviceId: ''
            });
    // Tải mô hình 3D
    SceneLoader.ImportMesh("", "/models/yasuo/", "scene.gltf", scene, function (meshes) {
      // Đặt vị trí của mô hình nếu cần
      meshes.forEach(function (mesh) {
        mesh.position.y = 0;
        mesh.position.z = 0;
      });
    }, null, function (scene, message) {
      console.error(message);
    });

    return scene;
  };

  // Tạo scene
  var scene = await createScene();

  // Render loop
  engine.runRenderLoop(function () {
    scene.render();
  });

  // Resize
  window.addEventListener("resize", function () {
    engine.resize();
  });
}
  }}
</script>

<style>
body {
  margin: 0;
  overflow: hidden;
}
</style>



