import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;

  connect(token: string): Socket {
    if (!this.socket) {
      this.socket = io('http://localhost:3001', {
        auth: {
          token
        },
        transports: ['websocket']
      });

      this.socket.on('connect', () => {
        console.log('Connected to WebSocket server');
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
      });

      this.socket.on('error', (error) => {
        console.error('Socket error:', error);
      });
    }

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  // Subscribe to specific events
  subscribeToInventoryUpdates(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('inventory_update', callback);
    }
  }

  subscribeToQuoteUpdates(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('new_quote', callback);
    }
  }

  subscribeToRequestUpdates(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('request_update', callback);
    }
  }

  // Join specific rooms
  joinRequestRoom(requestId: string) {
    if (this.socket) {
      this.socket.emit('join_request', requestId);
    }
  }

  leaveRequestRoom(requestId: string) {
    if (this.socket) {
      this.socket.emit('leave_request', requestId);
    }
  }
}

export default new SocketService();