const Influx = require('influx');
const influx = new Influx.InfluxDB({
  host: process.env.INFLUX_HOST || 'localhost',
  port: process.env.INFLUX_PORT || 8086,
  database: process.env.INFLUX_DB || 'balance_development',
  username: process.env.INFLUX_USERNAME || '',
  password: process.env.INFLUX_PASSWORD || '',
  schema: [
    {
      measurement: 'balance',
      fields: {
        userId: Influx.FieldType.INTEGER,
        balance: Influx.FieldType.FLOAT,
        symbol: Influx.FieldType.STRING
      },
      tags: [
        'userId',
        'symbol'
      ]
    }
  ]
});

export default influx;