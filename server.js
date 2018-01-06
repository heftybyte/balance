import {} from 'dotenv/config'
import { getAllTokenBalances } from './lib/eth';
import { registerNewAddress } from './services/address';

const express = require('express');
const app = express();

app.post('/address/:address', async (req, res)=>{
	const { address } = req.params
	const result = await registerNewAddress(address.toLowerCase())
	res.sendStatus(result ? 200 : 400)
})

const PORT = process.env.PORT || 3004;
app.listen(PORT, ()=>{
	console.log(`listening on ${PORT}`);
})