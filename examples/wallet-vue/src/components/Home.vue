<template>
  <div class="hello">
    <h1>{{ msg }}</h1>
    <p v-if="loading">Loading...</p>
    <p v-else-if="!account">
      You didn't logged in.
      <button @click="login">Login</button>
    </p>
    <div class="info-container" v-else>
      <h3>Your account information</h3>
      <div class="info">
        <p><strong>Name</strong>: {{ account.name }}</p>
        <p><strong>Address</strong>: {{ account.address }}</p>
        <p><strong>Balance</strong>: {{ account.balance }}</p>
      </div>
    </div>
    <button v-if="!!account" @click="logout">Logout</button>
  </div>
</template>

<script>
import Torus from "@toruslabs/torus-embed";
import Web3 from "web3";

export default {
  name: "Home",
  data: function () {
    return {
      torus: null,
      account: null,
      loading: true,
    };
  },
  created: async function () {
    try {
      this.torus = new Torus();
      await this.torus.init();
      await this.torus.getUserInfo();
      await this.connectToWeb3();
    } catch {
      // User didn't logged in
    } finally {
      this.loading = false;
    }
  },
  props: {
    msg: String,
  },
  methods: {
    async login() {
      try {
        this.loading = true;
        await this.torus.login();
        await this.connectToWeb3();
      } finally {
        this.loading = false;
      }
    },
    async logout() {
      try {
        this.loading = true;
        await this.torus.logout();
      } finally {
        this.account = null;
        this.loading = false;
      }
    },
    async connectToWeb3() {
      const user = await this.torus.getUserInfo();
      const web3 = new Web3(this.torus.provider);
      const address = (await web3.eth.getAccounts())[0];
      const balance = await web3.eth.getBalance(address);
      this.account = {
        name: user.name,
        address,
        balance,
      };
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
h3 {
  margin: 0;
}
a {
  color: #42b983;
}
.info-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.info {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  margin-top: 20px;
}
.info p {
  margin-bottom: 4px;
  margin-top: 0;
}
</style>
