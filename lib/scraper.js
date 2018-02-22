import {} from 'dotenv/config'
import preq from '../lib/proxy-request'
import { getTokenInfo } from '../lib/eth'

const BlueBirdQueue = require('bluebird-queue');
const cheerio = require('cheerio')
const queue = new BlueBirdQueue({
	concurrency: 2,
	delay: 100
});

// Get all tokens for address
export const scrapeAddress = async (address) => {
	const url = `https://etherscan.io/address/${address}`
	const response = await preq.get({ url })
	const $ = cheerio.load(response)
	const linksArray = Array.from($('#balancelist li a'))
	const tokenAddresses = linksArray.map((el)=>el.attribs.href.match(/0x[a-zA-Z0-9]{40}/)[0])
	const queries = tokenAddresses.map(address=>scrapeToken(address))
	queue.add(queries)
	const tokens = await queue.start()
	return tokens
}

// Get metadata for token
export const scrapeToken = async (address) => {
	const url = `https://etherscan.io/token/${address}`
	const response = await preq.get({ url })
	const $ = cheerio.load(response)
	const image = $('.breadcrumbs img').data('cfsrc')
	const linksArray = Array.from($('#ContentPlaceHolder1_tr_officialsite_2 ul li a'))
	const links = {}
	linksArray.forEach((el)=>{
		try {
			const data = el.attribs['data-original-title'].split(': ')
			links[data[0].toLowerCase()] = data[1]
		} catch (err) {
			console.log('error', el, data, err)
		}
	});
	const tokenInfo = await getTokenInfo(address, ['name', 'totalSupply', 'decimals', 'symbol'])
	return {
		...tokenInfo,
		...links,
		image
	}
}