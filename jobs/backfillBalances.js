import {
	getAllTokenBalances,
	getTokenBalance,
	getContractAddressBySymbol
} from '../lib/eth'
import { web3 } from '../lib/web3'
import influx from '../lib/influx'
import { escape, Precision } from 'influx';

const BlueBirdQueue = require('bluebird-queue');

const getBalanceBySymbolBlock = async (symbol, address, block) => {
	const contractAddress = getContractAddressBySymbol(symbol)
	const balance = await getTokenBalance(contractAddress, address, /*block.number*/)
	return Promise.resolve({
		time: block.time,
		balance,
		symbol
	})
}

export const backfillBalances = async (job) => {
	let err = null
	const { address, symbols } = job.data
	const query = `
		select last(number) as number
		from blocks
		group by time(1d)
		order by time desc
		limit 365
	`
	const rows = await influx.query(query).catch(e=>err=e)
	if (err || !rows.length) {
		console.error('unable to get past blocks', job)
		return Promise.reject(err)
	}
	const blocks = rows.filter(r=>r.number).map(r=>({number: r.number, time: r.time}))
	const queue = new BlueBirdQueue({ 
		concurrency: 4,
		delay: 100
	})
	let fetchedBalances = 0
	symbols.forEach((symbol)=>{
		blocks.forEach((block)=>{
			queue.add(
				getBalanceBySymbolBlock(symbol, address, block)
					.then(balance=>{
						job.progress(++fetchedBalances)
						console.log(`got balance for ${balance.symbol} at ${time}`)
						return Promise.resolve(balance)
					})
			)
		})
	})

	console.log('fetching blocks')
	const results = await queue.start().catch(e=>err=e)

	if (err) {
		console.error('error backfilling address', address, err)
		return Promise.reject(err)
	}

	console.log('results.len', results.length, results[0], results[3])
	return 

	// -------------------------------

	const points = results.map(({symbol, balance, time})=>({
		measurement: 'balances',
		tags: { address, symbol },
		fields: { balance },
		timestamp: time
	}))
	await influx.writePoints(points, { precision: Precision.Seconds })
	return Promise.resolve()
}