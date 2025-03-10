import { useSyncExternalStore } from "react";

export const createSocket = <T, U>(opts?: Options): UseSocket<T, U> => {
  let url = "";
  let socket: WebSocket | null = null;
  let afterConnect = () => {};
  let attempt = opts?.reconnectAttempt ?? 3;
  const timeout = opts?.reconnectInterval ?? 5000;

  // Store and hook creation
  const store = createStore<T>();
  const useSocketStore = <R = WSStates<T>>(
    selector: Selector<T, R> = (s) => s as R,
  ) => useStore<T, R>(store, selector);

  /** Websocket instance creator */
  const join = () => {
    if (!url) console.error("WebSocket url is empty");
    else {
      socket = new WebSocket(url, opts?.protocol);
      store.setState({ readyState: WebSocket.CONNECTING });
      socket.onopen = () => {
        afterConnect();
        store.setState({ readyState: WebSocket.OPEN, error: undefined });
        attempt = opts?.reconnectAttempt ?? 3;
      };
      socket.onmessage = (e: MessageEvent<any>) => {
        store.setState({
          data: opts?.isMsgNotJson ? e.data : JSON.parse(e.data),
        });
      };
      socket.onclose = (e) => {
        const _close = () => {
          socket = null;
          store.clearStore();
        };

        store.setState({ readyState: WebSocket.CLOSING });
        if (e.wasClean) _close();
        else {
          reconnect();
          if (attempt === 0) _close();
        }
      };
      socket.onerror = (err) => {
        console.error("WebSocket error:", err);
        store.setState({ error: err });
      };
    }
  };

  /** Reconnect handler */
  const reconnect = () => {
    let timer: ReturnType<typeof setTimeout> | undefined = undefined;

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
  const methods: WSMethods<T, U> = {
    connect: (_url, _afterConnect) => {
      if (socket) return;
      url = _url;
      if (_afterConnect) afterConnect = _afterConnect;
      join();
    },
    send: (data, dontSerialize) => {
      if (!socket) return;

      if (dontSerialize)
        socket.send(data as ArrayBufferLike | Blob | ArrayBufferView);
      else socket.send(JSON.stringify(data));
    },
    close: (code = 1000, reason, beforeClose) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      if (beforeClose) beforeClose();
      socket.close(code, reason);
    },
    getSocket: () => socket,
    getState: () => store.getState(),
    subscribe: store.subscribeWSelector,
  };

  // Merge methods as hook object methods
  Object.assign(useSocketStore, methods);
  return useSocketStore as UseSocket<T, U>;
};

const createStore = <T>() => {
  let states: WSStates<T> = { readyState: WebSocket.CLOSED };
  const listeners = new Set<Listener<T>>();
  const emitChange = () => listeners.forEach((l) => l(states));

  const setState = (
    s: Partial<Pick<WSStates<T>, "readyState" | "data" | "error">>,
  ) => {
    states = Object.assign({}, states, s);
    emitChange();
  };

  const clearStore = () => {
    states = {
      readyState: WebSocket.CLOSED,
    };
    emitChange();
  };

  const getState = () => states;
  const getSnapshot = <R>(selector: Selector<T, R>) => selector(states);
  const subscribe = (listener: Listener<T>) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const subscribeWSelector = <U>(
    selector: (state: WSStates<T>) => U,
    optListener: (selectedState: U, previousSelectedState: U) => Noop,
  ) => {
    let listener: any = selector;
    if (optListener) {
      let currentSlice = selector(getState());
      listener = (state: WSStates<T>) => {
        const nextSlice = selector(state);
        if (!Object.is(currentSlice, nextSlice)) {
          const previousSlice = currentSlice;
          return optListener((currentSlice = nextSlice), previousSlice);
        }
        return () => {};
      };
    }
    return subscribe(listener);
  };

  return {
    subscribe,
    subscribeWSelector,
    getSnapshot,
    getState,
    setState,
    clearStore,
  };
};

const useStore = <T, R>(store: Store<T>, selector: Selector<T, R>) =>
  useSyncExternalStore(store.subscribe, () => store.getSnapshot(selector));

type Options = {
  protocol?: WebSocket["protocol"];
  isMsgNotJson?: boolean;
  reconnectInterval?: number;
  reconnectAttempt?: number;
  retryOnError?: boolean;
  autoConnectOnFirstMount?: boolean;
  afterConnect?: () => void;
  beforeClose?: () => void;
  onReconnect?: () => void;
};

type WSStates<T> = Partial<
  Pick<
    WebSocket,
    "binaryType" | "bufferedAmount" | "extensions" | "protocol" | "url"
  >
> & {
  readyState: WebSocket["readyState"];
  data?: T;
  error?: Event;
};

type Noop = (() => void) | void;
type Listener<T> = (states: WSStates<T>) => Noop;
type Selector<T, R> = (states: WSStates<T>) => R;
type Store<T> = ReturnType<typeof createStore<T>>;

type WSSendMethod<ReqType> = <
  D = ReqType,
  T extends boolean | undefined | void = void,
>(
  data: T extends true ? ArrayBufferLike | Blob | ArrayBufferView : D,
  dontSerialize?: T,
) => void;

type WSMethods<ResMsg, ReqMsg> = {
  connect: (url: string, afterConnect?: () => void) => void;
  close(code?: number, reason?: string, beforeClose?: () => void): void;
  /** A method to close connection */
  send: WSSendMethod<ReqMsg>;
  /** A method to get socket instance */
  getSocket: () => WebSocket | null;
  /** A method to get socket state */
  getState: () => WSStates<ResMsg>;
  /** A method to listen when state in `selector` changes then trigger `optListener` callback */
  subscribe: <U>(
    selector: (state: WSStates<ResMsg>) => U,
    optListener: (selectedState: U, previousSelectedState: U) => Noop,
  ) => () => void;
};

type UseSocket<ResMsg, ReqMsg> = {
  <R = WSStates<ResMsg>>(selector: (states: WSStates<ResMsg>) => R): R;
} & WSMethods<ResMsg, ReqMsg>;
