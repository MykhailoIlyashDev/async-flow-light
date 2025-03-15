/**
 * AsyncFlow - Легка бібліотека для елегантної роботи з асинхронним кодом
 */

type AsyncFunction<T = any> = (...args: any[]) => Promise<T>;
type AnyFunction<T = any> = (...args: any[]) => T;

/**
 * Послідовно виконує ланцюжок асинхронних функцій, передаючи результат
 * кожної функції як аргумент для наступної
 */
export async function flow<T>(
  initialFn: AsyncFunction<T>,
  ...fns: AnyFunction[]
): Promise<any> {
  let result = await initialFn();
  
  for (const fn of fns) {
    result = await fn(result);
  }
  
  return result;
}

/**
 * Параметри для паралельного виконання
 */
interface ParallelOptions {
  concurrency?: number;
  stopOnError?: boolean;
}

/**
 * Виконує масив асинхронних функцій паралельно з обмеженням конкурентності
 */
export async function parallel<T>(
  fns: AsyncFunction<T>[],
  options: ParallelOptions = {}
): Promise<T[]> {
  const { concurrency = Infinity, stopOnError = true } = options;
  const results: T[] = new Array(fns.length);
  const errors: Error[] = [];
  
  // Якщо немає функцій, повертаємо пустий масив
  if (fns.length === 0) return [];
  
  // Якщо concurrency === Infinity, використовуємо Promise.all
  if (concurrency === Infinity) {
    return Promise.all(fns.map(fn => fn()));
  }
  
  return new Promise((resolve, reject) => {
    let currentIndex = 0;
    let completedCount = 0;
    let activeCount = 0;
    
    // Функція для запуску наступної задачі
    const runNext = async () => {
      if (currentIndex >= fns.length) return;
      
      const index = currentIndex++;
      activeCount++;
      
      try {
        results[index] = await fns[index]();
      } catch (error) {
        if (error instanceof Error) {
          errors.push(error);
          if (stopOnError) {
            return reject(error);
          }
        }
      } finally {
        activeCount--;
        completedCount++;
        
        // Перевіряємо, чи всі задачі завершені
        if (completedCount === fns.length) {
          if (errors.length > 0 && stopOnError) {
            reject(errors[0]);
          } else {
            resolve(results);
          }
        } else {
          // Запускаємо наступну задачу
          runNext();
        }
      }
    };    
    // Запускаємо початкові задачі відповідно до concurrency
    const initialBatch = Math.min(concurrency, fns.length);
    for (let i = 0; i < initialBatch; i++) {
      runNext();
    }
  });
}

/**
 * Параметри для повторних спроб
 */
interface RetryOptions {
  attempts?: number;
  delay?: number;
  backoff?: boolean;
  maxDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Виконує асинхронну функцію з автоматичними повторними спробами
 */
export async function retry<T>(
  fn: AsyncFunction<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    attempts = 3,
    delay = 1000,
    backoff = true,
    maxDelay = 30000,
    onRetry = () => {}
  } = options;
  
  let lastError: Error = new Error('Operation failed');
  
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof Error) {
        lastError = error;
        
        if (attempt < attempts) {
          onRetry(attempt, error);
          
          // Розрахунок затримки з експоненціальним відступом
          const waitTime = backoff
            ? Math.min(delay * Math.pow(2, attempt - 1), maxDelay)
            : delay;
            
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      } else {
        lastError = new Error(String(error));
      }
    }
  }
  
  throw lastError;
}

/**
 * Встановлює таймаут для асинхронної операції
 */
export async function timeout<T>(
  promise: Promise<T>,
  ms: number,
  message = 'Operation timed out'
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(message);
      error.name = 'TimeoutError';
      reject(error);
    }, ms);
  });
  
  return Promise.race([
    promise.finally(() => clearTimeout(timeoutId)),
    timeoutPromise
  ]);
}

/**
 * Параметри для обмеження швидкості
 */
interface RateLimitOptions {
  maxCalls: number;
  perInterval: number;
}

/**
 * Створює функцію з обмеженням швидкості викликів
 */
export function rateLimit<T extends AnyFunction>(
  fn: T,
  options: RateLimitOptions
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  const { maxCalls, perInterval } = options;
  const queue: Array<{
    args: Parameters<T>;
    resolve: (value: ReturnType<T>) => void;
    reject: (reason: any) => void;
  }> = [];
  
  let callsInInterval = 0;
  let intervalId: NodeJS.Timeout | null = null;
  
  const processQueue = async () => {
    if (queue.length === 0 || callsInInterval >= maxCalls) return;
    
    const { args, resolve, reject } = queue.shift()!;
    callsInInterval++;
    
    if (!intervalId) {
      intervalId = setTimeout(() => {
        callsInInterval = 0;
        intervalId = null;
        processQueue();
      }, perInterval);
    }
    
    try {
      const result = await fn(...args);
      resolve(result as ReturnType<T>);
    } catch (error) {
      reject(error);
    } finally {
      processQueue();
    }
  };
  
  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return new Promise((resolve, reject) => {
      queue.push({ args, resolve, reject });
      processQueue();
    });
  };
}

/**
 * Результат операції з можливістю скасування
 */
interface CancellablePromise<T> {
  promise: Promise<T>;
  cancel: () => void;
}

/**
 * Створює скасовуваний проміс
 */
export function withCancel<T>(promise: Promise<T>): CancellablePromise<T> {
  let isCancelled = false;
  let rejectFn: (reason: any) => void;
  
  const wrappedPromise = new Promise<T>((resolve, reject) => {
    rejectFn = reject;
    
    promise.then(
      result => {
        if (!isCancelled) resolve(result);
      },
      error => {
        if (!isCancelled) reject(error);
      }
    );
  });
  
  return {
    promise: wrappedPromise,
    cancel: () => {
      isCancelled = true;
      const error = new Error('Operation cancelled');
      error.name = 'OperationCancelled';
      rejectFn(error);
    }
  };
}

/**
 * Параметри для пакетної обробки
 */
interface BatchOptions {
  size?: number;
  delay?: number;
  concurrency?: number;
}

/**
 * Обробляє масив даних пакетами
 */
export async function batch<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  options: BatchOptions = {}
): Promise<R[]> {
  const { size = 10, delay = 0, concurrency = Infinity } = options;
  const results: R[] = new Array(items.length);
  
  // Розділяємо масив на пакети
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  
  // Обробляємо кожен пакет
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchResults = await parallel(
      batch.map((item, index) => async () => {
        const result = await fn(item);
        const originalIndex = i * size + index;
        results[originalIndex] = result;
        return result;
      }),
      { concurrency }
    );
    
    // Затримка між пакетами
    if (delay > 0 && i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return results;
}

/**
 * Безпечно виконує асинхронну операцію, повертаючи [error, result]
 */
export async function safe<T>(promise: Promise<T>): Promise<[Error | null, T | null]> {
  try {
    const result = await promise;
    return [null, result];
  } catch (error) {
    return [error instanceof Error ? error : new Error(String(error)), null];
  }
}
