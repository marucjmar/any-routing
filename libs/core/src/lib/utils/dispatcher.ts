export class Dispatcher<EventMap extends object> {
  private callbacks: {
    [E in keyof EventMap]?: Array<(event: EventMap[E]) => void>;
  } = {};

  public fire<E extends keyof EventMap>(
    event: E,
    data: EventMap[E],
  ): void {
    for (const callback of this.callbacks[event] ?? []) {
      try {
        callback(data);
      } catch (error) {
        console.error(error);
      }
    }
  }

  public on<E extends keyof EventMap>(
    event: E,
    callback: (event: EventMap[E]) => void,
  ): void {
    this.callbacks[event] = [
      ...(this.callbacks[event] ?? []),
      callback,
    ];
  }

  public off<E extends keyof EventMap>(
    event: E,
    callback: (event: EventMap[E]) => void,
  ): void {
    this.callbacks[event] = (
      this.callbacks[event] ?? []
    ).filter((item) => item !== callback);
  }
}