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
  ArcRotateCamera,
  Vector3,
  Layer,
  SceneLoader,
  VideoTexture,
  ShadowGenerator,
  DirectionalLight,
  MeshBuilder,
  WebXRPlaneDetector,
  Matrix,
  Vector2,
  PolygonMeshBuilder,
  StandardMaterial,
  Color3,
  Quaternion,
  ActionManager,
  ExecuteCodeAction,
  WebXRHitTest,
  WebXRBackgroundRemover
} from "@babylonjs/core";
import "@babylonjs/loaders";
import "@babylonjs/inspector";
import { ShadowOnlyMaterial } from "@babylonjs/materials";
import earcut from "earcut";
import { AdvancedDynamicTexture, Button, Control } from "@babylonjs/gui";

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

      var light = new DirectionalLight(
        "dirLight",
        new Vector3(-2, -3, 1),
        scene
      );
      light.position = new Vector3(6, 9, 3);

      this.shadowGenerator = new ShadowGenerator(1024, light);
      this.shadowGenerator.useBlurExponentialShadowMap = true;
      this.shadowGenerator.blurKernel = 32;
    },

    addCamera(scene, canvas) {
      const camera = new ArcRotateCamera(
        "Camera",
        -Math.PI / 2,
        Math.PI / 2,
        12,
        Vector3.Zero(),
        scene
      );
      camera.attachControl(canvas, true);
      return camera;
    },

    logMessage(message) {
      const logDiv = document.getElementById("log");
      logDiv.innerHTML += message + "<br>";
    },

    async loadModel(scene) {
      const model = new MeshBuilder.CreateBox("box", {width: 0.2, height: 0.2, depth: 0.2}, scene);
      model.rotationQuaternion = new Quaternion();
      model.position.y += 0.1;
      model.bakeCurrentTransformIntoVertices();
      this.model = model;

      // Add the box to the shadow generator
      this.shadowGenerator.addShadowCaster(model);

      // Ensure the box receives shadows
      model.receiveShadows = true;
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
        const xrTest = fm.enableFeature(WebXRHitTest, "latest");
        const xrBackgroundRemover = fm.enableFeature(WebXRBackgroundRemover.Name);

        xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
          this.model.setEnabled(false);
        });

        xrTest.onHitTestResultObservable.add((results) => {
          if (results.length) {
            this.hitTest = results[0];
            if (!this.marker) {
              this.marker = MeshBuilder.CreateTorus('marker', { diameter: 0.15, thickness: 0.05 }, scene);
              this.marker.isVisible = true;
              this.marker.rotationQuaternion = new Quaternion();
            } else {
              this.marker.isVisible = true;
            }
            this.hitTest.transformationMatrix.decompose(this.marker.scaling, this.marker.rotationQuaternion, this.marker.position);
          } else {
            this.hitTest = undefined;
            if (this.marker) {
              this.marker.isVisible = false;
            }
          }
        });
      } catch (e) {
        console.error(e);
        this.logMessage("WebXR Plane Detector not supported: " + e);
      }
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
        }
      });
  
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
