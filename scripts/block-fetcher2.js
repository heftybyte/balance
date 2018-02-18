const http = require('http')
http.globalAgent = new http.Agent({ keepAlive: true })

const cluster = require('cluster')
const Web3 = require('web3')
const BlueBirdQueue = require('bluebird-queue');
const Queue = require('bull')
import influx from '../lib/influx'
import { Precision } from 'influx'


const web3 = new Web3(new Web3.providers.HttpProvider("http://138.197.104.147:8545"))
const BATCH_SIZE = 1000
const TOTAL_BLOCKS = 5000000
const DAILY_BLOCKS = 5500
const TOTAL_BATCHES = Math.ceil(TOTAL_BLOCKS/BATCH_SIZE)
const DAY_MILLISECONDS = 60 * 60 * 24 * 1000

const redis = { 
	port: process.env.REDIS_PORT || 6379,
	host: process.env.REDIS_HOST || '127.0.0.1',
	password: process.env.REDIS_PASSWORD
}

// const blockQueue = new Queue('block', { redis })


const toDays = (timestamp) => Math.ceil((((((timestamp) / 1000) / 60) / 60) / 24))
const measurement = 'blocks'
const zeroDay = (date) =>
	date.setHours(0) && date.setMinutes(0) && date.setSeconds(0) && date
let totalFound = 0
let DAY_BLOCKS
const init = async () => {
	const today = zeroDay(new Date())
	const first = zeroDay(new Date('Jul-30-2015')) // first ethereum block date
	const days = toDays(today-first)
	const blockDays = Array.from({ length: days }).map((_, i)=>+first+(i * DAY_MILLISECONDS))
	DAY_BLOCKS = days 
	let err = null
	const queue = new BlueBirdQueue({ concurrency: 100, interval: 100, delay: 500 })
	queue.add(blockDays.map((blockDay, i)=>findBlockByDay(blockDay, (i + 1) )))
	const blocks = await queue.start().catch(e=>err=e)

	if (err) {
		console.error('error fetching blocks', err)
		return
	}

	console.log(blocks)

	// .map(block=>({
	// 	measurement,
	// 	tags: {},
	// 	fields: { number: block.number },
	// 	timestamp: block.timestamp
	// }))
	// console.log(`# points: ${points.length}`)
	// return points
}

const findBlockByDay = async (dayTs, dayNum) => {
	let startBlockNum = 0
	let endBlockNum = dayNum * DAILY_BLOCKS
	let blockNum
	let blockDayTs
	let attempts = 0
	let err
	while (startBlockNum < endBlockNum) {
		attempts++
		blockNum = Math.floor((endBlockNum + startBlockNum) / 2)
		const block = await web3.eth.getBlock(blockNum).catch(e=>err=e)
		if (err || !block) {
			console.log(`error fetching block: ${blockNum}`, err)
			continue
		}
		blockDayTs = +zeroDay(new Date(block.timestamp * 1000))
		if (blockDayTs === dayTs) {
			console.log(`attempts: ${attempts} | blockNum: ${blockNum}`)
			console.log(`TOTAL BLOCKS FOUND: ${++totalFound} of ${DAY_BLOCKS}`)
			return blockNum
		} else if (blockDayTs < dayTs) {
			startBlockNum = blockNum
		} else {
			endBlockNum = blockNum
		}
	}
	console.log(`attempts: ${attempts} | dayTs: ${dayTs}`)
	return -1
}

init()

