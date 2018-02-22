const r = require('request-promise');

const username = process.env.PROXY_MESH_USER
const password = process.env.PROXY_MESH_PASSWORD
const proxyUrl = `http://${username}:${password}@us-wa.proxymesh.com:31280`

const options = {
	'proxy': proxyUrl
}

const proxyRequest = r.defaults(options)
export default proxyRequest;