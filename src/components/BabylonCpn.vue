<template>
  <div>
    <!-- The canvas element where the Babylon.js scene will be rendered -->
    <canvas
      id="renderCanvas"
      touch-action="none"
      style="width: 100%; height: 100%"
    ></canvas>
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
  AnimationPropertiesOverride
} from "@babylonjs/core";
import "@babylonjs/loaders";
import "@babylonjs/inspector";
import earcut from "earcut";
import { AdvancedDynamicTexture, Button, Control } from "@babylonjs/gui";
// Make earcut available globally
window.earcut = earcut;

export default {
  name: "BabylonCpn",
  data() {
    return {
      engine: null, // Babylon.js engine
      scene: null, // Babylon.js scene
      camera: null, // Camera for the scene
      shadowGenerator: null, // Shadow generator
      model: null, // Loaded 3D model
      hitTest: null, // Hit test result for AR
      marker: null, // Marker for indicating placement in AR
    };
  },
  mounted() {
    this.initializeBabylon(); // Initialize Babylon.js when the component is mounted
  },
  methods: {
    // Initialize Babylon.js and start the render loop
    async initializeBabylon() {
      const canvas = this.$el.querySelector("#renderCanvas");
      this.engine = new Engine(canvas, true);

      this.scene = await this.createScene(canvas);
      this.engine.runRenderLoop(() => {
        if (this.scene) {
          this.scene.render();
        }
      });

      window.addEventListener("resize", () => {
        this.engine.resize();
      });
    },

    // Create and configure the scene
    async createScene(canvas) {
      const scene = new Scene(this.engine);

      this.createCamera(scene, canvas); // Create and configure the camera
      this.createLights(scene); // Create and configure lights
      this.createShadowGenerator(scene); // Create and configure shadow generator

      this.model = await this.loadModel(scene); // Load the 3D model
      this.marker = this.createMarker(scene); // Create the marker for AR
      await this.setupXR(scene); // Set up WebXR

      return scene;
    },

    // Create and configure the camera
    createCamera(scene, canvas) {
      this.camera = new FreeCamera("camera1", new Vector3(0, 1, -5), scene);
      this.camera.setTarget(Vector3.Zero());
      this.camera.attachControl(canvas, true);
    },

    // Create and configure lights
    createLights(scene) {
      const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
      light.intensity = 0.7;

      const dirLight = new DirectionalLight("dirLight", new Vector3(0, -1, -0.5), scene);
      dirLight.position = new Vector3(0, 5, -5);
    },

    // Create and configure the shadow generator
    createShadowGenerator(scene) {
      const dirLight = scene.lights.find(light => light.name === "dirLight");
      this.shadowGenerator = new ShadowGenerator(1024, dirLight);
      this.shadowGenerator.useBlurExponentialShadowMap = true;
      this.shadowGenerator.blurKernel = 32;
    },

    // Load the 3D model and configure its properties
    async loadModel(scene) {
      const result = await SceneLoader.ImportMeshAsync("", "models/", "dummy3.babylon", scene);
      const model = result.meshes[0];
      model.rotationQuaternion = new Quaternion();
      this.shadowGenerator.addShadowCaster(model, true);
      model.isVisible = false;

      const skeleton = result.skeletons[0];
      this.setupAnimations(scene, skeleton); // Set up animations for the model

      return model;
    },

    // Set up animations for the 3D model
    setupAnimations(scene, skeleton) {
      skeleton.animationPropertiesOverride = new AnimationPropertiesOverride();
      skeleton.animationPropertiesOverride.enableBlending = true;
      skeleton.animationPropertiesOverride.blendingSpeed = 0.05;
      skeleton.animationPropertiesOverride.loopMode = 1;

      const idleRange = skeleton.getAnimationRange("YBot_Idle");
      scene.beginAnimation(skeleton, idleRange.from, idleRange.to, true);
    },

    // Create the marker for AR
    createMarker(scene) {
      const marker = MeshBuilder.CreateTorus("marker", { diameter: 0.15, thickness: 0.05 }, scene);
      marker.isVisible = false;
      marker.rotationQuaternion = new Quaternion();
      return marker;
    },

    // Set up WebXR
    async setupXR(scene) {
      const xr = await scene.createDefaultXRExperienceAsync({
        uiOptions: {
          sessionMode: "immersive-ar",
          referenceSpaceType: "local-floor",
        },
        optionalFeatures: true,
      });

      const fm = xr.baseExperience.featuresManager;

      // Enable WebXR features
      const xrTest = fm.enableFeature(WebXRHitTest.Name, "latest");
      const xrPlanes = fm.enableFeature(WebXRPlaneDetector.Name, "latest");
      const anchors = fm.enableFeature(WebXRAnchorSystem.Name, "latest");
      const xrBackgroundRemover = fm.enableFeature(WebXRBackgroundRemover.Name);

      // Handle hit test results
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

      this.handleAnchors(anchors, scene); // Handle anchor creation and management

      // Create and configure the GUI button
      this.createGUIButton();

      const planes = [];

      xrPlanes.onPlaneAddedObservable.add((plane) => {
        // Handle plane detection and rendering
      });

      xrPlanes.onPlaneUpdatedObservable.add((plane) => {
        // Update detected planes
      });

      // Remove detected planes
      xrPlanes.onPlaneRemovedObservable.add((plane) => {
        if (plane && planes[plane.id]) {
          planes[plane.id].dispose();
        }
      });

      // Clean up detected planes when the XR session is initialized
      xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
        planes.forEach((plane) => plane.dispose());
        // Use a comment to avoid the empty block error
        while (planes.pop()) {
          // Removed a plane
        }
      });
    },

    // Create and configure the GUI button
    createGUIButton() {
      const guiCanvas = AdvancedDynamicTexture.CreateFullscreenUI("UI");
      const guiButton = Button.CreateSimpleButton("guiButton", "Place");
      guiButton.width = "300px";
      guiButton.height = "100px";
      guiButton.color = "white";
      guiButton.fontSize = "24px";
      guiButton.cornerRadius = 5;
      guiButton.background = "black";
      guiButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
      guiButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      guiButton.top = "-100px";

      guiButton.onPointerUpObservable.add(() => {
        this.placeModel();
      });

      guiCanvas.addControl(guiButton);
    },

    // Handle anchor creation and management
    handleAnchors(anchors, scene) {
      if (anchors) {
        anchors.onAnchorAddedObservable.add((anchor) => {
          const cloneModel = this.model.clone("mensch");
          cloneModel.isVisible = true;
          anchor.attachedNode = cloneModel;
          anchor.attachedNode.skeleton = this.model.skeleton.clone("skelet");
          this.shadowGenerator.addShadowCaster(anchor.attachedNode, true);
          scene.beginAnimation(anchor.attachedNode.skeleton, this.model.skeleton.getAnimationRange("YBot_Idle").from, this.model.skeleton.getAnimationRange("YBot_Idle").to, true);
          this.model.isVisible = false;
        });

        anchors.onAnchorRemovedObservable.add((anchor) => {
          if (anchor) {
            anchor.attachedNode.isVisible = false;
            anchor.attachedNode.dispose();
          }
        });
      }
    },

    // Place the model at the hit test result
    placeModel() {
      if (this.hitTest && this.xr.baseExperience.state === WebXRState.IN_XR) {
        this.anchors.addAnchorPointUsingHitTestResultAsync(this.hitTest);
      }
    },
  },
};
</script>

<style scoped>
/* Ensure the canvas takes up the full viewport */
body {
  margin: 0;
  overflow: hidden;
}
canvas {
  width: 100%;
  height: 100%;
}
</style>
