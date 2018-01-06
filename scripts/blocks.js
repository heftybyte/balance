const cluster = require('cluster')
const Web3 = require('web3')
const BlueBirdQueue = require('bluebird-queue');
import influx from '../lib/influx'
import { Precision } from 'influx'

const web3 = new Web3(new Web3.providers.HttpProvider("http://138.197.104.147:8545"))
const BATCH_SIZE = 1000
const TOTAL_BLOCKS = 4850000
const TOTAL_BATCHES = Math.ceil(TOTAL_BLOCKS/BATCH_SIZE)

const numWorkers = process.argv[2] || 1

async function fetch(batch) {
	let block = ((batch-1) * BATCH_SIZE)
	const blockNumbers = (new Array(BATCH_SIZE).fill(0)).map(b=>block++)
	const queries = blockNumbers.map(n=>web3.eth.getBlock(n))
	const queue = new BlueBirdQueue({ concurrency: 10, interval: 100 })
	queue.add(queries)
	const results = await queue.start()
	const blocks = results.map(r=>({number: r.number, time: r.timestamp}))
	return blocks
}

async function start(firstBatch, lastBatch) {
	const measurement = 'blocks'
	let currentBatch = firstBatch
	let err
	while (currentBatch <= lastBatch) {
		const blocks = await fetch(currentBatch).catch(e=>err=e)
		if (err) {
			console.error('error', currentBatch, err)
			continue
		}
		const points = blocks.map(b=>({
			measurement,
			tags: {},
			fields: { number: b.number } ,
			timestamp: b.time
		}))
		await influx.writePoints(points, { precision: Precision.Seconds }).catch(e=>err=e)
		if (err) {
			console.error('error', currentBatch, err)
			continue
		}
		console.log(`processed batch ${currentBatch}/${lastBatch}`)
		currentBatch++
	}
}

if (cluster.isMaster) {
	console.log({numWorkers})
	const WORKER_BATCHES = Math.ceil(TOTAL_BATCHES / numWorkers)
	for (let i = 0; i < numWorkers; i++) {
		const firstBatch =( (i * WORKER_BATCHES) + 1)
		const lastBatch = (i + 1) * WORKER_BATCHES
		cluster.fork({firstBatch, lastBatch})
	}
	cluster.on('exit', (worker, code, signal) => {
		console.log(`worker ${worker.process.pid} died`)
	});
} else {
	const { firstBatch, lastBatch } = process.env
	start(firstBatch, lastBatch)
}
