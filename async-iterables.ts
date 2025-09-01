type IteratorController<T, R, N> = {
	yield(value: T | Promise<T>): Promise<IteratorResult<N, undefined>>
	yieldIterable(iterable: Iterable<T> | AsyncIterable<T>): Promise<IteratorResult<N, undefined>>
	throw(error: unknown): Promise<IteratorResult<N, undefined>>
	return(value: R | Promise<R>): Promise<IteratorResult<N, undefined>>
}

export async function* createAsyncIterable<T = unknown, R = void, N = void>(
	callback: (controller: IteratorController<T, R, N>) => unknown,
): AsyncGenerator<Awaited<T>, Awaited<R>, N> {
	const buffer = [createNextSlot<T, R, N>()]
	const status = { done: false }

	const controller = new AsyncIteratorController<T, R, N>(buffer, status)
	const callbackResult = callback(controller)

	let yielding = false
	try {
		while (true) {
			const slot = buffer[0] ?? never()
			const { value, done } = await slot.data.promise
			if (done) {
				return value
			}

			yielding = true
			const ret = yield value
			yielding = false

			slot.result.resolve({ done: false, value: ret })
			buffer.shift()
		}
	} catch (e) {
		status.done = true
		if (yielding) {
			const slot = buffer.shift() ?? never()
			slot.result.resolve(Promise.reject(e))
		}
		throw e
	} finally {
		status.done = true
		while (buffer.length > 0) {
			const slot = buffer.shift() ?? never()
			slot.result.resolve({ done: true, value: undefined })
		}
		await callbackResult
	}
}

class AsyncIteratorController<T, R = void, N = void> {
	constructor(buffer: Slot<T, R, N>[], status: { done: boolean }) {
		this.#buffer = buffer
		this.#status = status
	}

	#buffer: Slot<T, R, N>[]
	#status: { done: boolean }

	yield(value: T | Promise<T>): Promise<IteratorResult<N, undefined>> {
		if (!this.#status.done) {
			const ret = setLastData(
				this.#buffer,
				Promise.resolve(value).then(value => ({ done: false, value })),
			)
			this.#buffer.push(createNextSlot<T, R, N>())
			return ret
		}
		return Promise.resolve({ done: true, value: undefined as any })
	}

	async yieldIterable(iterable: Iterable<T> | AsyncIterable<T>) {
		for await (const value of iterable) {
			if (this.#status.done) {
				return { done: true, value: undefined as any }
			}

			const ret = await this.yield(value)
			if (ret.done) {
				return ret
			}
		}

		return { done: false, value: undefined as any }
	}

	throw(error: unknown) {
		if (!this.#status.done) {
			this.#status.done = true
			return setLastData(this.#buffer, Promise.reject(error))
		}
		return Promise.resolve({ done: true, value: undefined as any })
	}

	return(value: R | Promise<R>) {
		if (!this.#status.done) {
			this.#status.done = true
			return setLastData(
				this.#buffer,
				Promise.resolve(value).then(value => ({ done: true, value })),
			)
		}
		return Promise.resolve({ done: true, value: undefined as any })
	}
}

function createNextSlot<T, R, N>(): Slot<T, R, N> {
	const data = Promise.withResolvers<IteratorResult<Awaited<T>, Awaited<R>>>()
	const result = Promise.withResolvers<IteratorResult<N, undefined>>()

	data.promise.catch(noop)
	result.promise.catch(noop)

	return { data, result }
}

function setLastData<T, R, N>(
	buffer: Slot<T, R, N>[],
	data: Promise<IteratorResult<Awaited<T>, Awaited<R>>>,
) {
	const slot = buffer[buffer.length - 1] ?? never()
	slot.data.resolve(data)
	return slot.result.promise
}

function noop() {}

function never(error = new Error("assertion failed: the never function should never be called")): never {
	throw error
}

type Slot<T, R, N> = {
	data: PromiseWithResolvers<IteratorResult<Awaited<T>, Awaited<R>>>
	result: PromiseWithResolvers<IteratorResult<N, undefined>>
}
