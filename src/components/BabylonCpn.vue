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
} from "@babylonjs/core";
import "@babylonjs/loaders";
import "@babylonjs/inspector";
import { ShadowOnlyMaterial } from "@babylonjs/materials";
import earcut from "earcut";

window.earcut = earcut; // Ensure earcut is available globally

export default {
  name: "BabylonCpn",
  data() {
    return {
      engine: null,
      scene: null,
      camera: null,
      shadowGenerator: null,
      model: null,
      planes: {},
      placeModeEnabled: false,
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
      canvas.addEventListener("click", (event) => {
        if (this.placeModeEnabled) {
          const pickResult = this.scene.pick(event.clientX, event.clientY);
          if (pickResult.hit) {
            if (pickResult.pickedPoint) {
              this.loadModel(this.scene, pickResult.pickedPoint);
              this.placeModeEnabled = false; // Disable place mode after placing the model
            } else {
              this.logMessage("Pick result does not have a picked point");
            }
          }
        }
      });
    },

    async createScene(canvas) {
      var scene = new Scene(this.engine);

      this.addLight(scene);

      this.camera = this.addCamera(scene, canvas);

      await this.setupXR(scene);

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

    async loadModel(scene, position) {
      await SceneLoader.ImportMesh(
        "",
        "/models/yasuo/",
        "scene.gltf",
        scene,
        (meshes) => {
          meshes.forEach((mesh) => {
            mesh.position = position;
            console.log("Mesh position set to:", position);

            this.shadowGenerator.addShadowCaster(mesh);
          });
          this.model = meshes[0];
          console.log("Model loaded and placed at position:", position);
        },
        null,
        (scene, message) => {
          console.error("Error loading model:", message);
        }
      );
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

        const xrPlanes = fm.enableFeature(WebXRPlaneDetector.Name, "latest");

        xrPlanes.onPlaneAddedObservable.add((plane) => {
          plane.polygonDefinition.push(plane.polygonDefinition[0]);
          var polygon_triangulation = new PolygonMeshBuilder(
            "name",
            plane.polygonDefinition.map((p) => new Vector2(p.x, p.z)),
            scene
          );
          var polygon = polygon_triangulation.build(false, 0.01);
          plane.mesh = polygon;
          this.planes[plane.id] = plane.mesh;
          const mat = new StandardMaterial("mat", scene);
          mat.alpha = 0.5;
          // pick a random color
          mat.diffuseColor = Color3.Random();
          polygon.createNormals();
          plane.mesh.material = mat;

          plane.mesh.rotationQuaternion = new Quaternion();
          plane.transformationMatrix.decompose(
            plane.mesh.scaling,
            plane.mesh.rotationQuaternion,
            plane.mesh.position
          );
        });

        xrPlanes.onPlaneUpdatedObservable.add((plane) => {
          let mat;
          if (plane.mesh) {
            // keep the material, dispose the old polygon
            mat = plane.mesh.material;
            plane.mesh.dispose(false, false);
          }
          const some = plane.polygonDefinition.some((p) => !p);
          if (some) {
            return;
          }
          plane.polygonDefinition.push(plane.polygonDefinition[0]);
          var polygon_triangulation = new PolygonMeshBuilder(
            "name",
            plane.polygonDefinition.map((p) => new Vector2(p.x, p.z)),
            scene
          );
          var polygon = polygon_triangulation.build(false, 0.01);
          polygon.createNormals();
          plane.mesh = polygon;
          this.planes[plane.id] = plane.mesh;
          plane.mesh.material = mat;
          plane.mesh.rotationQuaternion = new Quaternion();
          plane.transformationMatrix.decompose(
            plane.mesh.scaling,
            plane.mesh.rotationQuaternion,
            plane.mesh.position
          );
        });

        xrPlanes.onPlaneRemovedObservable.add((plane) => {
          if (plane.mesh) {
            plane.mesh.dispose();
            delete this.planes[plane.id];
          }
        });

        xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
          Object.values(this.planes).forEach((mesh) => mesh.dispose());
          this.planes = {};
        });
      } catch (e) {
        console.error(e);
        this.logMessage("WebXR Plane Detector not supported: " + e);
      }
    },
    enablePlaceMode() {
      this.placeModeEnabled = true;
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
