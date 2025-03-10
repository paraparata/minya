import { useRef, useState } from "react";
import reactLogo from "./assets/react.svg";
import "./App.css";
import { createSocket } from "./libs/useSocket";

type SocketRes =
  | {
      command: "res-progress";
      message: { current: number; total: number };
    }
  | {
      command: "res-text";
      message: string;
    };

type SocketReq = {
  command: "req-text" | "req-progress";
  message: any;
};

const useSockety = createSocket<SocketRes, SocketReq>();

const Status = () => {
  const readyState = useSockety((s) => s.readyState);
  return <div onClick={() => console.log(readyState)}>{readyState}</div>;
};

const FunnyRes = () => {
  const text = useSockety((s) =>
    s.data?.command === "res-text" ? s.data.message : "",
  );
  return (
    <>
      <p
        style={{
          maxWidth: "200px",
          padding: "0.5rem",
          wordWrap: "break-word",
          border: "thin solid white",
        }}
      >
        {text}
      </p>
      <button onClick={() => console.log(text)}>log data</button>
    </>
  );
};

const Funnyfy = () => {
  return (
    <div>
      <Status />
      <textarea
        rows={10}
        onChange={(e) =>
          useSockety.send({ command: "req-text", message: e.target.value })
        }
      />
      <FunnyRes />
    </div>
  );
};

interface SocketyProps {
  id: number;
}

const Sockety: React.FC<SocketyProps> = ({ id }) => {
  return (
    <div
      style={{
        width: "100%",
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        placeItems: "center",
      }}
    >
      <span>Socket {id}</span>
      <div>
        <button onClick={() => useSockety.connect("ws://localhost:3000")}>
          Connect
        </button>
        <button onClick={() => useSockety.close()}>Close</button>
        {/* <button onClick={() => console.log(useSockety.log())}>Log</button> */}
        <button onClick={() => console.log(useSockety.getSocket())}>
          Log socket
        </button>
      </div>
      <Funnyfy />
    </div>
  );
};

const Socketer = () => {
  return (
    <div
      style={{
        width: "70dvw",
        display: "flex",
        justifyContent: "space-between",
      }}
    >
      <Sockety id={1} />
    </div>
  );
};

let total = 0;

const Counter = () => {
  const totalRef = useRef(total);
  const [count, setCount] = useState(0);

  return (
    <>
      <button onClick={() => setCount((count) => count + 1)}>
        count is {count}
      </button>
      <button onClick={() => console.log(total, totalRef.current)}>
        log total
      </button>
      <button
        onClick={() => {
          total += 1;
        }}
      >
        add total
      </button>
      <p>
        Edit <code>src/App.tsx</code> and save to test HMR
      </p>
    </>
  );
};

const ProgressActions = () => {
  return (
    <>
      <button onClick={() => useSockety.send({ command: "req-progress" })}>
        Check Progress
      </button>
    </>
  );
};

const ProgressContent = () => {
  const progress = useSockety((s) =>
    s.data?.command === "res-progress" ? s.data.message?.current || "" : "",
  );
  return <span>{progress}</span>;
};

const Progress = () => (
  <div>
    <ProgressContent /> <ProgressActions />
  </div>
);

function App() {
  return (
    <div className="App">
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src="/vite.svg" className="logo" alt="Vite logo" />
        </a>
        <a href="https://reactjs.org" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <Counter />
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
      <div className="card">
        <Socketer />
      </div>
      <div>
        <Progress />
      </div>
    </div>
  );
}

export default App;
