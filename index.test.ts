import test from "node:test"
import assert from "node:assert/strict"
import { createAsyncIterable } from "./async-iterable.ts"

test("push should return after the value is yielded", async () => {
	const buffer: unknown[] = []

	const items = createAsyncIterable<number, string, void>(async controller => {
		buffer.push(["start"])

		for (const x of [4, 5, 6, 7]) {
			buffer.push(["yielding", x])
			const y = await controller.yield(x)
			buffer.push(["yielded", y])
			if (y.done) return
		}

		buffer.push(["closing", "x"])

		buffer.push(["closed", await controller.return("x")])
	})

	buffer.push(["begin"])

	for await (const x of (async function* () {
		yield yield* items
	})()) {
		buffer.push(["got", x])
	}

	buffer.push(["end"])

	assert.deepStrictEqual(buffer, [
		["begin"],
		["start"],
		["yielding", 4],
		["got", 4],
		["yielded", { done: false, value: undefined }],
		["yielding", 5],
		["got", 5],
		["yielded", { done: false, value: undefined }],
		["yielding", 6],
		["got", 6],
		["yielded", { done: false, value: undefined }],
		["yielding", 7],
		["got", 7],
		["yielded", { done: false, value: undefined }],
		["closing", "x"],
		["closed", { done: true, value: undefined }],
		["got", "x"],
		["end"],
	])
})

test("throwing an error", async () => {
	const buffer: unknown[] = []

	const items = createAsyncIterable<number, string, void>(async controller => {
		buffer.push(["start"])

		for (const x of [4, 5, 6, 7]) {
			buffer.push(["yielding", x])
			const y = await controller.yield(x)
			buffer.push(["yielded", y])
			if (y.done) return
		}

		buffer.push(["throwing", "x"])

		buffer.push(["thrown", await controller.throw(new Error("x"))])
	})

	buffer.push(["begin"])

	try {
		for await (const x of (async function* () {
			yield yield* items
		})()) {
			buffer.push(["got", x])
		}

		buffer.push(["end"])
	} catch (error) {
		buffer.push(["caught", (error as Error).constructor])
	}

	assert.deepStrictEqual(buffer, [
		["begin"],
		["start"],
		["yielding", 4],
		["got", 4],
		["yielded", { done: false, value: undefined }],
		["yielding", 5],
		["got", 5],
		["yielded", { done: false, value: undefined }],
		["yielding", 6],
		["got", 6],
		["yielded", { done: false, value: undefined }],
		["yielding", 7],
		["got", 7],
		["yielded", { done: false, value: undefined }],
		["throwing", "x"],
		["thrown", { done: true, value: undefined }],
		["caught", Error],
	])
})

test("breaking a loop", async () => {
	const buffer: unknown[] = []

	const items = createAsyncIterable<number, string, void>(async controller => {
		buffer.push(["start"])

		for (const x of [4, 5, 6, 7]) {
			buffer.push(["yielding", x])
			const y = await controller.yield(x)
			buffer.push(["yielded", y])
			if (y.done) return
		}

		buffer.push(["closing", "x"])

		buffer.push(["closed", await controller.return("x")])
	})

	buffer.push(["begin"])

	for await (const x of (async function* () {
		yield yield* items
	})()) {
		buffer.push(["got", x])
		break
	}

	buffer.push(["end"])

	assert.deepStrictEqual(buffer, [
		["begin"],
		["start"],
		["yielding", 4],
		["got", 4],
		["yielded", { done: true, value: undefined }],
		["end"],
	])
})

test("closing closed generator is a no-op", async () => {
	const buffer: unknown[] = []

	const items = createAsyncIterable<number, string, void>(async controller => {
		buffer.push(["start"])

		for (const x of [4, 5, 6, 7]) {
			buffer.push(["yielding", x])
			const y = await controller.yield(x)
			buffer.push(["yielded", y])
			if (y.done) break
		}

		buffer.push(["closing", "x"])

		buffer.push(["closed", await controller.return("x")])
	})

	buffer.push(["begin"])

	for await (const x of (async function* () {
		yield yield* items
	})()) {
		buffer.push(["got", x])
		break
	}

	buffer.push(["end"])

	assert.deepStrictEqual(buffer, [
		["begin"],
		["start"],
		["yielding", 4],
		["got", 4],
		["yielded", { done: true, value: undefined }],
		["closing", "x"],
		["closed", { done: true, value: undefined }],
		["end"],
	])
})

