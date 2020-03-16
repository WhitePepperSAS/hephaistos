const router = require('express').Router()
const debug = require('debug')('hephaistos:javascript-router') // eslint-disable-line no-unused-vars

const JavascriptTestRunner = require('../langs/javascript/JavascriptTestRunner.js')

router.post('/test', async ({ body: { content, test, timeout = '5s' } }, res, next) => {
  try {
    content = Buffer.from(content, 'base64').toString()
    test = Buffer.from(test, 'base64').toString()
    debug('content:\n', content)
    debug('test:\n', test)

    const output = await JavascriptTestRunner.test(content, test, timeout)

    debug('result', output.result)

    res.json(output)
  } catch (err) {
    next(err)
  }
})

module.exports = router
