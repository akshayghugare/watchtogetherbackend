/**
 * In-memory registry of live screen shares and call media states
 * (mirrors `call:media-state` events). Standalone module so socket
 * handlers and the admin service can share it without import cycles.
 */

export interface ScreenShareInfo {
  roomId: string;
  userId: string;
  socketId: string;
  username: string | null;
  startedAt: Date;
}

export interface CallMediaState {
  roomId: string;
  userId: string;
  socketId: string;
  audio: boolean;
  video: boolean;
  screen: boolean;
}

/** roomId → active screen share (one presenter per room). */
const screenShares = new Map<string, ScreenShareInfo>();
/** socketId → last reported media state while in a call. */
const mediaStates = new Map<string, CallMediaState>();

export function getScreenShare(roomId: string): ScreenShareInfo | undefined {
  return screenShares.get(roomId);
}

export function setScreenShare(info: ScreenShareInfo): void {
  screenShares.set(info.roomId, info);
}

export function clearScreenShare(roomId: string): ScreenShareInfo | undefined {
  const info = screenShares.get(roomId);
  screenShares.delete(roomId);
  return info;
}

export function listScreenShares(): ScreenShareInfo[] {
  return [...screenShares.values()];
}

export function setMediaState(state: CallMediaState): void {
  mediaStates.set(state.socketId, state);
}

export function clearMediaState(socketId: string): void {
  mediaStates.delete(socketId);
}

export function listRoomMediaStates(roomId: string): CallMediaState[] {
  return [...mediaStates.values()].filter((s) => s.roomId === roomId);
}
