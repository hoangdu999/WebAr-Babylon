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
  WebXRHitTest,
  WebXRPlaneDetector,
  WebXRAnchorSystem,
  Quaternion,
  PolygonMeshBuilder,
  StandardMaterial,
  Color3,
  WebXRState,
  AnimationPropertiesOverride,
  WebXRBackgroundRemover,
  Vector2
} from "@babylonjs/core";
import { AdvancedDynamicTexture, Button, Control } from "@babylonjs/gui";
import "@babylonjs/loaders";
import earcut from "earcut";

window.earcut = earcut; // Đảm bảo earcut có sẵn toàn cầu

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
      anchors: null,
      planes: [], // Khởi tạo mảng planes
      idleRange: null, // Khởi tạo idleRange
    };
  },
  mounted() {
    this.initializeBabylon();
  },

  methods: {
    async initializeBabylon() {
      var canvas = document.getElementById("renderCanvas");

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
      this.logMessage(
        "Canvas width: " + canvas.width + " Canvas height: " + canvas.height
      );
    },

    async createScene(canvas) {
      var scene = new Scene(this.engine);

      this.addLight(scene);

      this.camera = this.addCamera(scene, canvas);

      await this.loadModel(scene);
      await this.setupXR(scene);
      this.createGUIButton();
      return scene;
    },

    addLight(scene) {
      scene.lights.forEach((light) => light.dispose());

      var light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
      light.intensity = 0.7;

      var dirLight = new DirectionalLight('light', new Vector3(0, -1, -0.5), scene);
      dirLight.position = new Vector3(0, 5, -5);

      this.shadowGenerator = new ShadowGenerator(1024, dirLight);
      this.shadowGenerator.useBlurExponentialShadowMap = true;
      this.shadowGenerator.blurKernel = 32;
    },

    addCamera(scene, canvas) {
      const camera = new FreeCamera("camera1", new Vector3(0, 1, -5), scene);
      camera.setTarget(Vector3.Zero());
      camera.attachControl(canvas, true);
      return camera;
    },

    logMessage(message) {
      const logDiv = document.getElementById("log");
      logDiv.innerHTML += message + "<br>";
    },

    async loadModel(scene) {
      const modelUrl = "models/robot.glb";
      const result = await SceneLoader.ImportMeshAsync("", "", modelUrl, scene);
      this.model = result.meshes[0];
      this.model.rotationQuaternion = new Quaternion();
      this.model.isVisible = false;
      this.shadowGenerator.addShadowCaster(this.model, true);

      var skeleton = result.skeletons[0];
      skeleton.animationPropertiesOverride = new AnimationPropertiesOverride();
      skeleton.animationPropertiesOverride.enableBlending = true;
      skeleton.animationPropertiesOverride.blendingSpeed = 0.05;
      skeleton.animationPropertiesOverride.loopMode = 1;

      if (skeleton.getAnimationRanges().length > 0) {
        this.idleRange = skeleton.getAnimationRanges()[0];
      } else {
        this.logMessage("No animation ranges found.");
      }

      // Gán mô hình robot làm marker
      this.marker = this.model;
      this.marker.isVisible = true;
    },

    async setupXR(scene) {
      try {
        const xr = await scene.createDefaultXRExperienceAsync({
          uiOptions: {
            sessionMode: "immersive-ar",
            referenceSpaceType: "local-floor",
          },
          optionalFeatures: true,
        });

        const fm = xr.baseExperience.featuresManager;

        this.hitTest = fm.enableFeature(WebXRHitTest.Name, "latest");
        const xrPlanes = fm.enableFeature(WebXRPlaneDetector.Name, "latest");
        this.anchors = fm.enableFeature(WebXRAnchorSystem.Name, 'latest');
        const xrBackgroundRemover = fm.enableFeature(WebXRBackgroundRemover.Name);

        this.setupHitTestObserver();
        this.setupAnchors(scene);
        this.setupPlaneDetection(xrPlanes, scene);

        xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
          this.clearPlanes();
        });

        scene.onPointerDown = (evt, pickInfo) => {
          if (this.hitTest && this.anchors && xr.baseExperience.state === WebXRState.IN_XR) {
            this.anchors.addAnchorPointUsingHitTestResultAsync(this.hitTest);
          }
        };
      } catch (e) {
        console.error(e);
        this.logMessage("WebXR Plane Detector not supported: " + e);
      }
    },

    setupHitTestObserver() {
      this.hitTest.onHitTestResultObservable.add((results) => {
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
    },

    setupAnchors(scene) {
      if (this.anchors) {
        this.anchors.onAnchorAddedObservable.add(anchor => {
          anchor.attachedNode = this.model.clone("modelClone");
          anchor.attachedNode.skeleton = this.model.skeleton.clone('skeletonClone');
          this.shadowGenerator.addShadowCaster(anchor.attachedNode, true);
          if (this.idleRange) {
            scene.beginAnimation(anchor.attachedNode.skeleton, this.idleRange.from, this.idleRange.to, true);
          }
          this.marker.isVisible = false;
        });

        this.anchors.onAnchorRemovedObservable.add(anchor => {
          if (anchor) {
            anchor.attachedNode.isVisible = false;
            anchor.attachedNode.dispose();
          }
        });
      }
    },

    setupPlaneDetection(xrPlanes, scene) {
      xrPlanes.onPlaneAddedObservable.add(plane => {
        plane.polygonDefinition.push(plane.polygonDefinition[0]);
        var polygon_triangulation = new PolygonMeshBuilder("name", plane.polygonDefinition.map((p) => new Vector2(p.x, p.z)), scene);
        var polygon = polygon_triangulation.build(false, 0.01);
        plane.mesh = polygon;
        this.planes[plane.id] = (plane.mesh);
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
        plane.polygonDefinition.push(plane.polygonDefinition[0]);
        var polygon_triangulation = new PolygonMeshBuilder("name", plane.polygonDefinition.map((p) => new Vector2(p.x, p.z)), scene);
        var polygon = polygon_triangulation.build(false, 0.01);
        polygon.createNormals();
        plane.mesh = polygon;
        this.planes[plane.id] = (plane.mesh);
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

    clearPlanes() {
      this.planes.forEach(plane => plane.dispose());
      this.planes = [];
    },

    createGUIButton() {
      let guiCanvas = AdvancedDynamicTexture.CreateFullscreenUI("UI");
      let guiButton = Button.CreateSimpleButton("guiButton", "Place");
      guiButton.width = "300px";
      guiButton.height = "100px";
      guiButton.color = "white";
      guiButton.fontSize = "24px";
      guiButton.cornerRadius = 5;
      guiButton.background = "black";
      guiButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
      guiButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      guiButton.top = "-100px";
      guiCanvas.addControl(guiButton);

      guiButton.onPointerUpObservable.add(() => {
        if (this.hitTest) {
          let matrix = this.hitTest.transformationMatrix;
          matrix.decompose(this.model.scaling, this.model.rotationQuaternion, this.model.position);
          this.model.setEnabled(true);
          this.model.material.alpha = 1;
          this.marker.isVisible = false;

          // Bắt đầu hoạt ảnh đầu tiên
          if (this.idleRange) {
            this.scene.beginAnimation(this.model.skeleton, this.idleRange.from, this.idleRange.to, true);
          }
        }
      });
    }
  }
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
