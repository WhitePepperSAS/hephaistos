const debug = require('debug')('hephaistos:CTestRunner')
const { promisify } = require('util')
const fs = require('fs')
const writeFile = promisify(fs.writeFile)
const readFile = promisify(fs.readFile)
const unlink = promisify(fs.unlink)
const path = require('path')
const { spawn } = require('child_process')
const XMLFileToJson = require('../../utils/junitParser.js')
const randomId = require('../../utils/randomId.js')

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
    // r is for relative path
    const rbinary = `${nbr}.bin`
    const rtestfile = `${nbr}_test.c`
    const rresultfile = `${nbr}.testresults`
    const rjunitfile = `${nbr}_results.xml`

    const binaryfile = path.join(process.env.HOME, rbinary)
    const testfile = path.join(process.env.HOME, rtestfile)
    const resultfile = path.join(process.env.HOME, rresultfile)
    const junitfile = path.join(process.env.HOME, rjunitfile)
    const unityC = path.join(process.env.HOME, 'unity.c')
    /* inutiles car déjà dans le dossier HOME et déjà lus par gcc, pas d'écriture
    const unityH = path.join(process.env.HOME, 'unity.h')
    const unityInternalsH = path.join(process.env.HOME, 'unity_internals.h')
    const unityConfigH = path.join(process.env.HOME, 'unity_config.h')
    */

    // on ajoute le contenu du test à la fin du fichier étudiant,
    // après avoir désactivé la fonction main
    // FIXME: on va virer ça à terme
    content = content
      .replace(/[ \t\n]main[^a-zA-Z]*\(/i, 'disabled_main(')
      // si on a besoin de faire référence au fichier lui-même (peu probable)
      .replace(/moduletotest/g, nbr)

    testcontent = `const char __TEST_FILE_PATH[] = "${rresultfile}";\n${testcontent}`

    content += `\n${testcontent}`

    let compilationFailed = true

    try {
      await Promise.all([
        writeFile(testfile, content),
        writeFile(resultfile, '')
      ])

      const compileParams = [
        timeout,
        'gcc',
        unityC,
        testfile,
        '-o',
        binaryfile
      ]

      const params = [
        timeout,
        '/usr/bin/firejail',
        '--force',
        '--profile=/app/langs/c/c.profile',

        '--read-only=~/',

        `--whitelist=~/${rbinary}`,
        `--whitelist=~/${rresultfile}`,

        `--read-only=~/${rbinary}`,
        `--read-write=~/${rresultfile}`,

        `${binaryfile}`
      ]
      debug('params', params)

      const compile = spawn('/usr/bin/timeout', compileParams, { cwd: process.env.HOME })
      const cOutput = await this.getOutput(compile, "compilation")
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
      compilationFailed = false

      const run = spawn('/usr/bin/timeout', params, { cwd: process.env.HOME })

      const { stdout, stderr, exitCode } = await this.getOutput(run, "run")
      debug('run.stdout: ', stdout)
      debug('run.stderr: ', stderr)

      if (exitCode !== 0) {
        const result = await readFile(resultfile, 'utf8')
        debug('result file', result)
      }

      const rubyParams = [
        path.join(process.env.HOME, 'stylize_as_junit.rb'),
        '-r', process.env.HOME,
        '-o', rjunitfile
      ]

      const runj = spawn('/usr/bin/ruby', rubyParams, { cwd: process.env.HOME })
      await this.getOutput(runj, "junit conversion")

      const result = await readFile(junitfile, 'utf8')
      try {
        const norm = await XMLFileToJson(this.replaceLabel(result, nbr))

        debug('result', JSON.stringify(norm, null, 2))

        return {
          result: norm,
          stdout: this.replaceLabel(stdout, nbr),
          stderr: this.replaceLabel(stderr, nbr)
        }
      } catch (err) {
        return {
          result: null,
          stdout: this.replaceLabel(stdout, nbr),
          stderr: this.replaceLabel(stderr, nbr)
        }
      }
    } finally {
      await Promise.all([
        unlink(testfile),
        compilationFailed || unlink(binaryfile),
        compilationFailed || unlink(resultfile),
        compilationFailed || unlink(junitfile)
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
   * @param {String} name
   */
  static async getOutput (child, name) {
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
}

module.exports = CTestRunner