test("throwing to an already closed generator is a no-op", async () => {
	const buffer: unknown[] = []

	const items = createAsyncIterable<number, string, void>(async controller => {
		try {
			buffer.push(["start"])

			for (const x of [4, 5, 6, 7]) {
				buffer.push(["yielding", x])
				const y = await controller.yield(x)
				buffer.push(["yielded", y])
				if (y.done) {
					buffer.push(["throwing", "a"])
					const y = await controller.throw(new Error("a"))
					buffer.push(["thrown", "a", y])
				}
			}

			buffer.push(["closing", "x"])

			buffer.push(["closed", await controller.return("x")])
		} catch (error) {
			buffer.push(["error", (error as Error).constructor])
		}
	})

	buffer.push(["begin"])

	for await (const x of (async function* () {
		yield yield* items
	})()) {
		buffer.push(["got", x])
		break
	}

	buffer.push(["end"])

	assert.deepStrictEqual(buffer, [
		["begin"],
		["start"],
		["yielding", 4],
		["got", 4],
		["yielded", { done: true, value: undefined }],
		["throwing", "a"],
		["thrown", "a", { done: true, value: undefined }],
		["yielding", 5],
		["yielded", { done: true, value: undefined }],
		["throwing", "a"],
		["thrown", "a", { done: true, value: undefined }],
		["yielding", 6],
		["yielded", { done: true, value: undefined }],
		["throwing", "a"],
		["thrown", "a", { done: true, value: undefined }],
		["yielding", 7],
		["yielded", { done: true, value: undefined }],
		["throwing", "a"],
		["thrown", "a", { done: true, value: undefined }],
		["closing", "x"],
		["closed", { done: true, value: undefined }],
		["end"],
	])
})

test("yielding to an already closed generator is a no-op", async () => {
	const buffer: unknown[] = []

	const items = createAsyncIterable<number, string, void>(async controller => {
		try {
			buffer.push(["start"])

			for (const x of [4, 5, 6, 7]) {
				buffer.push(["yielding", x])
				const y = await controller.yield(x)
				buffer.push(["yielded", y])
			}

			buffer.push(["closing", "x"])

			buffer.push(["closed", await controller.return("x")])
		} catch (error) {
			buffer.push(["error", (error as Error).constructor])
		}
	})

	buffer.push(["begin"])

	for await (const x of (async function* () {
		yield yield* items
	})()) {
		buffer.push(["got", x])
		break
	}

	buffer.push(["end"])

	assert.deepStrictEqual(buffer, [
		["begin"],
		["start"],
		["yielding", 4],
		["got", 4],
		["yielded", { done: true, value: undefined }],
		["yielding", 5],
		["yielded", { done: true, value: undefined }],
		["yielding", 6],
		["yielded", { done: true, value: undefined }],
		["yielding", 7],
		["yielded", { done: true, value: undefined }],
		["closing", "x"],
		["closed", { done: true, value: undefined }],
		["end"],
	])
})

test("multiple simultaineos next is ok", async () => {
	const buffer: unknown[] = []

	const items = createAsyncIterable<number, string, void>(async controller => {
		buffer.push(["start"])

		for (const x of [4, 5, 6, 7]) {
			buffer.push(["yielding", x])
			const y = await controller.yield(x)
			buffer.push(["yielded", y])
			if (y.done) return
		}

		buffer.push(["closing", "x"])

		buffer.push(["closed", await controller.return("x")])
	})

	const it = items[Symbol.asyncIterator]()
	const ret = await Promise.all([
		it.next(),
		it.next(),
		it.next(),
		it.next(),
		it.next(),
		it.next(),
		it.next(),
		it.next(),
	])

	assert.deepStrictEqual(buffer, [
		["start"],
		["yielding", 4],
		["yielded", { done: false, value: undefined }],
		["yielding", 5],
		["yielded", { done: false, value: undefined }],
		["yielding", 6],
		["yielded", { done: false, value: undefined }],
		["yielding", 7],
		["yielded", { done: false, value: undefined }],
		["closing", "x"],
		["closed", { done: true, value: undefined }],
	])

	assert.deepStrictEqual(ret, [
		{ done: false, value: 4 },
		{ done: false, value: 5 },
		{ done: false, value: 6 },
		{ done: false, value: 7 },
		{ done: true, value: "x" },
		{ done: true, value: undefined },
		{ done: true, value: undefined },
		{ done: true, value: undefined },
	])
})

test("multiple simultianeos yields is ok", async () => {
	const buffer: unknown[] = []

	const items = createAsyncIterable<number, string, void>(async controller => {
		await Promise.all([4, 5, 6, 7].map(x => controller.yield(x)))
		await controller.return("x")
	})

	buffer.push(["begin"])

	for await (const x of (async function* () {
		yield yield* items
	})()) {
		buffer.push(["got", x])
	}

	buffer.push(["end"])

	assert.deepStrictEqual(buffer, [
		["begin"],
		["got", 4],
		["got", 5],
		["got", 6],
		["got", 7],
		["got", "x"],
		["end"],
	])
})

test("multiple simultianeos yields with break is ok", async () => {
	const buffer: unknown[] = []

	const items = createAsyncIterable<number, string, void>(async controller => {
		await Promise.all([4, 5, 6, 7].map(x => controller.yield(x)))
		await controller.return("x")
	})

	buffer.push(["begin"])

	for await (const x of (async function* () {
		yield yield* items
	})()) {
		buffer.push(["got", x])
		break
	}

	buffer.push(["end"])

	assert.deepStrictEqual(buffer, [["begin"], ["got", 4], ["end"]])
})

// TODO: throw error
