const debug = require('debug')('hephaistos:app')
const http = require('http')
const express = require('express')
const logger = require('morgan')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')

const analyzers = [
  require('./analyzers/IndentAnalyzer.js'),
  require('./analyzers/AStyleAnalyzer.js'),
  require('./analyzers/CppcheckAnalyzer.js'),
  require('./analyzers/GccAnalyzer.js'),
  require('./analyzers/ClangAnalyzer.js'),
  require('./analyzers/VeraAnalyzer.js')
]

async function processFile (filecontent) {
  const reports = []
  for (let i = 0; i < analyzers.length; i++) {
    reports.push.apply(reports, await analyzers[i].analyze(filecontent))
  }

  logReports(reports)

  return reports
}

function logReports (reports) {
  reports.forEach(report => debug(
    `(${report.source})`,
    report.category,
    'l', report.line,
    'c', report.col,
    'type', report.type,
    'message', report.message
  ))
}

const app = express()
app.use(logger('dev'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser())

app.post('/analyze', async ({body: {content}}, res, next) => {
  content = Buffer.from(content, 'base64').toString()
  debug(`content:\n${content}`)
  try {
    const reports = await processFile(content)
    res.json(reports)
  } catch (err) {
    next(err)
  }
})

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
server.on('listening', () => { debug(`Listening on port ${server.address().port}. --`) })

/*
if (process.argv[2] && process.argv[2].length) {
  const { readFileSync } = require('fs')
  const filecontent = readFileSync(process.argv[2], 'utf8')
  processFile(filecontent)
  .then(() => process.exit(0))
}
*/
