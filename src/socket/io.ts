import type { Server } from "socket.io";

/**
 * Io registry — breaks the import cycle between services (which emit events)
 * and the socket bootstrap (which imports services for handlers).
 */
let ioInstance: Server | null = null;

export function setIo(io: Server): void {
  ioInstance = io;
}

export function getIo(): Server | null {
  return ioInstance;
}
