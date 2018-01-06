const Influx = require('influx');
const influx = new Influx.InfluxDB({
  host: process.env.INFLUX_HOST || 'localhost',
  port: process.env.INFLUX_PORT || 8086,
  database: process.env.INFLUX_DB || 'balance',
  username: process.env.INFLUX_USERNAME || '',
  password: process.env.INFLUX_PASSWORD || '',
  protocol: process.env.INFLUX_PROTOCOL || 'http',
  schema: [
    {
      measurement: 'balance',
      fields: {
        balance: Influx.FieldType.FLOAT
      },
      tags: [
        'address',
        'symbol'
      ]
    },
    {
      measurement: 'blocks',
      fields: {
        number: Influx.FieldType.INTEGER
      },
      tags: []
    }
  ]
});

influx.getDatabaseNames()
  .then(names => {
    if (!names.includes('balance')) {
      return influx.createDatabase('balance');
    }
  })
  .catch(err => {
    console.error(`Error creating Influx database!`);
  })

influx.ping(5000).then(hosts => {
  hosts.forEach(host => {
    if (host.online) {
      console.log(`${host.url.host} responded in ${host.rtt}ms running ${host.version})`)
    } else {
      console.log(`${host.url.host} is offline :(`)
    }
  })
})

export default influx;