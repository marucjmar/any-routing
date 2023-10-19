export class Dispatcher<EventMap extends object> {
  private callbacks: { [key in keyof EventMap]?: Array<(...args) => void> } = {};

  public fire<E extends keyof EventMap>(event: E, data: EventMap[E]) {
    this.getEventCallbacks(event).forEach((callback) => {
      try {
        callback(data);
      } catch (e) {
        console.error(e);
      }
    });
  }

  public on<E extends keyof EventMap>(event: E, callback: (event: EventMap[E]) => void): void {
    this.callbacks[event] = [...this.getEventCallbacks(event), callback];
  }

  public off<E extends keyof EventMap>(event: E, callback: (event: EventMap[E]) => void) {
    this.callbacks[event] = this.getEventCallbacks(event).filter((c) => c !== callback);
  }

  private getEventCallbacks<E extends keyof EventMap>(event: E): Array<(...args) => void> {
    return this.callbacks[event] || [];
  }
}
