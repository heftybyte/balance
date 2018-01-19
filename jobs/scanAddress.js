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
	// await balanceQueue.add({ address }, { jobId: uuidv4(), repeat: { cron: '*/1 * * * *' } }).catch(e=>err=e)
	// if (err) {
	// 	console.error(`unable to queue ${address} for monitoring`, err)
	// 	return Promise.reject(err)
	// }
	// console.log(`queued ${address} for balance monitoring`)
	await scanCompleteQueue.add({ address, numTokens: balances.length, userId }, { jobId: uuidv4() })
	// await backfillBalanceQueue.add({ address, days: 365 }, { jobId: uuidv4() })
	console.log(`queued ${address} for balance backfill`)
	return Promise.resolve(balances)
}