import { scanQueue, balanceQueue, backfillBalanceQueue } from '../lib/queue'
import { web3 } from '../lib/web3'
import uuidv4 from 'uuid/v4'
import influx from '../lib/influx'
import { escape, Precision } from 'influx';

export const registerNewAddress = async (address) =>{
	if (!web3.utils.isAddress(address)) {
		console.error('can\'t register invalid address', address)
		return false
	}
	let err = null
	const query = `
		select * from balances
		where address = ${escape.stringLit(address)}
		limit 1
	`
	const rows = await influx.query(query).catch(e=>err=e)
	if (err) {
		console.error('registerNewAddress', address, err)
		return false
	}
	if (rows.length > 0) {
		console.error('registerNewAddress:: address already exist', address)
		return false
	}
	await scanQueue.add({ address }, { jobId: uuidv4() }).catch(e=>err=e)
	if (err) {
		console.error('registerNewAddress', address, err)
		return false
	}
	return true
}

export const monitorBalance = async (address, symbol) =>{
	let err = null
	await balanceQueue.add({
		address,
		symbol
	}).catch(e=>err=e)
	if (err) {
		console.error('balanceQueue', address, err)
		return false
	}
	return true
}

export const getAddressBalances = async (address) =>{
	let err = null
	const addresses = Array.isArray(address) ?
		address.map(a=>a.toLowerCase()) : [address.toLowerCase()]
	const query = `
		select * from balances
		where address =~ /^${addresses.join('$|^')}$/
		group by address, symbol
		order by time desc
		limit 1
	`
	console.log('getAddressBalances', query)
	const rows = await influx.query(query).catch(e=>err=e)
	console.log(rows.length)
	if (err) {
		throw err
	}
	const map = {}
	rows.forEach(token=>{
		if (!map[token.symbol]) {
			map[token.symbol] = 0
		}
		map[token.symbol] += token.balance
	})
	const balances = Object.keys(map).map(symbol=>({
		symbol,
		balance: map[symbol]
	}))
	// console.log('num tokens', rows.length, rows.map(r=>r.symbol))
	return balances
}
