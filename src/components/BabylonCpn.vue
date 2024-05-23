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
      this.scene = await this.createScene();

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
    },

    async createScene() {
      var scene = new Scene(this.engine);

      // Thêm ánh sáng
      this.addLight(scene);

      // Thêm camera
      this.camera = this.addCamera(scene);

      // Thêm video layer
      this.addVideoLayer(scene);

      // Thiết lập AR
      // await this.setupXR(scene);
      await this.loadModel(scene);
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

    addVideoLayer(scene) {
      const videoLayer = new Layer('videoLayer', null, scene, true);
      VideoTexture.CreateFromWebCam(
        scene,
        (videoTexture) => {
          videoTexture._invertY = false;
          videoLayer.texture = videoTexture;
        },
        {
          minWidth: 640,
          minHeight: 480,
          maxWidth: 1920,
          maxHeight: 1080,
          deviceId: ''
        }
      );
    },

    async loadModel(scene) {
      await SceneLoader.ImportMesh("", "/models/yasuo/", "scene.gltf", scene, (meshes) => {
        // Đặt vị trí của mô hình nếu cần
        meshes.forEach((mesh) => {
          mesh.position.y = 0;
          mesh.position.z = 0;

          // Thêm các mesh vào Shadow Generator
          this.shadowGenerator.addShadowCaster(mesh);
        });
        this.model = meshes[0]; // Giả định mô hình chính là mesh đầu tiên
      }, null, (scene, message) => {
        console.error(message);
      });
    },

    setupTouchHandlers(canvas) {
      let touchStartTime = 0;
      let touchCount = 0;

      canvas.addEventListener('touchstart', (event) => {
        touchStartTime = new Date().getTime();
        touchCount = event.touches.length;

        if (touchCount === 2) {
          this.resetCameraPosition();
        }
      });

      canvas.addEventListener('touchend', (event) => {
        const touchEndTime = new Date().getTime();
        const touchDuration = touchEndTime - touchStartTime;

        if (touchDuration < 500 && touchCount === 1) {
          const touch = event.changedTouches[0];
          const pickResult = this.scene.pick(touch.clientX, touch.clientY);

          if (pickResult.hit && pickResult.pickedMesh.name === 'ground') {
            this.moveModelToPosition(pickResult.pickedPoint);
          }
        }
      });
    },

    resetCameraPosition() {
      this.camera.setTarget(new Vector3(0, 1, 0));
      this.camera.alpha = 7.349039862224447;
      this.camera.beta = 1.2023107691067825;
      this.camera.radius = 10;
    },

    moveModelToPosition(position) {
      if (this.model) {
        this.model.position = position;
        this.model.rotation = new Vector3(0, Math.random() * 2 * Math.PI, 0);

        // Tạo hoạt hình tỷ lệ
        const animation = new Animation(
          "scaleAnimation",
          "scaling",
          30,
          Animation.ANIMATIONTYPE_VECTOR3,
          Animation.ANIMATIONLOOPMODE_CYCLE
        );

        const keys = [];
        keys.push({ frame: 0, value: new Vector3(0.1, 0.1, 0.1) });
        keys.push({ frame: 15, value: new Vector3(1, 1, 1) });

        animation.setKeys(keys);
        this.model.animations = [];
        this.model.animations.push(animation);

        this.scene.beginAnimation(this.model, 0, 15, false);
      }
    },

    async setupXR(scene) {
      const xrHelper = await WebXRDefaultExperience.CreateAsync(scene, {
        floorMeshes: []
      });

      // Sử dụng tính năng plane detection để nhận diện địa hình
      const featuresManager = xrHelper.baseExperience.featuresManager;
      const xrPlanes = featuresManager.enableFeature(
        WebXRPlaneDetector.Name,
        "latest"
      );

      xrPlanes.onDetectedObservable.add((plane) => {
        console.log("Plane detected:", plane);

        if (!this.model) {
          return;
        }

        // Đặt mô hình trên mặt phẳng được phát hiện
        this.model.position = plane.polygonMesh.position.clone();
        this.model.rotationQuaternion = plane.polygonMesh.rotationQuaternion.clone();
        this.model.scaling = new Vector3(1, 1, 1);
      });

      return xrHelper;
    }
  }
}
</script>

<style>
body {
  margin: 0;
  overflow: hidden;
}
</style>
