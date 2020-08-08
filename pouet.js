const request = require('request')

request('http://93.12.77.117:8080/pouet/' + process.argv[2], () => {
  console.log('done')
})
