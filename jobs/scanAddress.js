import { getAllTokenBalances } from '../lib/eth'
import { web3 } from '../lib/web3'
import influx from '../lib/influx'
import { escape, Precision } from 'influx';
import {
	backfillBalanceQueue,
	balanceQueue,
	scanCompleteQueue
} from '../lib/queue'
import uuidv4 from 'uuid/v4'

export const scanAddress = async (job) => {
	let err = null
	const { address, userId } = job.data
	const latestBlock = await web3.eth.getBlock('latest').catch(e=>err=e)
	if (err) {
		console.error('unable to latest block', job)
		return Promise.reject(err)
	}
	const balances = await getAllTokenBalances(address).catch(e=>err=e)
	if (err) {
		console.error('unable to get balances for address', job)
		return Promise.reject(err)
	}
	const points = balances.map(b=>({
		measurement: 'balances',
		tags: { address, symbol: b.symbol },
		fields: { balance: b.balance },
		timestamp: latestBlock.timestamp
	}))
	await influx.writePoints(points, { precision: Precision.Seconds })
	
	// queue next job, hack until chained jobs are implemented
	const now = new Date()
	const first = new Date('Jul-30-2015') // first ethereum block date
	const days = (((((now - first) / 1000) / 60) / 60) / 24)
	await scanCompleteQueue.add({ address, numTokens: balances.length, userId }, { jobId: uuidv4() })
	// await backfillBalanceQueue.add({ address, days }, { jobId: uuidv4() })
	console.log(`queued ${address} for ${days} day balance backfill`)
	return Promise.resolve(balances)
}