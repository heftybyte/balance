import { getTokenBalance, getContractAddressBySymbol } from '../lib/eth'
import { web3 } from '../lib/web3'
import influx from '../lib/influx'
import { escape, Precision } from 'influx';
import { backfillBalanceQueue } from '../lib/queue'
import { getAddressBalances } from '../services/address'

export const getTokenBalances = async (job) => {
	let err = null
	const { address } = job.data
	const latestBlock = await web3.eth.getBlock('latest').catch(e=>err=e)
	if (err) {
		console.error('unable to latest block', job)
		return Promise.reject(err)
	}
	console.log(`getting new balances for ${address} on block ${latestBlock.number}`)
	const currentBalances = await getAddressBalances(address).catch(e=>err=e)
	if (err) {
		console.log('unable to get current balances', err)
		return Promise.reject(err)
	}
	const queries = currentBalances.map(async ({symbol})=>{
		const contractAddress = getContractAddressBySymbol(symbol)
		const balance = await getTokenBalance(contractAddress, address).catch(e=>err=e)
		if (err) {
			console.error('unable to get balance for token:', symbol, job)
			throw err
		}
		return { symbol, balance }
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