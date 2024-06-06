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
  ExecuteCodeAction
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
      planes: {},
      selectedPosition: null,
      animationGroup: null,
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

      const ground = MeshBuilder.CreatePlane('ground', { size: 2000 }, scene);
      ground.rotation.x = Math.PI / 2;
      ground.material = new ShadowOnlyMaterial('shadowOnly', scene);
      ground.receiveShadows = true;
      ground.position.y = 0;

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
      await SceneLoader.ImportMesh(
        "",
        "/models/yasuo/",
        "scene.gltf",
        scene,
        (meshes, particleSystems, skeletons, animationGroups) => {
          meshes.forEach((mesh) => {
             mesh.position.y = 0;
             mesh.position.z = 0;
            this.shadowGenerator.addShadowCaster(mesh);
          });
          this.model = meshes[0];
          this.animationGroup = animationGroups[0]; // Lưu nhóm animation đầu tiên
          if (this.animationGroup) {
            this.animationGroup.stop(); // Dừng animation khi bắt đầu
          }
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

          // Lưu vị trí của mặt phẳng đã phát hiện
          plane.mesh.actionManager = new ActionManager(scene);
          plane.mesh.actionManager.registerAction(new ExecuteCodeAction(
            ActionManager.OnPickTrigger,
            (evt) => {
              this.selectedPosition = plane.mesh.position.clone();
              this.logMessage("Selected position: " + this.selectedPosition);
            }
          ));
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
          // Lưu vị trí của mặt phẳng đã phát hiện
          plane.mesh.actionManager = new ActionManager(scene);
          plane.mesh.actionManager.registerAction(new ExecuteCodeAction(
            ActionManager.OnPickTrigger,
            (evt) => {
              this.selectedPosition = plane.mesh.position.clone();
              this.logMessage("Selected position: " + this.selectedPosition);
            }
          ));
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
    createGUIButton() {
      let guiCanvas = AdvancedDynamicTexture.CreateFullscreenUI("UI");
      let guiButton = Button.CreateSimpleButton("guiButton", "Place");
      guiButton.width = "300px";
      guiButton.height = "100px";
      guiButton.color = "white";
      guiButton.fontSize = "24px"; // Thay đổi kích thước chữ ở đây
      guiButton.cornerRadius = 5;
      guiButton.background = "black";
      guiButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM; // Đặt nút ở dưới cùng
      guiButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER; // Căn giữa theo chiều ngang
      guiButton.top = "-100px"; // Sử dụng top với giá trị âm để  điều chỉnh khoảng cách từ dưới cùng
      guiCanvas.addControl(guiButton);

      guiButton.onPointerUpObservable.add(() => {
        if (this.selectedPosition && this.model) {
          this.logMessage("Placing model at: " + this.selectedPosition);
          this.model.position = this.selectedPosition.clone();
          this.logMessage("Model placed at: " + this.model.position);

          // Bắt đầu phát animation
          if (this.animationGroup) {
            this.animationGroup.start(true);
            this.logMessage("Animation started.");
            setTimeout(() => {
              this.animationGroup.stop();
              this.logMessage("Animation stopped after 2 seconds.");
            }, 2000);
          } else {
            this.logMessage("No animation group found.");
          }
        } else {
          this.logMessage("No position selected or model not loaded.");
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
