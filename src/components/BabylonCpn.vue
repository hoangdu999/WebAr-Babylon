<template>
  <div>
    <canvas
      id="renderCanvas"
      touch-action="none"
      style="width: 100%; height: 100%"
    ></canvas>
    <div id="log"></div>
  </div>
</template>

<script>
import {
  Engine,
  Scene,
  FreeCamera,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator,
  SceneLoader,
  MeshBuilder,
  Quaternion,
  Color3,
  StandardMaterial,
  PolygonMeshBuilder,
  WebXRHitTest,
  WebXRPlaneDetector,
  WebXRAnchorSystem,
  WebXRBackgroundRemover,
  WebXRState,
  Vector2,
  AnimationPropertiesOverride,
} from "@babylonjs/core";
import "@babylonjs/loaders";
import "@babylonjs/inspector";
import earcut from "earcut"; // Đảm bảo rằng earcut được nhập vào

window.earcut = earcut; // Đảm bảo rằng earcut có sẵn toàn cầu

export default {
  name: "BabylonCpn",
  data() {
    return {
      engine: null,
      scene: null,
      camera: null,
      shadowGenerator: null,
      model: null,
      hitTest: null,
      marker: null,
      planes: [], // Biến để lưu trữ các planes
      xr: null, // Thêm biến xr vào data
    };
  },
  mounted() {
    this.initializeBabylon();
  },
  methods: {
    // Hàm khởi tạo BabylonJS và bắt đầu vòng lặp render
    async initializeBabylon() {
      const canvas = document.getElementById("renderCanvas");
      this.engine = new Engine(canvas, true);
      this.scene = await this.createScene(canvas);

      this.engine.runRenderLoop(() => {
        this.scene.render();
      });

      window.addEventListener("resize", () => {
        this.engine.resize();
      });

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      this.logMessage(`Canvas width: ${canvas.width} Canvas height: ${canvas.height}`);
    },

    // Hàm tạo và thiết lập scene
    async createScene(canvas) {
      const scene = new Scene(this.engine);
      this.createCamera(scene, canvas);
      this.createLights(scene);
      this.shadowGenerator = this.createShadowGenerator(scene);
      await this.loadModel(scene);
      this.marker = this.createMarker(scene);
      await this.setupXR(scene);
      return scene;
    },

    // Hàm tạo và cấu hình camera
    createCamera(scene, canvas) {
      this.camera = new FreeCamera("camera1", new Vector3(0, 1, -5), scene);
      this.camera.setTarget(Vector3.Zero());
      this.camera.attachControl(canvas, true);
    },

    // Hàm tạo và cấu hình các ánh sáng
    createLights(scene) {
      const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
      light.intensity = 0.7;

      const dirLight = new DirectionalLight('dirLight', new Vector3(0, -1, -0.5), scene);
      dirLight.position = new Vector3(0, 5, -5);
    },

    // Hàm tạo và cấu hình shadow generator
    createShadowGenerator(scene) {
      const dirLight = scene.getLightByName('dirLight');
      const shadowGenerator = new ShadowGenerator(1024, dirLight);
      shadowGenerator.useBlurExponentialShadowMap = true;
      shadowGenerator.blurKernel = 32;
      return shadowGenerator;
    },

    // Hàm tải mô hình 3D và thiết lập các thuộc tính
    async loadModel(scene) {
      const result = await SceneLoader.ImportMeshAsync("", "models/", "robot.glb", scene);
      this.model = result.meshes[0];
      this.model.rotationQuaternion = new Quaternion();
      this.shadowGenerator.addShadowCaster(this.model, true);
      this.setupAnimations(scene, result.skeletons[0]);
    },

    // Hàm thiết lập animation cho mô hình
    setupAnimations(scene, skeleton) {
      skeleton.animationPropertiesOverride = new AnimationPropertiesOverride();
      skeleton.animationPropertiesOverride.enableBlending = true;
      skeleton.animationPropertiesOverride.blendingSpeed = 0.05;
      skeleton.animationPropertiesOverride.loopMode = 1;

      // Tìm hoạt ảnh đầu tiên của bộ xương
      const animationRanges = skeleton.getAnimationRanges();
      const firstAnimation = animationRanges.length > 0 ? animationRanges[0] : null;

      if (firstAnimation) {
        scene.beginAnimation(skeleton, firstAnimation.from, firstAnimation.to, true);
      } else {
        this.logMessage("No animations found for the model.");
      }
    },

    // Hàm tạo marker
    createMarker(scene) {
      const marker = MeshBuilder.CreateTorus('marker', { diameter: 0.15, thickness: 0.05 });
      marker.isVisible = false;
      marker.rotationQuaternion = new Quaternion();
      return marker;
    },

    // Hàm thiết lập WebXR
    async setupXR(scene) {
      this.xr = await scene.createDefaultXRExperienceAsync({
        uiOptions: {
          sessionMode: "immersive-ar",
          referenceSpaceType: "local-floor"
        },
        optionalFeatures: true
      });

      const fm = this.xr.baseExperience.featuresManager;

      const xrTest = fm.enableFeature(WebXRHitTest.Name, "latest");
      const xrPlanes = fm.enableFeature(WebXRPlaneDetector.Name, "latest");
      const anchors = fm.enableFeature(WebXRAnchorSystem.Name, 'latest');
      const xrBackgroundRemover = fm.enableFeature(WebXRBackgroundRemover.Name);

      this.handleHitTest(xrTest, anchors, scene);
      this.handlePlaneDetection(xrPlanes, scene);
      this.handleAnchors(anchors, scene);
    },

    // Hàm xử lý kết quả HitTest
    handleHitTest(xrTest, anchors, scene) {
      xrTest.onHitTestResultObservable.add((results) => {
        if (results.length) {
          this.marker.isVisible = true;
          this.hitTest = results[0];
          this.hitTest.transformationMatrix.decompose(undefined, this.model.rotationQuaternion, this.model.position);
          this.hitTest.transformationMatrix.decompose(undefined, this.marker.rotationQuaternion, this.marker.position);
        } else {
          this.marker.isVisible = false;
          this.hitTest = undefined;
        }
      });

      scene.onPointerDown = (evt, pickInfo) => {
        if (this.hitTest && anchors && this.xr.baseExperience.state === WebXRState.IN_XR) {
          anchors.addAnchorPointUsingHitTestResultAsync(this.hitTest);
        }
      };
    },

    // Hàm xử lý phát hiện bề mặt phẳng
    handlePlaneDetection(xrPlanes, scene) {
      xrPlanes.onPlaneAddedObservable.add(plane => {
        plane.polygonDefinition.push(plane.polygonDefinition[0]);
        const polygonTriangulation = new PolygonMeshBuilder("name", plane.polygonDefinition.map((p) => new Vector2(p.x, p.z)), scene);
        const polygon = polygonTriangulation.build(false, 0.01);
        plane.mesh = polygon;
        this.planes[plane.id] = plane.mesh;

        const mat = new StandardMaterial("mat", scene);
        mat.alpha = 0.5;
        mat.diffuseColor = Color3.Random();
        polygon.createNormals();
        plane.mesh.material = mat;

        plane.mesh.rotationQuaternion = new Quaternion();
        plane.transformationMatrix.decompose(plane.mesh.scaling, plane.mesh.rotationQuaternion, plane.mesh.position);
      });

      xrPlanes.onPlaneUpdatedObservable.add(plane => {
        let mat;
        if (plane.mesh) {
          mat = plane.mesh.material;
          plane.mesh.dispose(false, false);
        }
        const some = plane.polygonDefinition.some(p => !p);
        if (some) {
          return;
        }
        plane.polygonDefinition.push(plane.polygonDefinition[0]);
        const polygonTriangulation = new PolygonMeshBuilder("name", plane.polygonDefinition.map((p) => new Vector2(p.x, p.z)), scene);
        const polygon = polygonTriangulation.build(false, 0.01);
        polygon.createNormals();
        plane.mesh = polygon;
        this.planes[plane.id] = plane.mesh;
        plane.mesh.material = mat;
        plane.mesh.rotationQuaternion = new Quaternion();
        plane.transformationMatrix.decompose(plane.mesh.scaling, plane.mesh.rotationQuaternion, plane.mesh.position);
        plane.mesh.receiveShadows = true;
      });

      xrPlanes.onPlaneRemovedObservable.add(plane => {
        if (plane && this.planes[plane.id]) {
          this.planes[plane.id].dispose();
        }
      });
    },

    // Hàm xử lý anchors
    handleAnchors(anchors, scene) {
      anchors.onAnchorAddedObservable.add(anchor => {
        this.model.isVisible = true;
        const cloneModel = this.model.clone("mensch");
        cloneModel.skeleton = this.model.skeleton.clone("skelet");
        this.shadowGenerator.addShadowCaster(cloneModel, true);

        const animationRanges = cloneModel.skeleton.getAnimationRanges();
        const firstAnimation = animationRanges.length > 0 ? animationRanges[0] : null;
        if (firstAnimation) {
          scene.beginAnimation(cloneModel.skeleton, firstAnimation.from, firstAnimation.to, true);
        }

        anchor.attachedNode = cloneModel;
        this.model.isVisible = false;
      });

      anchors.onAnchorRemovedObservable.add(anchor => {
        if (anchor) {
          anchor.attachedNode.isVisible = false;
          anchor.attachedNode.dispose();
        }
      });
    },

    // Hàm ghi log message
    logMessage(message) {
      const logDiv = document.getElementById("log");
      logDiv.innerHTML += message + "<br>";
    },
  },
};
</script>

<style scoped>
body {
  margin: 0;
  overflow: hidden;
}
canvas {
  width: 100%;
  height: 100%;
}
</style>
