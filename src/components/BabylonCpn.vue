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
  Color3,
  Quaternion,
  AnimationPropertiesOverride,
  StandardMaterial,
  WebXRState,
  WebXRHitTest,
  WebXRAnchorSystem,
  WebXRBackgroundRemover
} from "@babylonjs/core";
import "@babylonjs/loaders";
import "@babylonjs/inspector";
import { ShadowOnlyMaterial } from "@babylonjs/materials";

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
      planes: [],
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

      // Thiết lập kích thước canvas
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      this.logMessage(
        "Canvas width: " + canvas.width + " Canvas height: " + canvas.height
      );
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
      const ground = MeshBuilder.CreatePlane("ground", { size: 2000 }, scene);
      ground.rotation.x = Math.PI / 2;
      ground.material = new ShadowOnlyMaterial("shadowOnly", scene);
      ground.receiveShadows = true;
      ground.position.y = 0;

      return scene;
    },

    addLight(scene) {
      // Xóa ánh sáng mặc định nếu có
      scene.lights.forEach((light) => light.dispose());

      // Tạo ánh sáng mới
      var light = new DirectionalLight(
        "dirLight",
        new Vector3(-2, -3, 1),
        scene
      );
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

      const camera = new ArcRotateCamera(
        "mainCam",
        alpha,
        beta,
        radius,
        new Vector3(0, 1, 0),
        scene,
        true
      );
      camera.attachControl(scene.getEngine().getRenderingCanvas(), true);

      // Thêm sự kiện để in giá trị alpha, beta, radius khi camera thay đổi
      camera.onViewMatrixChangedObservable.add(() => {
        console.log(
          `Alpha: ${camera.alpha}, Beta: ${camera.beta}, Radius: ${camera.radius}`
        );
      });

      return camera;
    },

    addVideoLayer(scene, canvas) {
      var layer = new Layer("background", null, scene, true);

      // Yêu cầu quyền truy cập camera và micro
      navigator.mediaDevices
        .getUserMedia({
          audio: true,
          video: {
            facingMode: { exact: "environment" }, // Yêu cầu camera phía sau (rear camera)
          },
        })
        .then((stream) => {
          // Tạo VideoTexture từ webcam với kích thước dựa trên kích thước của cửa sổ trình duyệt
          VideoTexture.CreateFromWebCam(
            scene,
            function (videoTexture) {
              videoTexture.uScale = 1.0;
              videoTexture.vScale = -1.0;
              layer.texture = videoTexture;
            },
            { maxWidth: 1920, maxHeight: 1080, facingMode: "environment" }
          );
        })
        .catch((err) => {
          console.error("Error accessing camera and microphone: ", err);
        });
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
          // Đặt vị trí của mô hình nếu cần
          meshes.forEach((mesh) => {
            mesh.position = position;

            // Thêm các mesh vào Shadow Generator
            this.shadowGenerator.addShadowCaster(mesh);
          });
          this.model = meshes[0]; // Giả định mô hình chính là mesh đầu tiên
          console.log("Model loaded and placed at position:", position);
        },
        null,
        (scene, message) => {
          console.error(message);
        }
      );
    },

    async setupXR(scene) {
      var dirLight = new DirectionalLight('light', new Vector3(0, -1, -0.5), scene);
       dirLight.position = new Vector3(0, 5, -5);
      var shadowGenerator = new ShadowGenerator(1024, dirLight);
      shadowGenerator.useBlurExponentialShadowMap = true;
      shadowGenerator.blurKernel = 32;
      var xr = await scene.createDefaultXRExperienceAsync({
        uiOptions: {
          sessionMode: "immersive-ar",
          referenceSpaceType: "local-floor",
        },
        optionalFeatures: true,
      });

      const fm = xr.baseExperience.featuresManager;

      const xrTest = fm.enableFeature(WebXRHitTest.Name, "latest");
      const xrPlanes = fm.enableFeature(WebXRPlaneDetector.Name, "latest");
      const anchors = fm.enableFeature(WebXRAnchorSystem.Name, "latest");

      const xrBackgroundRemover = fm.enableFeature(WebXRBackgroundRemover.Name);
      const model = await SceneLoader.ImportMeshAsync( "",
        "/models/yasuo/",
        "scene.gltf", scene);
      let b = model.meshes[0]; //BABYLON.CylinderBuilder.CreateCylinder('cylinder', { diameterBottom: 0.2, diameterTop: 0.4, height: 0.5 });
      b.rotationQuaternion = new Quaternion();
      // b.isVisible = false;
      shadowGenerator.addShadowCaster(b, true);

      const marker = MeshBuilder.CreateTorus("marker", {
        diameter: 0.15,
        thickness: 0.05,
      });
      marker.isVisible = false;
      marker.rotationQuaternion = new Quaternion();

      var skeleton = model.skeletons[0];

      // ROBOT
      skeleton.animationPropertiesOverride =
        new AnimationPropertiesOverride();
      skeleton.animationPropertiesOverride.enableBlending = true;
      skeleton.animationPropertiesOverride.blendingSpeed = 0.05;
      skeleton.animationPropertiesOverride.loopMode = 1;

      var idleRange = skeleton.getAnimationRange("YBot_Idle");
      var walkRange = skeleton.getAnimationRange("YBot_Walk");
      var runRange = skeleton.getAnimationRange("YBot_Run");
      var leftRange = skeleton.getAnimationRange("YBot_LeftStrafeWalk");
      var rightRange = skeleton.getAnimationRange("YBot_RightStrafeWalk");
      scene.beginAnimation(skeleton, idleRange.from, idleRange.to, true);

      let hitTest;

      b.isVisible = false;

      xrTest.onHitTestResultObservable.add((results) => {
        if (results.length) {
          marker.isVisible = true;
          hitTest = results[0];
          hitTest.transformationMatrix.decompose(
            undefined,
            b.rotationQuaternion,
            b.position
          );
          hitTest.transformationMatrix.decompose(
            undefined,
            marker.rotationQuaternion,
            marker.position
          );
        } else {
          marker.isVisible = false;
          hitTest = undefined;
        }
      });
      const mat1 = new StandardMaterial("1", scene);
      mat1.diffuseColor = Color3.Red();
      const mat2 = new StandardMaterial("1", scene);
      mat2.diffuseColor = Color3.Blue();

      if (anchors) {
        console.log("anchors attached");
        anchors.onAnchorAddedObservable.add((anchor) => {
          console.log("attaching", anchor);
          b.isVisible = true;
          anchor.attachedNode = b.clone("mensch");
          anchor.attachedNode.skeleton = skeleton.clone("skelet");
          shadowGenerator.addShadowCaster(anchor.attachedNode, true);
          scene.beginAnimation(
            anchor.attachedNode.skeleton,
            idleRange.from,
            idleRange.to,
            true
          );
          b.isVisible = false;
        });

        anchors.onAnchorRemovedObservable.add((anchor) => {
          console.log("disposing", anchor);
          if (anchor) {
            anchor.attachedNode.isVisible = false;
            anchor.attachedNode.dispose();
          }
        });
      }

      scene.onPointerDown = (evt, pickInfo) => {
        if (
          hitTest &&
          anchors &&
          xr.baseExperience.state === WebXRState.IN_XR
        ) {
          anchors.addAnchorPointUsingHitTestResultAsync(hitTest);
        }
      };

      const planes = [];

      xrPlanes.onPlaneAddedObservable.add((plane) => {
        plane.polygonDefinition.push(plane.polygonDefinition[0]);
        var polygon_triangulation = new PolygonMeshBuilder(
          "name",
          plane.polygonDefinition.map((p) => new Vector2(p.x, p.z)),
          scene
        );
        var polygon = polygon_triangulation.build(false, 0.01);
        plane.mesh = polygon; //BABYLON.TubeBuilder.CreateTube("tube", { path: plane.polygonDefinition, radius: 0.02, sideOrientation: BABYLON.Mesh.FRONTSIDE, updatable: true }, scene);
        //}
        planes[plane.id] = plane.mesh;
        const mat = new StandardMaterial("mat", scene);
        mat.alpha = 0.5;
        mat.diffuseColor = Color3.Random();
        polygon.createNormals();
        // polygon.receiveShadows = true;
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
        plane.mesh = polygon; // BABYLON.TubeBuilder.CreateTube("tube", { path: plane.polygonDefinition, radius: 0.02, sideOrientation: BABYLON.Mesh.FRONTSIDE, updatable: true }, scene);
        //}
        planes[plane.id] = plane.mesh;
        plane.mesh.material = mat;
        plane.mesh.rotationQuaternion = new Quaternion();
        plane.transformationMatrix.decompose(
          plane.mesh.scaling,
          plane.mesh.rotationQuaternion,
          plane.mesh.position
        );
        plane.mesh.receiveShadows = true;
      });

      xrPlanes.onPlaneRemovedObservable.add((plane) => {
        if (plane && planes[plane.id]) {
          planes[plane.id].dispose();
        }
      });

      xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
        planes.forEach((plane) => plane.dispose());
        planes.length = 0;
      });
    },
  },
};
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
