const router = require('express').Router()
const debug = require('debug')('hephaistos:c-route') // eslint-disable-line no-unused-vars
const CTestRunner = require('../langs/c/CTestRunner.js')
const analyzers = [
  require('../langs/c/analyzers/IndentAnalyzer.js'),
  require('../langs/c/analyzers/AStyleAnalyzer.js'),
  require('../langs/c/analyzers/CppcheckAnalyzer.js'),
  require('../langs/c/analyzers/GccAnalyzer.js'),
  require('../langs/c/analyzers/ClangAnalyzer.js'),
  require('../langs/c/analyzers/VeraAnalyzer.js')
]

router.post('/analyze', async ({ body: { content } }, res, next) => {
  try {
    content = Buffer.from(content, 'base64').toString()
    debug('content:\n', content)

    const reports = await processFile(content)
    res.json(reports)
  } catch (err) {
    debug('error', err)
    next(err)
  }
})

router.post('/test', async ({ body: { content, test, timeout = '5s', ...body } }, res, next) => {
  try {
    content = Buffer.from(content, 'base64').toString()
    test = Buffer.from(test, 'base64').toString()
    debug('content:\n', content)
    debug('test:\n', test)
    const options = body.options || { valgrind: false }
    options.timeout = timeout
    options.useValgrind = options.valgrind
    debug('options', options, body.options)

    const output = await CTestRunner.test(content, test, options)

    debug('result', output.result)

    res.json(output)
  } catch (err) {
    debug('error', err)
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
