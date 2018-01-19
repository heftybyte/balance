import {
	getAllTokenBalances,
	getTokenBalance,
	getContractAddressBySymbol
} from '../lib/eth'
import { web3 } from '../lib/web3'
import { getAddressBalances } from '../services/address'
import influx from '../lib/influx'
import { escape, Precision } from 'influx';

const BlueBirdQueue = require('bluebird-queue');

const getBalanceBySymbolBlock = async (symbol, address, block) => {
	const contractAddress = getContractAddressBySymbol(symbol)
	const balance = await getTokenBalance(contractAddress, address, block.number)
	return Promise.resolve({
		time: block.time,
		balance,
		symbol
	})
}

const getBlocksForDays = async (days) => {
	const query = `
		select last(number) as number
		from blocks
		group by time(1d)
		order by time desc
		limit ${days}
	`
	return influx.query(query)
}

export const backfillBalances = async (job) => {
	let err = null
	const { address, days: d } = job.data
	const days = parseInt(d)
	if (days <= 0) {
		return Promise.reject(new Error('invalid number of days'))
	}

	const results = await Promise.all([
		getBlocksForDays(days),
		getAddressBalances(address)
	]).catch(e=>err=e)
	if (err || !results[0].length) {
		console.error('unable to get past blocks', job)
		return Promise.reject(err)
	}

	const rows = results[0]
	const symbols = Object.keys(results[1])
	const blocks = rows.filter(r=>r.number).map(r=>({number: r.number, time: r.time}))
	const queue = new BlueBirdQueue({ 
		concurrency: 4,
		delay: 100
	})
	let fetchedBalances = 0
	const totalBalances = symbols.length * blocks.length
	symbols.forEach((symbol)=>{
		blocks.forEach((block)=>{
			queue.add(
				getBalanceBySymbolBlock(symbol, address, block)
					.then(balance=>{
						job.progress((++fetchedBalances/totalBalances) * 100)
						console.log(`got balance for ${balance.symbol} at ${time}`)
						return Promise.resolve(balance)
					})
			)
		})
	})

	console.log('fetching blocks')
	const balances = await queue.start().catch(e=>err=e)

	if (err) {
		console.error('error backfilling address', address, err)
		return Promise.reject(err)
	}

	console.log('balances.len', balances.length, balances[0], balances[3])

	const points = balances.map(({symbol, balance, time})=>({
		measurement: 'balances',
		tags: { address, symbol },
		fields: { balance },
		timestamp: time
	}))
	await influx.writePoints(points, { precision: Precision.Seconds }).catch(e=>err=e)
	if (err) {
		console.error('error writing backfill to influx', address, err)
		return Promise.reject(err)
	}
	return Promise.resolve(points.length)
}