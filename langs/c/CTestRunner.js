const debug = require('debug')('hephaistos:c-test-runner')
const { promisify } = require('util')
const fs = require('fs')
const writeFile = promisify(fs.writeFile)
const readFile = promisify(fs.readFile)
const unlink = promisify(fs.unlink)
const path = require('path')
const { spawn } = require('child_process')
/* const parser = new (require('xml2js')).Parser({attrkey: '__'})
const xmlParseString = promisify(parser.parseString) */

function randomId () {
  return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/[x]/g, () => String.fromCharCode(97 + Math.random() * 26))
}

class CTestRunner {
  /**
   * La fonction test exécute le code c de manière sécurisée
   * On utilise firejail et timeout afin de limiter au maximum les interactions que le programme
   * peut avoir avec le système
   *
   * timeout limite à N secondes le temps d'éxecution du script
   * firejail empêche (cf c/c.profile):
   *  - les accès réseau
   *  - les accès fichier
   *  - whitelist des seuls fichiers auxquels l'utilisateur doit pouvoir accéder
   *  - l'option --force permet de lancer firejail malgré le fait qu'on soit dans un docker
   *
   * Pour que le code soit bien testé, il faut:
   * - vérifier que le code compile déjà de base
   *   > Il faut donc utiliser des contraintes de compilation, qui doivent être passées en paramètres pour être flexible
   * - ajouter le header lié aux tests unitaires
   * - remplacer la fonction main() par notre propre fonction main() de tests
   * - balancer le resultat des tests dans un fichier de sortie plutôt que sur stdout pour éviter la pollution
   * - trouver un format de tests standard
   *
   * ensuite on lance les tests unitaires avec ./<nom du fichier>.bin
   * enfin récupérer les résultats et les parser
   *
   */
  static async test (content, testcontent, timeout = '5s') {
    const nbr = randomId()
    const rbinary = `${nbr}.bin`
    const rtestfile = `${nbr}_test.c`
    const rresultfile = `${nbr}_output.txt`

    const binaryfile = path.join(process.env.HOME, rbinary)
    const testfile = path.join(process.env.HOME, rtestfile)
    const resultfile = path.join(process.env.HOME, rresultfile)
    const unityC = path.join(process.env.HOME, 'unity.c')
    /* inutiles car déjà dans le dossier HOME et déjà lus par gcc, pas d'écriture
    const unityH = path.join(process.env.HOME, 'unity.h')
    const unityInternalsH = path.join(process.env.HOME, 'unity_internals.h')
    const unityConfigH = path.join(process.env.HOME, 'unity_config.h')
    */

    // on ajoute le contenu du test à la fin du fichier étudiant,
    // après avoir désactivé la fonction main
    content = content
      .replace(/[ \t\n]main[^a-zA-Z]*\(/i, 'disabled_main(')
      // si on a besoin de faire référence au fichier lui-même (peu probable)
      .replace(/moduletotest/g, nbr)

    testcontent = `const char __TEST_FILE_PATH[] = "${rresultfile}";\n${testcontent}`

    content += `\n${testcontent}`

    try {
      await Promise.all([
        writeFile(testfile, content),
        writeFile(resultfile, '')
      ])

      const compileParams = [
        timeout,
        `gcc`,
        unityC,
        testfile,
        `-o`,
        binaryfile
      ]

      const params = [
        timeout,
        '/usr/bin/firejail',
        '--force',
        `--profile=/app/c/c.profile`,

        `--whitelist=~/${rbinary}`,
        `--whitelist=~/${rresultfile}`,

        `--read-only=~/${rbinary}`,
        `--read-write=~/${rresultfile}`,

        `${binaryfile}`
      ]
      debug('params', params)

      const compile = spawn('/usr/bin/timeout', compileParams, { cwd: process.env.HOME })
      let cOutput = await this.getOutput(compile)
      debug('cOutput.stdout: ', cOutput.stdout)
      debug('cOutput.stderr: ', cOutput.stderr)

      if (cOutput.exitCode !== 0) {
        debug(`can't run the program because compilation failed (code=${cOutput.exitCode}).`)
        return {
          result: null,
          stdout: this.replaceLabel(cOutput.stdout, nbr),
          stderr: this.replaceLabel(cOutput.stderr, nbr)
        }
      }

      const run = spawn('/usr/bin/timeout', params, { cwd: process.env.HOME })

      let { stdout, stderr } = await this.getOutput(run)
      debug('run.stdout: ', stdout)
      debug('run.stderr: ', stderr)

      const result = (await readFile(resultfile, 'utf8')).split('\n')
      debug('result', result)

      const parsedResult = []

      // maintenant il n'y a plus qu'à parser le résultat
      const resultFormat = new RegExp(`^${testfile}:([0-9]+):([^:]+):(PASS|FAIL)(?:: (.*))?$`, 'i')

      for (let i = 0; i < result.length; i++) {
        const format = result[i].match(resultFormat)
        debug('format', format, result[i])
        if (format) {
          const [fullResult, line, testFunction, success, message] = format
          parsedResult.push({
            source: 'Unity',
            file: rtestfile.replace(testfile, 'tests.c'),
            line: parseInt(line),
            test: testFunction,
            success: success === 'PASS',
            message,
            result: fullResult.replace(testfile, 'tests.c')
          })
        }
      }

      debug(parsedResult)

      return {
        result: parsedResult,
        stdout: this.replaceLabel(stdout, nbr),
        stderr: this.replaceLabel(stderr, nbr)
      }
    } catch (err) {
      throw err
    } finally {
      await Promise.all([
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
    let exitCode
    child.stdout.on('data', data => bufsout.push(data))
    child.stderr.on('data', data => bufserr.push(data))

    child.stdin.on('error', err => debug(err))

    await Promise.all([
      new Promise(resolve => child.stdout.on('end', resolve)),
      new Promise(resolve => child.on('exit', code => {
        exitCode = code
        debug('exit with code', code)
        resolve()
      }))
    ])

    let stdout = Buffer.concat(bufsout).toString('utf8')
    let stderr = Buffer.concat(bufserr).toString('utf8')

    stdout = stdout.replace(/\x04[\n]?/, '') // eslint-disable-line no-control-regex
    stderr = stderr.replace(/\x04[\n]?/, '') // eslint-disable-line no-control-regex

    return { stdout, stderr, exitCode }
  }
}

module.exports = CTestRunner