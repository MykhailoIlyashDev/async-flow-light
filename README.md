# Async Flow Light

A lightweight library for elegant asynchronous code management in JavaScript and TypeScript.

## Features

- Sequential Flow Control - Chain async operations with clean syntax
- Parallel Execution - Run async functions concurrently with controlled concurrency
- Automatic Retries - Retry failed operations with exponential backoff
- Timeout Management - Set timeouts for any async operation
- Rate Limiting - Control the frequency of function calls
- Cancellable Promises - Cancel long-running operations
- Batch Processing - Process large data sets in manageable chunks
- Error Handling - Safely handle async errors with minimal boilerplate

## Installation

```bash
npm install async-flow-light
```

## Usage

### Sequential Flow
Chain async operations where each function receives the result of the previous one:

```javascript
import { flow } from 'async-flow-light';

const result = await flow(
  async () => fetchUserData(userId),
  userData => fetchUserPosts(userData.id),
  posts => posts.filter(post => post.isPublished)
);
```

### Parallel Execution
Run multiple async operations concurrently with controlled concurrency:


```javascript
import { parallel } from 'async-flow-light';

// Run 3 API calls in parallel
const [users, posts, comments] = await parallel([
  () => fetchUsers(),
  () => fetchPosts(),
  () => fetchComments()
]);

// Process a large array with limited concurrency
const results = await parallel(
  userIds.map(id => () => processUser(id)),
  { concurrency: 5 } // Process 5 users at a time
);
```

### Automatic Retriess
Retry failed operations with configurable backoff:

```javascript
import { retry } from 'async-flow-light';

const data = await retry(
  () => fetchFromUnreliableAPI(),
  {
    attempts: 5,
    delay: 1000,
    backoff: true,
    onRetry: (attempt, error) => console.log(`Retry ${attempt} after error: ${error.message}`)
  }
);
```

### Timeout Management
Set a timeout for any async operation:

```javascript
import { timeout } from 'async-flow-light';

try {
  const result = await timeout(
    fetchLargeDataset(),
    5000, // 5 seconds timeout
    'Data fetch timed out'
  );
} catch (error) {
  if (error.name === 'TimeoutError') {
    console.log('Operation took too long');
  }
}
```

### Rate Limiting
Control the frequency of function calls:

```javascript
import { rateLimit } from 'async-flow-light';

// Create a rate-limited API client
const rateLimitedFetch = rateLimit(fetch, {
  maxCalls: 5,
  perInterval: 1000 // 5 calls per second
});

// Use it like the original function
const response = await rateLimitedFetch('https://api.example.com/data');
```

### Cancellable Promises
Create promises that can be cancelled:

```javascript
import { withCancel } from 'async-flow-light';

const { promise, cancel } = withCancel(longRunningOperation());

// Cancel after 3 seconds
setTimeout(() => {
  console.log('Operation taking too long, cancelling...');
  cancel();
}, 3000);

try {
  const result = await promise;
  console.log('Operation completed:', result);
} catch (error) {
  if (error.name === 'OperationCancelled') {
    console.log('Operation was cancelled');
  }
}
```

### Batch Processing
Process large data sets in manageable chunks:

```javascript
import { batch } from 'async-flow-light';

// Process 1000 items in batches of 50 with a delay between batches
const results = await batch(
  largeArray,
  async (item) => processItem(item),
  {
    size: 50,
    delay: 100, // 100ms between batches
    concurrency: 5 // Process 5 items concurrently within each batch
  }
);
```

### Safe Error Handling
Handle async errors with a clean pattern:

```javascript
import { safe } from 'async-flow-light';

const [error, data] = await safe(fetchData());

if (error) {
  console.error('Failed to fetch data:', error.message);
} else {
  console.log('Data received:', data);
}
```

## API Reference

### Server Methods

- `flow<T>(initialFn: AsyncFunction<T>, ...fns: AnyFunction[]): Promise<any>` - Sequentially executes a chain of async functions, passing the result of each function as an argument to the next.
- `parallel<T>(fns: AsyncFunction<T>[], options?: ParallelOptions): Promise<T[]>` - Executes an array of async functions in parallel with optional concurrency control.
  Options
    - concurrency: Maximum number of functions to run simultaneously (default: Infinity)
    - stopOnError: Whether to stop all executions on first error (default: true)
- `retry<T>(fn: AsyncFunction<T>, options?: RetryOptions): Promise<T>` - Executes an async function with automatic retries on failure.
  Options
    - attempts: Maximum number of attempts (default: 3)
    - delay: Base delay between attempts in ms (default: 1000)
    - backoff: Whether to use exponential backoff (default: true)
    - maxDelay: Maximum delay between attempts in ms (default: 30000)
    - onRetry: Callback function called on each retry
- `timeout<T>(promise: Promise<T>, ms: number, message?: string): Promise<T>` - Sets a timeout for an async operation.
- `rateLimit<T>(fn: T, options: RateLimitOptions): (...args: Parameters<T>) => Promise<ReturnType<T>>` - Creates a rate-limited version of a function.
  Options
    - maxCalls: Maximum number of calls allowed
    - perInterval: Time interval in ms
- `withCancel<T>(promise: Promise<T>): CancellablePromise<T>` - Creates a cancellable promise.
- `batch<T, R>(items: T[], fn: (item: T) => Promise<R>, options?: BatchOptions): Promise<R[]>` - Processes an array of items in batches.
  Options
    - size: Batch size (default: 10)
    - delay: Delay between batches in ms (default: 0)
    - concurrency: Maximum concurrent operations per batch (default: Infinity)
- `safe<T>(promise: Promise<T>): Promise<[Error | null, T | null]>` - Safely executes an async operation, returning [error, result].

## License

MIT

Made with by Michael Ilyash
