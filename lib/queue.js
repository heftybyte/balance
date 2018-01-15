import {
	backfillBalances,
	getTokenBalances,
	scanAddress,
	registerAddress
} from '../jobs'
import uuidv4 from 'uuid/v4'

const Queue = require('bull')

export const newAddressQueue = new Queue('new_address', {
	redis: { 
		port: process.env.REDIS_PORT || 6379,
		host: process.env.REDIS_HOST || '127.0.0.1',
	}
})

export const scanQueue = new Queue('address_scanner', {
	redis: { 
		port: process.env.REDIS_PORT || 6379,
		host: process.env.REDIS_HOST || '127.0.0.1',
	}
})

export const balanceQueue = new Queue('balance_monitor', {
	redis: { 
		port: process.env.REDIS_PORT || 6379,
		host: process.env.REDIS_HOST || '127.0.0.1',
	}
})

export const backfillBalanceQueue = new Queue('backfill_balances', {
	limiter: {
		max: 2,
		duration: 1000 * 3600
	},
	redis: { 
		port: process.env.REDIS_PORT || 6379,
		host: process.env.REDIS_HOST || '127.0.0.1',
	}
})

newAddressQueue.process(registerAddress)
balanceQueue.process(getTokenBalances)
backfillBalanceQueue.process(2, backfillBalances)
scanQueue.process(scanAddress)

newAddressQueue.on('completed', (job, result)=>{
	console.log('address registration complete', job, result)
})

scanQueue.on('completed', (job, balances)=>{
	console.log('scan complete', balances)
})

balanceQueue.on('completed', (job, balances)=>{
	console.log('balance check complete', balances)
})

backfillBalanceQueue.on('completed', (job)=>{
	console.log('backfill complete', job.data)
})