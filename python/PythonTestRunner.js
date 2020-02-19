const debug = require('debug')('hephaistos:PythonTestRunner') // eslint-disable-line no-unused-vars
const { promisify } = require('util')
const fs = require('fs')
const writeFile = promisify(fs.writeFile)
const readFile = promisify(fs.readFile)
const unlink = promisify(fs.unlink)
const path = require('path')
const { spawn } = require('child_process')
const parser = new (require('xml2js')).Parser({attrkey: '__'})
const xmlParseString = promisify(parser.parseString)

function randomId () {
  /*
  const timestamp = (new Date().getTime() / 1000 | 0).toString(16)
  const obj = timestamp + 'xxxxxxxxxxxxxxxx'.replace(/[x]/g, () => (Math.random() * 16 | 0).toString(16).toLowerCase())
  return obj.replace(/[0-9]/g, 'z')
  */

  return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/[x]/g, () => String.fromCharCode(97 + Math.random() * 26))
}

class PythonTestRunner {
  /**
   * La fonction test exécute le code python de manière sécurisée
   * On utilise firejail et timeout afin de limiter au maximum les interactions que le programme
   * peut avoir avec le système
   *
   * timeout limite à N secondes le temps d'éxecution du script
   * firejail empêche (cf python/python3.profile):
   *  - les accès réseau
   *  - les accès fichier
   *  - whitelist des seuls fichiers auxquels l'utilisateur doit pouvoir accéder
   *  - l'option --force permet de lancer firejail malgré le fait qu'on soit dans un docker
   *
   *  ensuite on lance les tests unitaires avec python -m pytest <le fichier de test>
   *
   *  Les tests et le code étudiant sont dans deux fichier séparés
   *  Le fichier de tests doit faire référence au module étudiant via le nom 'moduletotest', qui sera remplacé lors
   *  de l'écriture du fichier
   *
   *  à la fin, que le script réussisse ou échoue, on supprime les fichiers créés
   */
  static async test (content, testcontent, timeout = '5s') {
    const nbr = randomId()
    const rfile = `${nbr}.py`
    const rtestfile = `${nbr}test.py`
    const rresultfile = `${nbr}results.xml`
    const file = path.join(process.env.HOME, rfile)
    const testfile = path.join(process.env.HOME, rtestfile)
    const resultfile = path.join(process.env.HOME, rresultfile)

    try {
      await Promise.all([
        writeFile(file, content),
        writeFile(testfile, testcontent.replace(/moduletotest/g, nbr)),
        writeFile(resultfile, '')
      ])

      const params = [
        timeout,
        '/usr/bin/firejail',
        '--force',
        `--profile=/app/python/python3.profile`,

        `--read-only=~/`,

        `--whitelist=~/${rfile}`,
        `--whitelist=~/${rtestfile}`,
        `--whitelist=~/${rresultfile}`,

        `--read-only=~/${rfile}`,
        `--read-only=~/${rtestfile}`,
        `--read-write=~/${rresultfile}`,

        '/usr/bin/python3',
        '-m',
        'pytest',
        '--junitxml',
        rresultfile,
        rtestfile
      ]
      debug('params', params)

      const child = spawn('/usr/bin/timeout', params, { cwd: process.env.HOME })

      let {stdout, stderr} = await this.getOutput(child)
      debug('stdout: ', stdout)
      debug('stderr: ', stderr)

      // TODO: trouver un moyen de conserver le fichier result.xml après le passage de la sandbox
      let result = await readFile(resultfile, 'utf8')

      return {
        result: await xmlParseString(this.replaceLabel(result, nbr)),
        stdout: this.replaceLabel(stdout, nbr),
        stderr: this.replaceLabel(stderr, nbr)
      }
    } catch (err) {
      throw err
    } finally {
      await Promise.all([
        unlink(file),
        unlink(testfile),
        unlink(resultfile)
      ])
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

    return {stdout: dataout, stderr: dataerr}
  }
}

module.exports = PythonTestRunner
