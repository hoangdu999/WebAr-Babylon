<template>
  <div id="app">
    <BabylonCpn ref="babylonCpn" @xr-session-start="onXRSessionStart" @xr-session-end="onXRSessionEnd" />
    <button v-if="isInAR" @click="enablePlaceMode">Đặt Mô Hình</button>
  </div>
</template>

<script>
import { ref, defineComponent } from 'vue';
import BabylonCpn from './components/BabylonCpn.vue';

export default defineComponent({
  name: 'App',
  components: {
    BabylonCpn,
  },
  setup() {
    const isInAR = ref(false);
    const babylonCpn = ref(null);

    const enablePlaceMode = () => {
      if (babylonCpn.value) {
        babylonCpn.value.enablePlaceMode();
      }
    };

    const onXRSessionStart = () => {
      isInAR.value = true;
    };

    const onXRSessionEnd = () => {
      isInAR.value = false;
    };

    return {
      isInAR,
      babylonCpn,
      enablePlaceMode,
      onXRSessionStart,
      onXRSessionEnd,
    };
  },
});
</script>

<style scoped>
#app {
  position: relative;
}

button {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 20px;
  font-size: 16px;
}
</style>
