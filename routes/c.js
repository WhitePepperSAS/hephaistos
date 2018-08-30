const router = require('express').Router()
const debug = require('debug')('hephaistos:c-route') // eslint-disable-line no-unused-vars
const analyzers = [
  require('../analyzers/IndentAnalyzer.js'),
  require('../analyzers/AStyleAnalyzer.js'),
  require('../analyzers/CppcheckAnalyzer.js'),
  require('../analyzers/GccAnalyzer.js'),
  require('../analyzers/ClangAnalyzer.js'),
  require('../analyzers/VeraAnalyzer.js')
]

router.post('/analyze', async ({body: {content}}, res, next) => {
  try {
    content = Buffer.from(content, 'base64').toString()
    debug(`content:\n${content}`)

    const reports = await processFile(content)
    res.json(reports)
  } catch (err) {
    next(err)
  }
})

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

module.exports = router
