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
  DirectionalLight,
  ShadowGenerator,
  SceneLoader,
  MeshBuilder,
  Quaternion,
  AnimationPropertiesOverride,
} from "@babylonjs/core";
import "@babylonjs/loaders";
import { ShadowOnlyMaterial } from "@babylonjs/materials";
import { AdvancedDynamicTexture, Button, Control, InputText } from "@babylonjs/gui";
import { WebXRHitTest, WebXRPlaneDetector, WebXRAnchorSystem, WebXRBackgroundRemover, WebXRState } from "@babylonjs/core/XR";
import earcut from "earcut";

// Make earcut available globally
window.earcut = earcut;
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
      xr: null,
      anchors: null,
      currentModel: null,
      audioContext: null,
      microphoneStream: null,
      microphoneSource: null,
    };
  },
  mounted() {
    this.initializeBabylon();
  },
  methods: {
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
    async createScene(canvas) {
      const scene = new Scene(this.engine);

      this.createCamera(scene, canvas);
      this.createLights(scene);
      this.model = await this.loadModel(scene);
      this.Ground(scene);
      this.marker = this.createMarker(scene);
      await this.setupXR(scene);
//k//
      return scene;
    },
    createCamera(scene, canvas) {
      this.camera = new FreeCamera("camera1", new Vector3(0, 1, -5), scene);
      this.camera.setTarget(Vector3.Zero());
      this.camera.attachControl(canvas, true);
    },
    createLights(scene) {
      scene.lights.forEach((light) => light.dispose());

      var light = new DirectionalLight("dirLight", new Vector3(-2, -3, 1), scene);
      light.position = new Vector3(6, 9, 3);

      this.shadowGenerator = new ShadowGenerator(1024, light);
      this.shadowGenerator.useBlurExponentialShadowMap = true;
      this.shadowGenerator.blurKernel = 32;
      this.shadowGenerator.darkness = 0.5;
    },
    async loadModel(scene) {
      const result = await SceneLoader.ImportMeshAsync("", "models/", "dummy3.babylon", scene);
      const model = result.meshes[0];
      model.rotationQuaternion = new Quaternion();

      this.shadowGenerator.addShadowCaster(model);
      model.receiveShadows = true;

      model.isVisible = false;
      model.scaling = new Vector3(0.5, 0.5, 0.5);
      const skeleton = result.skeletons[0];
      this.setupAnimations(scene, skeleton);

      return model;
    },
    Ground(scene) {
      const ground = MeshBuilder.CreateGround("ground", { width: 4, height: 4 }, scene);
      ground.receiveShadows = true;

      const groundMaterial = new ShadowOnlyMaterial("groundMaterial", scene);
      ground.material = groundMaterial;
    },
    setupAnimations(scene, skeleton) {
      skeleton.animationPropertiesOverride = new AnimationPropertiesOverride();
      skeleton.animationPropertiesOverride.enableBlending = true;
      skeleton.animationPropertiesOverride.blendingSpeed = 0.05;
      skeleton.animationPropertiesOverride.loopMode = 1;

      const idleRange = skeleton.getAnimationRange("YBot_Idle");
      scene.beginAnimation(skeleton, idleRange.from, idleRange.to, true);
    },
    createMarker(scene) {
      const marker = MeshBuilder.CreateTorus("marker", { diameter: 0.15, thickness: 0.05 }, scene);
      marker.isVisible = false;
      marker.rotationQuaternion = new Quaternion();
      return marker;
    },
    async setupXR(scene) {
      this.xr = await scene.createDefaultXRExperienceAsync({
        uiOptions: {
          sessionMode: "immersive-ar",
          referenceSpaceType: "local-floor",
        },
        optionalFeatures: true,
      });

      const fm = this.xr.baseExperience.featuresManager;
      const xrTest = fm.enableFeature(WebXRHitTest.Name, "latest");
      const xrPlanes = fm.enableFeature(WebXRPlaneDetector.Name, "latest");
      this.anchors = fm.enableFeature(WebXRAnchorSystem.Name, "latest");
      const xrBackgroundRemover = fm.enableFeature(WebXRBackgroundRemover.Name);

      xrTest.onHitTestResultObservable.add((results) => {
        if (results.length) {
          this.marker.isVisible = true;
          this.hitTest = results[0];
          this.hitTest.transformationMatrix.decompose(
            undefined,
            this.model.rotationQuaternion,
            this.model.position
          );
          this.hitTest.transformationMatrix.decompose(
            undefined,
            this.marker.rotationQuaternion,
            this.marker.position
          );
        } else {
          this.marker.isVisible = false;
          this.hitTest = undefined;
        }
      });

      this.handleAnchors(this.anchors, scene);
      this.createGUIButton();
      this.createGUIButtonMicro();
      this.createGUITextbox();
      const planes = [];

      xrPlanes.onPlaneAddedObservable.add((plane) => {
        // Handle plane detection and rendering
      });

      xrPlanes.onPlaneUpdatedObservable.add((plane) => {
        // Update detected planes
      });

      xrPlanes.onPlaneRemovedObservable.add((plane) => {
        if (plane && planes[plane.id]) {
          planes[plane.id].dispose();
        }
      });

      this.xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
        planes.forEach((plane) => plane.dispose());
        while (planes.pop()) {
          // Removed a plane
        }
      });
    },
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
      guiButton.left = "-160px";
      guiButton.top = "-100px";

      guiButton.onPointerUpObservable.add(() => {
        this.placeModel();
      });

      guiCanvas.addControl(guiButton);
    },
    createGUIButtonMicro() {
      const guiCanvas = AdvancedDynamicTexture.CreateFullscreenUI("UI");

      const guiButton = Button.CreateSimpleButton("microButton", "Hold to Listen");
      guiButton.width = "300px";
      guiButton.height = "100px";
      guiButton.color = "white";
      guiButton.fontSize = "24px";
      guiButton.cornerRadius = 5;
      guiButton.background = "black";
      guiButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
      guiButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      guiButton.left = "160px"; // Đặt nút ở bên phải nút "Place"
      guiButton.top = "-100px";

      guiButton.onPointerDownObservable.add(() => {
        this.startMicrophone();
      });

      guiButton.onPointerUpObservable.add(() => {
        this.stopMicrophone();
      });

      guiCanvas.addControl(guiButton);
    },
    createGUITextbox() {
      const guiCanvas = AdvancedDynamicTexture.CreateFullscreenUI("UI");

      const textbox = new InputText();
      textbox.width = "300px";
      textbox.height = "100px";
      textbox.color = "white";
      textbox.fontSize = 24;
      textbox.background = "black";
      textbox.text = "";
      textbox.placeholderText = "Enter text here...";
      textbox.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      textbox.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
      textbox.left = "160px"; // Đặt textbox trên cùng vị trí ngang của nút micro
      textbox.top = "-210px"; // Đặt textbox trên nút micro 10px

      guiCanvas.addControl(textbox);
    },
    async startMicrophone() {
      try {
        this.microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.microphoneSource = this.audioContext.createMediaStreamSource(this.microphoneStream);
        this.microphoneSource.connect(this.audioContext.destination);
        console.log('Microphone started');
      } catch (error) {
        console.error('Error accessing the microphone:', error);
      }
    },
    stopMicrophone() {
      if (this.microphoneStream) {
        this.microphoneStream.getTracks().forEach(track => track.stop());
        this.microphoneStream = null;
        if (this.microphoneSource) {
          this.microphoneSource.disconnect();
          this.microphoneSource = null;
        }
        if (this.audioContext) {
          this.audioContext.close();
          this.audioContext = null;
        }
        console.log('Microphone stopped');
      }
    },
    handleAnchors(anchors, scene) {
      if (anchors) {
        anchors.onAnchorAddedObservable.add((anchor) => {
          if (this.currentModel) {
            this.currentModel.dispose();
          }
          const cloneModel = this.model.clone("mensch");
          cloneModel.isVisible = true;
          cloneModel.scaling = new Vector3(0.5, 0.5, 0.5);
          anchor.attachedNode = cloneModel;
          anchor.attachedNode.skeleton = this.model.skeleton.clone("skelet");
          this.shadowGenerator.addShadowCaster(anchor.attachedNode, true);
          scene.beginAnimation(
            anchor.attachedNode.skeleton,
            this.model.skeleton.getAnimationRange("YBot_Idle").from,
            this.model.skeleton.getAnimationRange("YBot_Idle").to,
            true
          );
          this.model.isVisible = false;

          this.currentModel = anchor.attachedNode;
        });

        anchors.onAnchorRemovedObservable.add((anchor) => {
          if (anchor) {
            anchor.attachedNode.isVisible = false;
            anchor.attachedNode.dispose();
          }
        });
      }
    },
    placeModel() {
      if (this.hitTest && this.xr.baseExperience.state === WebXRState.IN_XR) {
        this.anchors.addAnchorPointUsingHitTestResultAsync(this.hitTest);
      }
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
