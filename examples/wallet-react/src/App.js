import { useCallback, useEffect, useState } from "react";
import Torus from "@toruslabs/torus-embed";
import Web3 from "web3";
import wordmark from "./wordmark.svg";
import "./App.css";

function App() {
  const [torus, setTorus] = useState();
  const [user, setUser] = useState();
  const [account, setAccount] = useState();
  const [loading, setLoading] = useState(false);

  const connectToWeb3 = useCallback(
    async (torus) => {
      const user = await torus.getUserInfo();
      setUser(user);

      const web3 = new Web3(torus.provider);
      const address = (await web3.eth.getAccounts())[0];
      const balance = await web3.eth.getBalance(address);
      setAccount({ web3, address, balance });

      /**
       * Interact with Web3, e.g. send transactions, etc.
       * See https://web3js.readthedocs.io.
       */
    },
    [setUser, setAccount]
  );

  const onClickLogin = useCallback(async () => {
    setLoading(true);
    try {
      await torus.login();
      await connectToWeb3(torus);
    } finally {
      setLoading(false);
    }
  }, [torus, connectToWeb3, setLoading]);

  const onClickLogout = useCallback(async () => {
    setLoading(true);
    try {
      await torus.logout();
    } finally {
      setUser(undefined);
      setAccount(undefined);
      setLoading(false);
    }
  }, [torus, setUser, setAccount, setLoading]);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const torus = new Torus();
      await torus.init();
      try {
        await connectToWeb3(torus);
      } catch {
        // User didn't log in yet.
      } finally {
        setTorus(torus);
      }
    })().finally(() => setLoading(false));
  }, [connectToWeb3, setTorus, setLoading]);

  return (
    <div className="App">
      <header className="App-header">
        <img src={wordmark} className="App-logo" alt="logo" />
        {torus && !loading ? (
          user && account ? (
            <div className="App-info">
              <p>
                Logged in as <strong>{user.name}</strong>.
              </p>
              <p>
                <strong>Address</strong>: {account.address}
              </p>
              <p>
                <strong>Balance</strong>: {account.balance}
              </p>
              <button className="App-link" onClick={onClickLogout}>
                Logout
              </button>
            </div>
          ) : (
            <>
              <p>You didn't login yet. Login to see your account details.</p>
              <button className="App-link" onClick={onClickLogin}>
                Login
              </button>
            </>
          )
        ) : (
          <p>Loading...</p>
        )}
      </header>
    </div>
  );
}

export default App;
