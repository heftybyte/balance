import { getTokenBalance, getContractAddressBySymbol } from '../lib/eth'
import { web3 } from '../lib/web3'
import influx from '../lib/influx'
import { escape, Precision } from 'influx';
import { backfillBalanceQueue } from '../lib/queue'

export const getTokenBalances = async (job) => {
	let err = null
	const { address } = job.data
	const latestBlock = await web3.eth.getBlock('latest').catch(e=>err=e)
	if (err) {
		console.error('unable to latest block', job)
		return Promise.reject(err)
	}
	console.log(`getting new balances for ${address} on block ${latestBlock.number}`)
	const query = `
		select * from balances
		where address = ${escape.stringLit(address)}
		group by symbol
		order by time desc
		limit 1
	`
	const rows = await influx.query(query).catch(e=>err=e)
	console.log('num tokens', rows.length, rows.map(r=>r.symbol))
	if (err) {
		console.log('unable to get address symbols', err)
		return Promise.reject(err)
	}
	const queries = rows.map(async ({symbol})=>{
		const contractAddress = getContractAddressBySymbol(symbol)
		const balance = await getTokenBalance(contractAddress, address).catch(e=>err=e)
		if (err) {
			console.error('unable to get balance for token:', symbol, job)
			return Promise.reject(err)
		}
		return Promise.resolve({
			symbol,
			balance
		})
	})
	const balances = await Promise.all(queries).catch(e=>err=e)
	if (err) {
		console.error('unable to get balances for address', job, err)
		return Promise.reject(err)
	}
	const points = balances.map(({symbol, balance})=>({
		measurement: 'balances',
		tags: { address, symbol },
		fields: { balance },
		timestamp: latestBlock.timestamp
	}))
	await influx.writePoints(points, { precision: Precision.Seconds })
	return Promise.resolve(balances)
}