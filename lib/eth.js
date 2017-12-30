const abi = require('human-standard-token-abi');
const BlueBirdQueue = require('bluebird-queue');
const BigNumber = require('bignumber.js');

const Web3 = require('web3');
const web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider('http://138.197.104.147:8545'));

const TOKEN_CONTRACTS = require('../data/tokens');
const CONTRACT_ADDRESSES = require('../data/tokens-reversed');

const toDecimal = (num, decimals) => (
    (new BigNumber(num)).dividedBy(Math.pow(10, decimals)))

export const getContractAddressBySymbol = (symbol) => {
  const tokenMeta = TOKEN_CONTRACTS[symbol];
  return tokenMeta ? tokenMeta.address : null;
};

export const getETHBalance = async (address, cb) => {
  return web3.eth.getBalance(address).then((balance) =>
		Promise.resolve(toDecimal(balance, 18))
	).catch((err) => Promise.reject(err));
};

export const getTokenInfo = async (contractAddress, fields, meta) => {
  const contract = new web3.eth.Contract(abi, contractAddress);
  fields = fields || ['totalSupply', 'decimals', 'symbol'];

  const queries = fields.map((field) => {
    switch (field) {
      case 'balance':
        return contract.methods.balanceOf(meta.address).call();
      case 'symbol':
        return CONTRACT_ADDRESSES[contractAddress];
      case 'decimals':
        let symbol = CONTRACT_ADDRESSES[contractAddress];
        return symbol ? TOKEN_CONTRACTS[symbol].decimals : null;
      case 'supply':
        return contract.methods['totalSupply']().call();
      default:
        return contract.methods[field]().call();
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

export const getTokenBalance = async (contractAddress, address) => {
  let err;
  return getTokenInfo(
		contractAddress, ['decimals', 'balance', 'symbol', 'supply'],
    { address }
  ).then((info) => Promise.resolve(info ? info['formattedBalance'] : 0)).catch(e => err = e);
  if (err) {
    console.log('getTokenBalance error:', contractAddress, address);
  }
};

export const getAllTokenBalances = async (address, includeZeroBalances = true) => {
  const queue = new BlueBirdQueue({
    concurrency: 10,
  });
  const queries = Object.keys(TOKEN_CONTRACTS).map((symbol) => {
    return new Promise(async (resolve, reject) => {
      const balance = await getTokenBalance(getContractAddressBySymbol(symbol), address))

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
