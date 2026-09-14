export class Requester {
  private buffer: AbortController[] = [];
  private readonly maxBuffer = 4;
  public get hasPendingRequests(): boolean {
    return this.buffer.length > 0;
  }

  public async request(url: string, params?: RequestInit) {
    const controller = new AbortController();

    if (this.buffer.length >= this.maxBuffer) {
      this.buffer.shift()?.abort();
    }

    this.buffer.push(controller);

    try {
      const response = await fetch(url, {
        ...params,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw response;
      }

      return await response.json();
    } finally {
      this.cleanBuffer(controller);
    }
  }

  public abortAllRequests(): void {
    this.buffer.forEach((controller) => controller.abort());
    this.buffer = [];
  }

  private cleanBuffer(controller: AbortController): void {
    this.buffer = this.buffer.filter((ctrl) => ctrl !== controller);
  }
}
