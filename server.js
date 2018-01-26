import {} from 'dotenv/config'
import { web3 } from './lib/web3'
import { getAllTokenBalances } from './lib/eth';
import { getAddressBalances, registerNewAddress } from './services/address';

const express = require('express');
const app = express();

app.post('/address/:address', async (req, res)=>{
	const { address } = req.params
	const result = await registerNewAddress(address.toLowerCase())
	res.sendStatus(result ? 200 : 400)
})

app.get('/health', (req, res)=>{
    res.sendStatus(200)
})

app.get('/historical', async (req, res)=>{
	let err = null
	const { addresses: a } = req.query
	const addresses = a.split(',')
	const result = await getAddressBalances(addresses).catch(e=>err=e)
	if (err) {
		res.sendStatus(500)
		return
	}
	res.send(result)
})

app.get('/:address', async (req, res)=>{
	let err = null
	const { address } = req.params
	if (!web3.utils.isAddress(address)) {
		res.sendStatus(400)
		return
	}
	const result = await getAddressBalances(address.toLowerCase()).catch(e=>err=e)
	if (err) {
		res.sendStatus(500)
		return
	}
	res.send(result)
})

app.get('/', async (req, res)=>{
	let err = null
	const { addresses: a } = req.query
	if (!a) {
		res.sendStatus(404)
		return
	}
	const addresses = a.split(',')
	const result = await getAddressBalances(addresses).catch(e=>err=e)
	if (err) {
		res.sendStatus(500)
		return
	}
	res.send(result)
})


const PORT = process.env.PORT || 3004;
app.listen(PORT, ()=>{
	console.log(`listening on ${PORT}`);
})