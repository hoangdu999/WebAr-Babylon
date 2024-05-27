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
      model: null,
      xr: null,
      planeDetected: false, 
    };
  },
  mounted() {
    this.initializeBabylon();
  },

  methods: {
    async initializeBabylon() {
      try {
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
        this.logMessage('Canvas width: ' + canvas.width + ' Canvas height: ' + canvas.height);
      } catch (error) {
        console.error("Error initializing Babylon.js:", error);
      }
    },

    async createScene(canvas) {
      try {
        var scene = new Scene(this.engine);

        this.addLight(scene);
        this.camera = this.addCamera(scene);
        this.addVideoLayer(scene, canvas);
        await this.setupXR(scene);

        const ground = MeshBuilder.CreatePlane('ground', { size: 2000 }, scene);
        ground.rotation.x = Math.PI / 2;
        ground.material = new ShadowOnlyMaterial('shadowOnly', scene);
        ground.receiveShadows = true;
        ground.position.y = 0;

        return scene;
      } catch (error) {
        console.error("Error creating scene:", error);
      }
    },

    addLight(scene) {
      try {
        scene.lights.forEach(light => light.dispose());

        var light = new DirectionalLight("dirLight", new Vector3(-2, -3, 1), scene);
        light.position = new Vector3(6, 9, 3);

        this.shadowGenerator = new ShadowGenerator(1024, light);
        this.shadowGenerator.useBlurExponentialShadowMap = true;
        this.shadowGenerator.blurKernel = 32;
      } catch (error) {
        console.error("Error adding light:", error);
      }
    },

    addCamera(scene) {
      try {
        const alpha = 7.349039862224447;
        const beta = 1.2023107691067825;
        const radius = 10;

        const camera = new ArcRotateCamera('mainCam', alpha, beta, radius, new Vector3(0, 1, 0), scene, true);
        camera.attachControl(scene.getEngine().getRenderingCanvas(), true);

        camera.onViewMatrixChangedObservable.add(() => {
          console.log(`Alpha: ${camera.alpha}, Beta: ${camera.beta}, Radius: ${camera.radius}`);
        });

        return camera;
      } catch (error) {
        console.error("Error adding camera:", error);
      }
    },

    addVideoLayer(scene, canvas) {
      try {
        var layer = new Layer("background", null, scene, true);

        navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            facingMode: { exact: "environment" }
          }
        })
        .then((stream) => {
          VideoTexture.CreateFromWebCam(scene, function (videoTexture) {
            videoTexture.uScale = 1.0;
            videoTexture.vScale = -1.0;
            layer.texture = videoTexture;
          }, { maxWidth: 1920, maxHeight: 1080, facingMode: "environment" });
        })
        .catch((err) => {
          console.error("Error accessing camera and microphone: ", err);
        });
      } catch (error) {
        console.error("Error adding video layer:", error);
      }
    },

    logMessage(message) {
      const logDiv = document.getElementById('log');
      logDiv.innerHTML += message + '<br>';
    },

    async loadModel(scene, position) {
      try {
        await SceneLoader.ImportMesh("", "/models/yasuo/", "scene.gltf", scene, (meshes) => {
          meshes.forEach((mesh) => {
            mesh.position = position;
            this.shadowGenerator.addShadowCaster(mesh);
          });
          this.model = meshes[0];
        }, null, (scene, message) => {
          console.error(message);
        });
      } catch (error) {
        console.error("Error loading model:", error);
      }
    },

    async setupXR(scene) {
      try {
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
      } catch (error) {
        console.error("Error setting up XR:", error);
      }
    }
  }
}
</script>

<style>
body {
  margin: 0;
  overflow: hidden;
}
canvas {
  width: 100%;
  height: 100%;
}
</style>
