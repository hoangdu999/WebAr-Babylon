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
  MeshBuilder,
  Texture,
  StandardMaterial,
  SceneLoader,
  HemisphericLight,
  Color3,
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
    var camera = new ArcRotateCamera("camera", 0, Math.PI / 2, 10, new Vector3(0, 0, 0), scene);
    camera.attachControl(canvas, true);
    camera.lowerBetaLimit = Math.PI / 2;
    camera.upperBetaLimit = Math.PI / 2;
    camera.lowerAlphaLimit = null;
    camera.upperAlphaLimit = null;
    camera.wheelPrecision = 100;


     // Tạo một phần tử video
     const video = document.createElement("video");
    const constraints = {
      video: { facingMode: "environment" },
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    video.play();

    // Tạo video texture trong Babylon.js
    const videoTexture = new VideoTexture("videoTexture", video, scene, true, true);

    // Tùy chỉnh texture nếu cần
    videoTexture.uScale = -1; // Ví dụ: đảo ngược trục ngang
    

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



