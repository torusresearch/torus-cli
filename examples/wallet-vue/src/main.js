import Vue from "vue";
import VueMeta from "vue-meta";
import App from "./App.vue";

Vue.config.productionTip = false;
Vue.use(VueMeta);

new Vue({
  render: (h) => h(App),
}).$mount("#app");
