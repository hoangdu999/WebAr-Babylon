<template>
  <div>
    <canvas id="renderCanvas" touch-action="none" style="width: 100%; height: 100%;"></canvas>
    <div id="log"></div>
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
  VideoTexture,
  ShadowGenerator,
  DirectionalLight,
  Color3,
  MeshBuilder,
  WebXRPlaneDetector,
  WebXRDefaultExperience,
  Animation,
} from "@babylonjs/core";
import "@babylonjs/loaders";
import "@babylonjs/inspector";
import { ShadowOnlyMaterial } from '@babylonjs/materials';

export default {
  name: "BabylonCpn",
  data() {
    return {
      engine: null,
      scene: null,
      camera: null,
      shadowGenerator: null,
      model: null, // Thêm model vào data
      xr: null,
      planeDetected: false, 
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
      this.engine = new Engine(canvas, true);

      // Tạo scene
      this.scene = await this.createScene(canvas);

      // Render loop
      this.engine.runRenderLoop(() => {
        this.scene.render();
      });

      // Resize
      window.addEventListener("resize", () => {
        this.engine.resize();
      });
      // Thêm xử lý chạm
      //this.setupTouchHandlers(canvas);
      
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  this.logMessage('Canvas width: ' + canvas.width + ' Canvas height: ' + canvas.height);
    },

    async createScene(canvas) {
      var scene = new Scene(this.engine);

      // Thêm ánh sáng
      this.addLight(scene);

      // Thêm camera
      this.camera = this.addCamera(scene);

      // Thêm video layer
      this.addVideoLayer(scene, canvas);

      // Thiết lập AR
      await this.setupXR(scene);

      
      // Tạo mặt đất
      const ground = MeshBuilder.CreatePlane('ground', { size: 2000 }, scene);
      ground.rotation.x = Math.PI / 2;
      ground.material = new ShadowOnlyMaterial('shadowOnly', scene);
      ground.receiveShadows = true;
      ground.position.y = 0;

      return scene;
    },

    addLight(scene) {
      // Xóa ánh sáng mặc định nếu có
      scene.lights.forEach(light => light.dispose());

      // Tạo ánh sáng mới
      var light = new DirectionalLight("dirLight", new Vector3(-2, -3, 1), scene);
      light.position = new Vector3(6, 9, 3);

      // Tạo Shadow Generator
      this.shadowGenerator = new ShadowGenerator(1024, light);
      this.shadowGenerator.useBlurExponentialShadowMap = true;
      this.shadowGenerator.blurKernel = 32;
    },

    addCamera(scene) {
      // Điều chỉnh vị trí và góc quay của camera để có góc nhìn như trong hình
      const alpha = 7.349039862224447; // Góc quay quanh trục Y
      const beta = 1.2023107691067825; // Góc quay quanh trục X (đảm bảo mô hình lật ngược lên)
      const radius = 10; // Khoảng cách từ camera đến mục tiêu

      const camera = new ArcRotateCamera('mainCam', alpha, beta, radius, new Vector3(0, 1, 0), scene, true);
      camera.attachControl(scene.getEngine().getRenderingCanvas(), true);

      // Thêm sự kiện để in giá trị alpha, beta, radius khi camera thay đổi
      camera.onViewMatrixChangedObservable.add(() => {
        console.log(`Alpha: ${camera.alpha}, Beta: ${camera.beta}, Radius: ${camera.radius}`);
      });

      return camera;
    },

    addVideoLayer(scene, canvas) {
      
      var layer = new Layer("background", null, scene, true);

      // Yêu cầu quyền truy cập camera và micro
      navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: { exact: "environment" } // Yêu cầu camera phía sau (rear camera)
        }
      })
      .then((stream) => {
        // Tạo VideoTexture từ webcam với kích thước dựa trên kích thước của cửa sổ trình duyệt
        VideoTexture.CreateFromWebCam(scene, function (videoTexture) {
          videoTexture.uScale = 1.0;
          videoTexture.vScale = -1.0;
          layer.texture = videoTexture;
        
        }, {  maxWidth: 1920, maxHeight: 1080 ,facingMode: "environment"});
      })
      .catch((err) => {
        console.error("Error accessing camera and microphone: ", err);
      });
    },
    logMessage(message) {
      const logDiv = document.getElementById('log');
      logDiv.innerHTML += message + '<br>';
    },
    async loadModel(scene,position) {
      await SceneLoader.ImportMesh("", "/models/yasuo/", "scene.gltf", scene, (meshes) => {
        // Đặt vị trí của mô hình nếu cần
        meshes.forEach((mesh) => {
          mesh.position = position;

          // Thêm các mesh vào Shadow Generator
          this.shadowGenerator.addShadowCaster(mesh);
        });
        this.model = meshes[0]; // Giả định mô hình chính là mesh đầu tiên
      }, null, (scene, message) => {
        console.error(message);
      });
    },
    async setupXR(scene) {
      const xr = await scene.createDefaultXRExperienceAsync({
        uiOptions: {
          sessionMode: 'immersive-ar'
        },
        optionalFeatures: true,
      });

      this.xr = xr;

      const planeDetector = await xr.baseExperience.featuresManager.enableFeature(
        WebXRPlaneDetector.Name,
        'latest',
        { maxNumberOfTrackedPlanes: 1 }
      );

      planeDetector.onDetectedObservable.add((planes) => {
        if (!this.planeDetected) {
          planes.forEach(plane => {
            const position = plane.polygon.reduce((acc, point) => {
              acc.x += point.x;
              acc.y += point.y;
              acc.z += point.z;
              return acc;
            }, new Vector3(0, 0, 0)).scaleInPlace(1 / plane.polygon.length);
            
            this.loadModel(scene, position);
          });
          this.planeDetected = true;
        }
      });
    }
  }
}
</script>

<style>
body {
  margin: 0;
  overflow: hidden;
}
canvas{
  width: 100%;
  height: 100%;
}
</style>