import { web3 } from './web3'

const abi = require('human-standard-token-abi');
const BlueBirdQueue = require('bluebird-queue');
const BigNumber = require('bignumber.js');
const TOKEN_CONTRACTS = require('../data/tokens');
const CONTRACT_ADDRESSES = require('../data/tokens-reversed');

const toDecimal = (num, decimals) => (
    (new BigNumber(num)).dividedBy(Math.pow(10, decimals)))

export const getContractAddressBySymbol = (symbol) => {
  const tokenMeta = TOKEN_CONTRACTS[symbol];
  return tokenMeta ? tokenMeta.address : null;
};

export const getETHBalance = async (address, blockNumber, cb) => {
  return web3.eth.getBalance(address, blockNumber).then((balance) =>
		Promise.resolve(toDecimal(balance, 18))
	).catch((err) => Promise.reject(err));
};

export const getTokenInfo = async (contractAddress, fields, blockNumber, meta={}) => {
  const contract = new web3.eth.Contract(abi, contractAddress);
  fields = fields || ['totalSupply', 'decimals', 'symbol'];

  const queries = fields.map((field) => {
    switch (field) {
      case 'balance':
        return contract.methods.balanceOf(meta.address).call(blockNumber);
      case 'symbol':
        return CONTRACT_ADDRESSES[contractAddress];
      case 'decimals':
        let symbol = CONTRACT_ADDRESSES[contractAddress];
        return symbol ? TOKEN_CONTRACTS[symbol].decimals : null;
      case 'supply':
        return contract.methods['totalSupply']().call(blockNumber);
      default:
        return contract.methods[field]().call(blockNumber);
    }
  });

  const info = {};

  return Promise.all(queries).then((res) => {
    res.forEach((value, i) => {
      info[fields[i]] = value;
    });
    const {
		balance,
		decimals
	} = info;

    if (balance && decimals) {
      info['formattedBalance'] = toDecimal(balance, decimals).toString(10);
    }
    return Promise.resolve(info);
  }).catch((e) => {
    console.log('getTokenInfo Error: contractAddress', contractAddress, e);
  });
};

export const getTokenBalance = async (contractAddress, address, blockNumber) => {
  let err;
  return getTokenInfo(
		contractAddress,
		['decimals', 'balance', 'symbol', 'supply'],
		blockNumber,
    { address }
  ).then((info) => Promise.resolve(info ? Number(info['formattedBalance']) : 0)).catch(e => err = e);
  if (err) {
    console.log('getTokenBalance error:', contractAddress, address);
    return Promise.resolve(null)
  }
};

export const getAllTokenBalances = async (address, blockNumber, includeZeroBalances = false) => {
  const queue = new BlueBirdQueue({
    concurrency: 4,
    delay: 100
  });
  const queries = Object.keys(TOKEN_CONTRACTS).map((symbol) => {
    return new Promise(async (resolve, reject) => {
    	const contractAddress = getContractAddressBySymbol(symbol)
      const balance = Number(await getTokenBalance(contractAddress, address, blockNumber))

      if (Number.isNaN(balance) || (!balance && !includeZeroBalances)) {
        return resolve();
      }
      resolve({
      	symbol,
        balance: balance > 1 ? Number(balance.toFixed(2)) : Number(balance),
      });
    });
  });
  queue.add(queries);
  return queue.start().then((balances) => {
    return Promise.resolve(balances.filter((balance) => balance));
  });
};

export const getTokensBySymbol = async (symbols) => {
  let filteredTokens = symbols.map(symbol => TOKEN_CONTRACTS[symbol])
  return Promise.resolve(filteredTokens);
};
