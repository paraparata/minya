import { useSyncExternalStore } from "react";
import { ReadyState } from "./constants";

export type WSStates<T> = Partial<
  Pick<
    WebSocket,
    "binaryType" | "bufferedAmount" | "extensions" | "protocol" | "url"
  >
> & {
  readyState: WebSocket["readyState"];
  data?: T;
};

export type Listener = () => () => void;

export type Selector<T, R> = (states: WSStates<T>) => R;

export type Store<T> = ReturnType<typeof createStore<T>>;

export const createStore = <T>() => {
  let states: WSStates<T> = {
    readyState: ReadyState.CLOSED,
  };
  const listeners = new Set<Listener>();

  const emitChange = () => {
    listeners.forEach((l) => l());
  };

  const setState = (s: Partial<Pick<WSStates<T>, "readyState" | "data">>) => {
    states = Object.assign({}, states, s);
    emitChange();
  };

  const clearStore = () => {
    states = {
      readyState: ReadyState.CLOSED,
    };
    emitChange();
  };

  const getState = () => states;

  const getSnapshot = <R>(selector: Selector<T, R>) => selector(states);

  const subscribe = (listener: any) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    subscribe,
    getSnapshot,
    getState,
    setState,
    clearStore,
  };
};

export const useStore = <T, R>(store: Store<T>, selector: Selector<T, R>) =>
  useSyncExternalStore(store.subscribe, () => store.getSnapshot(selector));
