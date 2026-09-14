type DebounceOptions = {
  leading?: boolean;
  maxWait?: number;
  trailing?: boolean;
};

type DebouncedFunction<T extends (...args: any[]) => any> = ((
  ...args: Parameters<T>
) => ReturnType<T> | undefined) & {
  cancel: () => void;
  flush: () => ReturnType<T> | undefined;
};

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait = 0,
  options: DebounceOptions = {},
): DebouncedFunction<T> {
  if (typeof func !== 'function') {
    throw new TypeError('Expected a function');
  }

  const delay = Number(wait) || 0;

  const leading = options.leading ?? false;
  const trailing = options.trailing ?? true;
  const maxing = options.maxWait !== undefined;
  const maxWait = maxing
    ? Math.max(Number(options.maxWait) || 0, delay)
    : undefined;

  let lastArgs: Parameters<T> | undefined;
  let lastThis: ThisParameterType<T> | undefined;

  let timerId: ReturnType<typeof setTimeout> | undefined;
  let lastCallTime: number | undefined;
  let lastInvokeTime = 0;

  let result: ReturnType<T> | undefined;

  const invoke = (time: number): ReturnType<T> | undefined => {
    const args = lastArgs!;
    const thisArg = lastThis;

    lastArgs = undefined;
    lastThis = undefined;
    lastInvokeTime = time;

    result = func.apply(thisArg, args);

    return result;
  };

  const startTimer = (time: number): void => {
    timerId = setTimeout(timerExpired, time);
  };

  const leadingEdge = (time: number): ReturnType<T> | undefined => {
    lastInvokeTime = time;
    startTimer(delay);

    return leading ? invoke(time) : result;
  };

  const remainingWait = (time: number): number => {
    const timeSinceLastCall = time - (lastCallTime ?? 0);
    const timeSinceLastInvoke = time - lastInvokeTime;

    const remaining = delay - timeSinceLastCall;

    return maxing
      ? Math.min(remaining, maxWait! - timeSinceLastInvoke)
      : remaining;
  };

  const shouldInvoke = (time: number): boolean => {
    const timeSinceLastCall = time - (lastCallTime ?? 0);
    const timeSinceLastInvoke = time - lastInvokeTime;

    return (
      lastCallTime === undefined ||
      timeSinceLastCall >= delay ||
      timeSinceLastCall < 0 ||
      (maxing && timeSinceLastInvoke >= maxWait!)
    );
  };

  const trailingEdge = (time: number): ReturnType<T> | undefined => {
    timerId = undefined;

    if (trailing && lastArgs) {
      return invoke(time);
    }

    lastArgs = undefined;
    lastThis = undefined;

    return result;
  };

  const timerExpired = (): void => {
    const time = Date.now();

    if (shouldInvoke(time)) {
      trailingEdge(time);
      return;
    }

    startTimer(remainingWait(time));
  };

  const cancel = (): void => {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }

    lastInvokeTime = 0;
    lastArgs = undefined;
    lastThis = undefined;
    lastCallTime = undefined;
    timerId = undefined;
  };

  const flush = (): ReturnType<T> | undefined => {
    return timerId === undefined
      ? result
      : trailingEdge(Date.now());
  };

  const debounced = function (
    this: ThisParameterType<T>,
    ...args: Parameters<T>
  ): ReturnType<T> | undefined {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timerId === undefined) {
        return leadingEdge(time);
      }

      if (maxing) {
        startTimer(delay);
        return invoke(time);
      }
    }

    if (timerId === undefined) {
      startTimer(delay);
    }

    return result;
  } as DebouncedFunction<T>;

  debounced.cancel = cancel;
  debounced.flush = flush;

  return debounced;
}
