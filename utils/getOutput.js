const debug = require('debug')('hephaistos:GetOutput')

/**
 * Tranforms the streams to exploitable string
 * @param {child_process} child
 * @param {String} name
 */
async function getOutput (child, name) {
  const bufsout = []
  const bufserr = []
  let exitCode
  child.stdout.on('data', data => bufsout.push(data))
  child.stderr.on('data', data => bufserr.push(data))

  child.stdin.on('error', err => debug(err))

  await Promise.all([
    new Promise(resolve => child.stdout.on('end', resolve)),
    new Promise(resolve => child.on('exit', code => {
      exitCode = code
      debug(name, 'exit with code', code)
      resolve()
    }))
  ])

  let stdout = Buffer.concat(bufsout).toString('utf8')
  let stderr = Buffer.concat(bufserr).toString('utf8')

  stdout = stdout.replace(/\x04[\n]?/, '') // eslint-disable-line no-control-regex
  stderr = stderr.replace(/\x04[\n]?/, '') // eslint-disable-line no-control-regex

  return { stdout, stderr, exitCode }
}

module.exports = getOutput
