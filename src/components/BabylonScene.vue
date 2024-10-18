<template>
    <div>
        <canvas id="renderCanvas" touch-action="none" style="width: 100%; height: 100%"></canvas>
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
import {
  AdvancedDynamicTexture,
  Button,
  Control,
  InputTextArea,
  ScrollViewer,
} from "@babylonjs/gui";
import {
  WebXRHitTest,
  WebXRPlaneDetector,
  WebXRAnchorSystem,
  WebXRBackgroundRemover,
  WebXRState,
} from "@babylonjs/core/XR";
import earcut from "earcut";
import axios from "axios";

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
      recognition: null,
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

      return scene;
    },
    createCamera(scene, canvas) {
      this.camera = new FreeCamera("camera1", new Vector3(0, 1, -5), scene);
      this.camera.setTarget(Vector3.Zero());
      this.camera.attachControl(canvas, true);
    },
    createLights(scene) {
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
      this.shadowGenerator.darkness = 0.5;
    },
    async loadModel(scene) {
      const result = await SceneLoader.ImportMeshAsync(
        "",
        "models/",
        "dummy3.babylon",
        scene
      );
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
      const ground = MeshBuilder.CreateGround(
        "ground",
        { width: 4, height: 4 },
        scene
      );
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
      const marker = MeshBuilder.CreateTorus(
        "marker",
        { diameter: 0.15, thickness: 0.05 },
        scene
      );
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
      this.createAnswerTextArea();
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
      guiButton.width = "150px"; // Tăng chiều rộng lên 1.5 lần
      guiButton.height = "150px"; // Tăng chiều cao lên 1.5 lần
      guiButton.color = "white";
      guiButton.fontSize = "24px";
      guiButton.cornerRadius = 75; // 50% của chiều rộng/chiều cao để tạo hình tròn
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

      // Initialize micro button
      const guiButton = Button.CreateSimpleButton("microButton", "Micro");
      guiButton.width = "150px";
      guiButton.height = "150px";
      guiButton.color = "white";
      guiButton.fontSize = "24px";
      guiButton.cornerRadius = 75;
      guiButton.background = "black"; // Initial background color
      guiButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
      guiButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      guiButton.left = "160px";
      guiButton.top = "-100px";

      // Microphone status
      let isListening = false;

      // Event when micro button is pressed
      guiButton.onPointerUpObservable.add(() => {
        if (!isListening) {
          // Start listening
          guiButton.textBlock.text = "Listening";
          guiButton.background = "red"; // Change background color to red
          this.startMicrophone();
        } else {
          // Stop listening
          guiButton.textBlock.text = "Micro";
          guiButton.background = "black"; // Change background color back to black
          this.stopMicrophone();
        }
        isListening = !isListening; // Toggle the listening state
      });

      guiCanvas.addControl(guiButton);
    },

    createAnswerTextArea() {
      const guiCanvas = AdvancedDynamicTexture.CreateFullscreenUI("UI");
      this.guiTextArea = guiCanvas;

      // Tạo ScrollViewer để chứa TextArea
      const scrollViewer = new ScrollViewer();
      scrollViewer.width = "320px";
      scrollViewer.height = "220px";
      scrollViewer.color = "white";
      scrollViewer.thickness = 0;
      scrollViewer.background = "black";
      scrollViewer.cornerRadius = 20; // Bo cong góc với bán kính 20px
      scrollViewer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      scrollViewer.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
      scrollViewer.left = "160px"; // Đặt ScrollViewer trên cùng vị trí ngang của nút micro
      scrollViewer.top = "-270px"; // Đặt ScrollViewer trên nút micro, cách nút 20px

      // Tạo TextArea bên trong ScrollViewer
      const questionTextArea = new InputTextArea();
      questionTextArea.name = "questionTextArea";
      questionTextArea.width = "300px";
      questionTextArea.height = "1000px"; // Tăng chiều cao để kiểm tra cuộn
      questionTextArea.color = "white";
      questionTextArea.fontSize = 24;
      questionTextArea.background = "black";
      questionTextArea.text = "";
      questionTextArea.placeholderText = "AIVI will answer you here...";
      questionTextArea.textWrapping = true;

      // Thêm TextArea vào ScrollViewer
      scrollViewer.addControl(questionTextArea);

      // Thêm ScrollViewer vào GUI
      guiCanvas.addControl(scrollViewer);
    },
    startMicrophone() {
      if ("webkitSpeechRecognition" in window) {
        // eslint-disable-next-line no-undef
        this.recognition = new webkitSpeechRecognition();
      } else if ("SpeechRecognition" in window) {
        // eslint-disable-next-line no-undef
        this.recognition = new SpeechRecognition();
      } else {
        alert("Your browser does not support Speech Recognition");
        return;
      }

      if (this.recognition) {
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = "vi-VN";

        this.recognition.onstart = () => {
          console.log("Đang ghi âm...");
        };

        this.recognition.onresult = (event) => {
          console.log("Đã ghi âm xong.");
          const transcript = event.results[0][0].transcript;
          console.log("Văn bản đã ghi âm được:", transcript);
          this.updateAnswerTextbox(transcript);
          this.sendToChatAPI(transcript);
        };

        this.recognition.onerror = (event) => {
          console.log("Có lỗi xảy ra trong quá trình ghi âm: " + event.error);
        };

        this.recognition.onend = () => {
          console.log("Ghi âm kết thúc.");
        };

        this.recognition.start();
      }
    },

    stopMicrophone() {
      if (this.recognition) {
        this.recognition.stop();
      }
    },

    updateAnswerTextbox(text) {
      const answerTextbox = this.guiTextArea.getControlByName("answerTextArea");
      if (answerTextbox) {
        answerTextbox.text = text;
      }
    },
    sendToChatAPI(user_input) {
      axios
        .post("https://backend.tech-sustain.pro/chat", { user_input })
        .then((response) => {
          const data = response.data;
          console.log("API Response:", data);
          const answerTextbox =
            this.guiTextArea.getControlByName("questionTextArea");
          if (answerTextbox) {
            answerTextbox.text = data.response;
          }

          // Tạo phần tử audio và phát âm thanh
          const audio = new Audio(
            `https://backend.tech-sustain.pro/audio/${data.audio_file}`
          );
          audio.play();
        })
        .catch((error) => {
          console.error("API Error:", error);
        });
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