import { ReadyState } from "./constants";
import { createStore, useStore } from "./store";
import type { Selector, WSStates } from "./store";

export type Options = {
  protocol?: WebSocket["protocol"];
  isMsgNotJson?: boolean;
  reconnectInterval?: number;
  reconnectAttempt?: number;
  retryOnError?: boolean;
  onReconnect?: () => void;
};

export type WSSendMethod<ReqType> = <
  D = ReqType,
  T extends boolean | undefined | void = void,
>(
  data: T extends true ? ArrayBufferLike | Blob | ArrayBufferView : D,
  dontSerialize?: T,
) => void;

export type WSMethods<MsgType> = Pick<WebSocket, "close"> & {
  /** A method to initiate connection */
  connect: (url: string) => void;
  /** A method to close connection */
  send: WSSendMethod<MsgType>;
  /** A method to get socket instance */
  getSocket: () => WebSocket | undefined;
  /** A method to get socket state */
  getState: () => WSStates<MsgType>;
  /** A method to listen any state changes and trigger callback */
  subscribe: (listener: any) => void;
};

type UseSocket<MsgType> = {
  <R = WSStates<MsgType>>(selector: (states: WSStates<MsgType>) => R): R;
} & WSMethods<MsgType>;

export const createSocket = <T>(opts?: Options): UseSocket<T> => {
  let url = "";
  let socket: WebSocket | undefined = undefined;

  let attempt = opts?.reconnectAttempt ?? 3;
  const timeout = opts?.reconnectInterval ?? 5000;

  const store = createStore<T>();
  const useSocketStore = <R = WSStates<T>>(
    selector: Selector<T, R> = (s) => s as R,
  ) => useStore<T, R>(store, selector);

  /** Websocket instance creator */
  const join = () => {
    if (!url) console.error("WebSocket url is empty");
    else {
      socket = new WebSocket(url, opts?.protocol);
      store.setState({ readyState: ReadyState.CONNECTING });
      socket.onopen = () => {
        store.setState({ readyState: ReadyState.OPEN });
        attempt = opts?.reconnectAttempt ?? 3;
      };
      socket.onmessage = (e: MessageEvent<any>) => {
        store.setState({
          data: opts?.isMsgNotJson ? e.data : JSON.parse(e.data),
        });
      };
      socket.onclose = (e) => {
        const _close = () => {
          socket = undefined;
          store.clearStore();
        };

        store.setState({ readyState: ReadyState.CLOSING });
        if (e.wasClean) _close();
        else {
          reconnect();
          if (attempt === 0) _close();
        }
      };
    }
  };

  /** Reconnect handler */
  const reconnect = () => {
    let timer: number | undefined = undefined;

    if (attempt-- > 0) {
      timer = setTimeout(() => {
        if (opts?.onReconnect) opts.onReconnect();
        join();
      }, timeout);
    } else {
      console.error("Failed to reconnecting web socket");
      if (timer) window.clearTimeout(timer);
    }
  };

  /** Instance methods */
  const methods: WSMethods<T> = {
    connect: (_url) => {
      if (socket) return;
      url = _url;
      join();
    },
    send: (data, dontSerialize) => {
      if (!socket) return;

      if (dontSerialize)
        socket.send(data as ArrayBufferLike | Blob | ArrayBufferView);
      else socket.send(JSON.stringify(data));
    },
    close: (code = 1000, reason) => {
      if (!socket) return;
      socket.close(code, reason);
    },
    getSocket: () => socket,
    getState: () => store.getState(),
    subscribe: (listener) => {
      store.subscribe(listener);
    },
  };

  Object.assign(useSocketStore, methods);
  return useSocketStore as UseSocket<T>;
};
