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