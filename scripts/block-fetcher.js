const cluster = require('cluster')
const Web3 = require('web3')
const BlueBirdQueue = require('bluebird-queue');
import influx from '../lib/influx'
import { Precision } from 'influx'

const web3 = new Web3(new Web3.providers.HttpProvider("http://138.197.104.147:8545"))
const BATCH_SIZE = 1000
const TOTAL_BLOCKS = 5000000
const DAILY_BLOCKS = 6500
const TOTAL_BATCHES = Math.ceil(TOTAL_BLOCKS/BATCH_SIZE)

const toDays = (timestamp) => Math.ceil((((((timestamp) / 1000) / 60) / 60) / 24))
const measurement = 'blocks'
const zeroDay = (date) =>
	date.setHours(0) && date.setMinutes(0) && date.setSeconds(0) && date
const init = async () => {
	const today = zeroDay(new Date())
	const first = zeroDay(new Date('Jul-30-2015')) // first ethereum block date

	const days = toDays(today-first)
	const blockNumbers = Array.from({ length: days }).map((_, i)=>(i*(Math.random()*DAILY_BLOCKS))+1)
	console.log({days})
	let pendingBlocks = blockNumbers
	let remainingBlocks = pendingBlocks.length
	let points = []
	while (remainingBlocks) {
		const blocks = await fetchBlocks(pendingBlocks)
		let { filtered, misses } = filterBlocks(blocks, today, remainingBlocks)
		points = points.concat(filtered)
		remainingBlocks = misses.length
		pendingBlocks = adjustBlocks(misses)
	}
	// .map(block=>({
	// 	measurement,
	// 	tags: {},
	// 	fields: { number: block.number },
	// 	timestamp: block.timestamp
	// }))
	console.log(`# points: ${points.length}`)
	return points
}

const fetchBlocks = async (blockNumbers) => {
	const queue = new BlueBirdQueue({ concurrency: 10, interval: 100 })
	const queries = blockNumbers.map(blockNum=>web3.eth.getBlock(blockNum))
	queue.add(queries)
	console.log(`fetching ${blockNumbers.length} blocks`)
	const blocks = await queue.start()
	return blocks
}

const fs = require('fs')
const filterBlocks = (blocks, today, totalBlocks) => {
	const misses = []
	const filtered = blocks.filter((block, i)=>{
		if(!block) debugger
		const blockDay = zeroDay(new Date(block.timestamp * 1000))
		const days = toDays(today - blockDay)
		const delta = totalBlocks - days
		console.log(delta, i)
		const { number, timestamp } = block
		if ( delta !== i) {
			misses.push({ number, delta })
			return false;
		}
		return true
	})
	fs.writeFileSync(`misses-${totalBlocks}`, JSON.stringify(misses))
	return { filtered, misses }
}

const adjustBlocks = (misses) => {
	console.log(`adjusting ${misses.length} blocks`)
	return misses.map((miss, i)=>{
		let number
		if (miss.delta > 0) {
			number = miss.number - (DAILY_BLOCKS * (1 + (miss.delta/misses.length)))
		} else if (miss.delta <= 0) {
			number = miss.number + (DAILY_BLOCKS * (1 + (miss.delta/misses.length)))
		}
		return Math.max(1, Math.floor(number))
	})
}

init()

