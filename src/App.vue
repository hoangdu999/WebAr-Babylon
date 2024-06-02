<template>
  <div id="app">
    <BabylonCpn @placeModel="handlePlaceModel" />
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
      this.$emit('placeModel');
    },
    handlePlaceModel() {
      console.log('Sự kiện đặt mô hình đã được kích hoạt');
      // Logic bổ sung nếu cần
    },
  },
};
</script>
