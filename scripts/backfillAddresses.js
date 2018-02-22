import {} from 'dotenv/config'
import { registerNewAddress } from '../services/address';

const addresses = require('../data/addresses')
addresses.forEach((a)=>registerNewAddress(a))
console.log(addresses.length, ' backfilled')