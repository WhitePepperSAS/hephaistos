const debug = require('debug')('hephaistos:app')
const http = require('http')
const express = require('express')
const logger = require('morgan')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')

const app = express()
app.use(logger('dev'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser())

const cRoute = require('./routes/c.js')
const pythonRoute = require('./routes/python.js')
const javascriptRoute = require('./routes/javascript.js')

app.use('/c', cRoute)
app.use('/python', pythonRoute)
app.use('/javascript', javascriptRoute)

app.use((err, req, res, next) => {
  debug('error', err)
  res.status(err.status || 500)
  res.json(err)
})

const port = process.env.PORT || 8080
app.set('port', port)

const server = http.createServer(app)

server.listen(port)
server.on('error', err => { throw err })
server.on('listening', () => { debug(`Listening on port ${server.address().port}.`) })
