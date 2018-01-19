import { registerNewAddress } from '../services/address'

export const registerAddress = async (job) => {
	let err = null
	const { address, userId } = job.data
	const result = await registerNewAddress(address, userId).catch(e=>err=e)
	if (err) {
		console.error('registerAddress', err)
		return Promise.reject(err)
	}
	return Promise.resolve(result)
}