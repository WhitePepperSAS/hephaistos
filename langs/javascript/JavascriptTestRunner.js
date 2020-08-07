const debug = require('debug')('hephaistos:JavascriptTestRunner')
const { promisify } = require('util')
const fs = require('fs')
const getOutput = require('../../utils/getOutput.js')
const writeFile = promisify(fs.writeFile)
const readFile = promisify(fs.readFile)
const mkdir = promisify(fs.mkdir)
const chmod = promisify(fs.chmod)
const path = require('path')
const { spawn } = require('child_process')
const XMLFileToJson = require('../../utils/junitParser.js')
const randomId = require('../../utils/randomId.js')
const rimraf = promisify(require('rimraf'))
const { HOME } = process.env

class JavascriptTestRunner {
  /**
   * La fonction test exécute le code javascript de manière sécurisée
   * On utilise docker et timeout afin de limiter au maximum les interactions que
   * le programme peut avoir avec le système
   * timeout limite à N secondes le temps d'éxecution du script
   *
   * ensuite on lance les tests unitaires avec mocha <le fichier de test>
   *
   * Les tests et le code étudiant sont dans deux fichier séparés
   * Le fichier de tests doit faire référence au module étudiant via le nom 'moduletotest',
   * qui sera remplacé lors de l'écriture du fichier
   *
   * à la fin, que le script réussisse ou échoue, on supprime les fichiers créés
   */
  static async test (content, testcontent, timeout = '5s') {
    if (!timeout.match(/^[0-9]{1,2}s$/)) {
      return {
        error: 'Timeout is not in the right format'
      }
    }

    const nbr = randomId()
    // r is for relative path
    const rfile = `${nbr}.js`
    const rtestfile = `${nbr}_test.js`
    const rresultfile = `${nbr}_results.xml`
    const file = path.join(process.env.HOME, nbr, rfile)
    const testfile = path.join(process.env.HOME, nbr, rtestfile)
    const resultfile = path.join(process.env.HOME, nbr, rresultfile)
    const sourcetestfolder = path.join(process.env.HEPHAISTOS_FOLDER, 'data', nbr)
    const testfolder = path.join(HOME, nbr)

    try {
      await mkdir(testfolder)
      await Promise.all([
        writeFile(file, content),
        writeFile(testfile, testcontent.replace(/moduletotest/g, nbr)),
        writeFile(resultfile, '')
      ])
      await Promise.all([
        chmod(file, '444'),
        chmod(testfile, '444'),
        chmod(resultfile, '777')
      ])

      const params = [
        'run',
        '--rm',
        '--env', 'NODE_PATH=/usr/local/lib/node_modules',
        '--mount', `type=bind,source=${sourcetestfolder},destination=${testfolder}`,
        '--workdir', testfolder,
        '--network', 'none',
        '--name', `${nbr}`,
        '--entrypoint', '/usr/bin/timeout',
        'hephaistos',
        timeout,
        '/usr/local/bin/mocha',
        '--exit', // do not hang if any listener is active
        '--reporter', 'mocha-junit-reporter', // junit format
        '--reporter-options', `mochaFile=${resultfile}`,
        rtestfile
      ]
      debug('params', params)

      const child = spawn('/usr/bin/docker', params)

      const { stdout, stderr } = await this.getOutput(child, 'test')
      debug('stdout: ', stdout)
      debug('stderr: ', stderr)

      const result = await readFile(resultfile, 'utf8')
      if (!result) {
        debug('result is empty, stopping')
        return {
          result: null,
          stdout: this.replaceLabel(stdout, nbr),
          stderr: this.replaceLabel(stderr, nbr).replace('\\n', '\n')
        }
      }

      console.log('result', result)

      const norm = await XMLFileToJson(this.replaceLabel(result, nbr))
      debug('result', JSON.stringify(norm, null, 2))

      return {
        result: norm,
        stdout: this.replaceLabel(stdout, nbr),
        stderr: this.replaceLabel(stderr, nbr).replace('\\n', '\n')
      }
    } finally {
      await rimraf(testfolder)
    }
  }

  static replaceLabel (str, val) {
    const endregex = new RegExp(`${val}([^a-zA-Z])`, 'g')
    const notendregex = new RegExp(`${val}([a-zA-Z])`, 'g')
    const replacement = 'studentcode'
    return str
      .replace(notendregex, `${replacement}-$1`)
      .replace(endregex, `${replacement}$1`)
  }

  /**
   * Tranforms the streams to exploitable string
   * @param {child_process} child
   */
  static async getOutput (child) {
    const bufsout = []
    const bufserr = []
    child.stdout.on('data', data => bufsout.push(data))
    child.stderr.on('data', data => bufserr.push(data))

    child.stdin.on('error', err => debug(err))

    await new Promise(resolve => child.stdout.on('end', resolve))

    let dataout = Buffer.concat(bufsout).toString('utf8')
    let dataerr = Buffer.concat(bufserr).toString('utf8')

    dataout = dataout.replace(/\x04[\n]?/, '') // eslint-disable-line no-control-regex
    dataerr = dataerr.replace(/\x04[\n]?/, '') // eslint-disable-line no-control-regex

    return { stdout: dataout, stderr: dataerr }
  }
}

module.exports = JavascriptTestRunner
