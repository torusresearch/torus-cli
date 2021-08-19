<template>
  <div id="app">
    <img alt="Vue logo" src="./assets/logo.png" />
    <Home msg="Create Torus App" />
  </div>
</template>

<script>
import Home from "./components/Home.vue";

export default {
  name: "App",
  metaInfo: {
    title: "Create Torus App",
  },
  components: {
    Home,
  },
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
