const debug = require('debug')('hephaistos:CTestRunner')
const { promisify } = require('util')
const fs = require('fs')
const writeFile = promisify(fs.writeFile)
const readFile = promisify(fs.readFile)
const mkdir = promisify(fs.mkdir)
const chmod = promisify(fs.chmod)
const copyFile = promisify(fs.copyFile)
const getOutput = require('../../utils/getOutput.js')
const path = require('path')
const { spawn } = require('child_process')
const XMLFileToJson = require('../../utils/junitParser.js')
const randomId = require('../../utils/randomId.js')
const rimraf = promisify(require('rimraf'))
const { HOME } = process.env
const scriptsFolder = '/scripts'
const runityC = 'unity.c'
const runityH = 'unity.h'
const runityInternalsH = 'unity_internals.h'
const runityConfigH = 'unity_config.h'
const unityC = path.join(scriptsFolder, runityC)
const unityH = path.join(scriptsFolder, runityH)
const unityInternalsH = path.join(scriptsFolder, runityInternalsH)
const unityConfigH = path.join(scriptsFolder, runityConfigH)
const dataFolder = path.join(process.env.HEPHAISTOS_FOLDER, 'data')

class CTestRunner {
  /**
   * La fonction test exécute le code c de manière sécurisée
   * On utilise docker et timeout afin de limiter au maximum les interactions
   * que le programme peut avoir avec le système
   * timeout limite à N secondes le temps d'éxecution du script
   *
   * Pour que le code soit bien testé, il faut:
   * - vérifier que le code compile déjà de base
   *   > Il faut donc utiliser des contraintes de compilation, qui doivent être
   *     passées en paramètres pour être flexible
   * - ajouter le header lié aux tests unitaires
   * - remplacer la fonction main() par notre propre fonction main() de tests
   * - balancer le resultat des tests dans un fichier de sortie plutôt que
   *   sur stdout pour éviter la pollution
   * - trouver un format de tests standard
   *
   * ensuite on lance les tests unitaires avec ./<nom du fichier>.bin
   * enfin récupérer les résultats et les parser
   */
  static async test (content, testcontent, timeout = '5s') {
    if (!timeout.match(/^[0-9]{1,2}s$/)) {
      return {
        error: 'Timeout is not in the right format'
      }
    }

    const nbr = randomId()
    // r is for relative path
    const rbinaryfile = `${nbr}.bin`
    const rtestfile = `${nbr}_test.c`
    const rresultfile = `${nbr}.testresults`
    const rjunitfile = `${nbr}_results.xml`

    const sourcetestfolder = path.join(dataFolder, nbr)
    const testfolder = path.join(HOME, nbr)
    const binaryfile = path.join(HOME, nbr, rbinaryfile)
    const testfile = path.join(HOME, nbr, rtestfile)
    const resultfile = path.join(HOME, nbr, rresultfile)
    const junitfile = path.join(HOME, nbr, rjunitfile)

    // on ajoute le contenu du test à la fin du fichier étudiant,
    // après avoir désactivé la fonction main
    // FIXME: on va virer ça à terme
    content = content
      .replace(/[ \t\n]main[^a-zA-Z]*\(/i, 'disabled_main(')
      // si on a besoin de faire référence au fichier lui-même (peu probable)
      .replace(/moduletotest/g, nbr)

    testcontent = `const char __TEST_FILE_PATH[] = "${rresultfile}";\n${testcontent}`

    content += `\n${testcontent}`

    try {
      await mkdir(testfolder)
      await Promise.all([
        writeFile(testfile, content),
        writeFile(resultfile, ''),
        copyFile(unityC, path.join(testfolder, runityC)),
        copyFile(unityH, path.join(testfolder, runityH)),
        copyFile(unityInternalsH, path.join(testfolder, runityInternalsH)),
        copyFile(unityConfigH, path.join(testfolder, runityConfigH))
      ])
      await Promise.all([
        chmod(testfile, '444'),
        chmod(path.join(testfolder, runityC), '444'),
        chmod(path.join(testfolder, runityH), '444'),
        chmod(path.join(testfolder, runityInternalsH), '444'),
        chmod(path.join(testfolder, runityConfigH), '444'),
        chmod(resultfile, '777')
      ])

      // FIXME: we should probably put that into docker too
      const compileParams = [
        timeout,
        'gcc-9', '-fdiagnostics-format=json', runityC, rtestfile,
        '-o', rbinaryfile
      ]
      debug('compileParams', compileParams)

      const compile = spawn('/usr/bin/timeout', compileParams, {
        cwd: testfolder,
        env: {
          ...process.env,
          LC_MESSAGES: 'fr_FR.utf8',
          LC_ALL: 'fr_FR.utf8',
          LANG: 'fr_FR.utf8'
        }
      })
      const cOutput = await getOutput(compile, 'compilation')
      debug('compilation stdout: ', cOutput.stdout)
      debug('compilation stderr: ', cOutput.stderr)

      if (cOutput.exitCode !== 0) {
        debug(`can't run the program because compilation failed (code=${cOutput.exitCode}).`)
        const err = this.replaceLabel(cOutput.stderr, nbr)
        return {
          result: null,
          error: 'compilation',
          stdout: this.replaceLabel(cOutput.stdout, nbr),
          stderr: err,
          compil: JSON.parse(err.slice(2))
        }
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
        binaryfile
      ]
      debug('params', params)

      const run = spawn('/usr/bin/docker', params, { cwd: process.env.HOME })

      const { stdout, stderr, exitCode } = await getOutput(run, 'run')
      debug('run.stdout: ', stdout)
      debug('run.stderr: ', stderr)
      debug('run.exitCode: ', exitCode)

      if (exitCode !== 0) {
        const result = await readFile(resultfile, 'utf8')
        debug('result file\n', result)
      }

      if (exitCode === 124) {
        debug('Timeout')
        return {
          result: null,
          error: 'timeout',
          stdout: this.replaceLabel(stdout, nbr),
          stderr: this.replaceLabel(stderr, nbr),
          compil: null
        }
      }

      if (exitCode === 139) {
        debug('Segmentation fault')
        return {
          result: null,
          error: 'segfault',
          stdout: this.replaceLabel(stdout, nbr),
          stderr: this.replaceLabel(stderr, nbr),
          compil: null
        }
      }

      const rubyParams = [
        path.join(scriptsFolder, 'stylize_as_junit.rb'),
        '-r', testfolder,
        '-o', rjunitfile
      ]

      const runj = spawn('/usr/bin/ruby', rubyParams, { cwd: testfolder })
      const junitOutput = await getOutput(runj, 'junit conversion')

      try {
        const result = await readFile(junitfile, 'utf8')
        const norm = await XMLFileToJson(this.replaceLabel(result, nbr))

        debug('result', JSON.stringify(norm, null, 2))

        return {
          result: norm,
          stdout: this.replaceLabel(stdout, nbr),
          stderr: this.replaceLabel(stderr, nbr),
          compil: null
        }
      } catch (err) {
        debug('junit output error', junitOutput.stderr)
        debug('junit output', junitOutput.stdout)
        return {
          result: null,
          error: 'junit',
          stdout: this.replaceLabel(stdout, nbr),
          stderr: this.replaceLabel(stderr, nbr),
          compil: null
        }
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

module.exports = CTestRunner
