# async-iterable

<!--
[![Coverage Workflow](https://github.com/vadzim/async-iterable-controller/actions/workflows/coverage.yml/badge.svg?branch=main)](https://github.com/vadzim/async-iterable-controller/actions/workflows/coverage.yml)
[![codecov](https://codecov.io/gh/vadzim/async-iterable-controller/branch/main/graph/badge.svg)](https://codecov.io/gh/vadzim/async-iterable-controller)
-->

Controlled async iterable.

```ts
const items = createAsyncIterable<number>(controller => {
  doStuffWithCallback(async result => {
    await controller.yield(...)
    await controller.yield(...)
    await controller.return()
  })
})
```

You should always call controller.return if you want your iterable to finish eventually.

## Examples

Adapting a Node `EventEmitter` (or `Readable` stream) that emits `data`, `end`, and `error`:

```ts
import { EventEmitter } from "node:events"
import { createAsyncIterable } from "async-iterable"

function fromEvents<T>(emitter: EventEmitter) {
	return createAsyncIterable<T, void, void>(controller => {
		const onData = async (chunk: T) => {
			const res = await controller.yield(chunk)
			if (res.done) {
				// consumer stopped (break/return)
				teardown()
			}
		}

		const onEnd = async () => {
			teardown()
			await controller.return()
		}

		const onError = async (err: unknown) => {
			teardown()
			await controller.throw(err)
		}

		const teardown = () => {
			emitter.off("data", onData)
			emitter.off("end", onEnd)
			emitter.off("error", onError)
		}

		emitter.on("data", onData)
		emitter.once("end", onEnd)
		emitter.once("error", onError)
	})
}

// Usage
const ee = new EventEmitter()

queueMicrotask(() => {
	ee.emit("data", 1)
	ee.emit("data", 2)
	ee.emit("end")
})

for await (const x of fromEvents<number>(ee)) {
	console.log(x)
}
```

## API

```ts
createAsyncIterable<T = unknown, R = void, N = void>(
  callback: (controller: IteratorController<T, R, N>) => unknown,
): AsyncGenerator<Awaited<T>, Awaited<R>, N>
```

`controller` methods:

- `yield(value)`: Queue a value for the consumer. Resolves to `IteratorResult<N, undefined>`; `done:true` means the consumer is finished.
- `yieldIterable(iterable)`: Yield each value from another `Iterable`/`AsyncIterable` until done.
- `return(value)`: Finish the sequence with a return value.
- `throw(error)`: Error the sequence; the consumer will see the throw.

## License

ISC
