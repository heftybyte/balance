const Web3 = require('web3');
const WEB3_HTTP_PROVIDER = "https://mainnet.infura.io/XFvO1QzGbQlghhdzlts4";

export const web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider(WEB3_HTTP_PROVIDER))