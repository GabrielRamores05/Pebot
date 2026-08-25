// Utility to emit Socket.IO events from API routes via global.io
export function emitEvent(event: string, data: unknown, room?: string) {
  try {
    const io = (global as any).io;
    if (!io) {
      console.error(`[Socket emit ERROR] global.io not found! Event: ${event}`);
      return;
    }
    console.log(`[Socket emit] Broadcasting "${event}" to ${room ? `room: ${room}` : 'all clients'}`);
    if (room) {
      io.to(room).emit(event, data);
    } else {
      io.emit(event, data);
    }
  } catch (e) {
    console.error('[Socket emit error]', e);
  }
}
