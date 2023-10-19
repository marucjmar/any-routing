export class Requester {
  private latestResponseId = 0;
  private lastResponseId = 0;
  private buffer: AbortController[] = [];
  private maxBuffer = 4;
  private pending = false;

  public get hasPendingRequests(): boolean {
    return this.pending;
  }

  public async request(url, params?: RequestInit) {
    const controller = new AbortController();
    const executionId = Date.now();
    this.lastResponseId = executionId;
    this.pending = true;

    if (this.buffer.length > this.maxBuffer) {
      this.buffer[0].abort();
      this.buffer.splice(0, 1);
    }

    this.buffer.push(controller);

    const response = await fetch(url, {
      ...params,
      signal: controller.signal,
    });

    this.cleanBuffer(controller);

    if (response.status !== 200) {
      throw response;
    }

    if (this.latestResponseId > executionId) {
      throw new Error('Prev response');
    }

    this.pending = this.lastResponseId !== executionId;

    this.latestResponseId = executionId;

    return await response.json();
  }

  public abortAllRequests(): void {
    this.buffer.forEach((buff) => buff.abort());
  }

  private cleanBuffer(controller) {
    this.buffer = this.buffer.filter((ctrl) => ctrl !== controller);
  }
}
