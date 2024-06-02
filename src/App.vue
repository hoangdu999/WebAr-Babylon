<template>
  <div id="app">
    <BabylonCpn ref="babylonCpn" />
    <button @click="enablePlaceMode">Đặt Mô Hình</button>
  </div>
</template>

<script>
import BabylonCpn from './components/BabylonCpn.vue';

export default {
  name: 'App',
  components: {
    BabylonCpn,
  },
  methods: {
    enablePlaceMode() {
      this.$refs.babylonCpn.enablePlaceMode();
      
    },
  },
};
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
