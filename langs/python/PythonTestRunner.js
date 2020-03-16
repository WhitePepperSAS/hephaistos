const debug = require('debug')('hephaistos:PythonTestRunner')
const { promisify } = require('util')
const fs = require('fs')
const writeFile = promisify(fs.writeFile)
const readFile = promisify(fs.readFile)
const readdir = promisify(fs.readdir)
const getOutput = require('../../utils/getOutput.js')
const mkdir = promisify(fs.mkdir)
const chmod = promisify(fs.chmod)
const path = require('path')
const { spawn } = require('child_process')
const XMLFileToJson = require('../../utils/junitParser.js')
const randomId = require('../../utils/randomId.js')
const rimraf = promisify(require('rimraf'))
const { HOME } = process.env

class PythonTestRunner {
  /**
   * La fonction test exécute le code python de manière sécurisée
   * On utilise docker et timeout afin de limiter au maximum les interactions que
   * le programme peut avoir avec le système
   * timeout limite à N secondes le temps d'éxecution du script
   *
   * ensuite on lance les tests unitaires avec python -m pytest <le fichier de test>
   *
   * Les tests et le code étudiant sont dans deux fichier séparés
   * Le fichier de tests doit faire référence au module étudiant
   * via le nom 'moduletotest', qui sera remplacé lors
   * de l'écriture du fichier
   *
   * à la fin, que le script réussisse ou échoue, on supprime les fichiers créés
   */
  static async test (content, testcontent, timeout = '5s') {
    if (!timeout.match(/^[0-9]{1,2}s$/)) {
      return {
        error: "Timeout is not in the right format"
      }
    }

    const nbr = randomId()
    // r is for relative path
    const rfile = `${nbr}.py`
    const rtestfile = `${nbr}_test.py`
    const rresultfile = `${nbr}_results.xml`
    const file = path.join(HOME, nbr, rfile)
    const testfile = path.join(HOME, nbr, rtestfile)
    const resultfile = path.join(HOME, nbr, rresultfile)
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

      console.log('folder:', testfolder)
      const files = await readdir(testfolder)
      for (const file of files) {
        console.log('file', file)
      }

      const params = [
        'run',
        '--rm',
        '--mount', `type=bind,source=${sourcetestfolder},destination=${testfolder}`,
        '--workdir', testfolder,
        '--network', 'none',
        '--name', `${nbr}`,
        '--entrypoint', '/usr/bin/timeout',
        'hephaistos',
        timeout,
        '/usr/bin/python3', '-m', 'pytest',
        '-p', 'no:cacheprovider', // don't write bytecode, to avoid unnecessary warnings
        '--junitxml', rresultfile,
        rtestfile
      ]
      debug('params', params)

      const child = spawn('/usr/bin/docker', params)

      const { stdout, stderr } = await getOutput(child, 'test')
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
}

/*
const params = [
  timeout,
  '/usr/bin/firejail',
  '--force',
  '--profile=/app/langs/python/python3.profile',

  '--read-only=~/',

  `--whitelist=~/${rfile}`,
  `--whitelist=~/${rtestfile}`,
  `--whitelist=~/${rresultfile}`,

  `--read-only=~/${rfile}`,
  `--read-only=~/${rtestfile}`,
  `--read-write=~/${rresultfile}`,

  '/usr/bin/python3',
  '-m',
  'pytest',
  '-p', 'no:cacheprovider', // don't write bytecode, to avoid unnecessary warnings
  '--junitxml',
  rresultfile,
  rtestfile
]*/

module.exports = PythonTestRunner
