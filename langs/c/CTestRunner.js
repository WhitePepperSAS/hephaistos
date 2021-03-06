const debug = require('debug')('hephaistos:CTestRunner')
const { promisify } = require('util')
const fs = require('fs')
const writeFile = promisify(fs.writeFile)
const readFile = promisify(fs.readFile)
const mkdir = promisify(fs.mkdir)
const chmod = promisify(fs.chmod)
const copyFile = promisify(fs.copyFile)
const unlink = promisify(fs.unlink)
const getOutput = require('../../utils/getOutput.js')
const path = require('path')
const { spawn } = require('child_process')
const JUnitXMLFileToJson = require('../../utils/junitParser.js')
const ValgrindXMLFileToJson = require('../../utils/valgrindParser.js')
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
  static async test (content, testcontent, { timeout = '5s', useValgrind = false }) {
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
    const rvalgrindfile = `${nbr}_valgrind.xml`

    const sourcetestfolder = path.join(dataFolder, nbr)
    const testfolder = path.join(HOME, nbr)
    const binaryfile = path.join(HOME, nbr, rbinaryfile)
    const testfile = path.join(HOME, nbr, rtestfile)
    const resultfile = path.join(HOME, nbr, rresultfile)
    const junitfile = path.join(HOME, nbr, rjunitfile)
    const valgrindfile = path.join(HOME, nbr, rvalgrindfile)

    // on ajoute le contenu du test à la fin du fichier étudiant,
    // après avoir désactivé la fonction main
    // FIXME: on va virer ça à terme
    content = content
      .replace(/[ \t\n]main[^a-zA-Z]*\(/i, 'disabled_main(')
      // si on a besoin de faire référence au fichier lui-même (peu probable)
      .replace(/moduletotest/g, nbr)

    const contentLength = content.split('\n').length

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
        'gcc-9', '-ggdb', '-fdiagnostics-format=json',
        runityC, rtestfile, '-lm',
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
        let parsed = ''
        try {
          const treatedOutput = err.split('\n')[1]
          parsed = JSON.parse(treatedOutput)
        } catch (err) {
          parsed = []
        }
        return {
          result: null,
          error: 'compilation',
          stdout: this.replaceLabel(cOutput.stdout, nbr),
          stderr: err,
          compil: parsed
        }
      }

      const valgrindOpts = useValgrind ? [
        '/usr/bin/valgrind',
        '--quiet',
        '--leak-check=full',
        '--xml=yes',
        `--xml-file=${valgrindfile}`
      ] : []

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
        ...valgrindOpts,
        binaryfile
      ]
      debug('params', params)

      // delete source code files before run to avoid helping listing files
      await Promise.all([
        unlink(testfile),
        unlink(path.join(testfolder, runityC)),
        unlink(path.join(testfolder, runityH)),
        unlink(path.join(testfolder, runityInternalsH)),
        unlink(path.join(testfolder, runityConfigH)),
        chmod(path.join(testfolder, rresultfile), '222'),
        chmod(path.join(testfolder, rbinaryfile), '777')
      ])

      debug('unlink source files')

      const run = spawn('/usr/bin/docker', params, { cwd: process.env.HOME })

      const { stdout, stderr, exitCode } = await getOutput(run, 'run')
      debug('run.stdout: ', stdout)
      debug('run.stderr: ', stderr)
      debug('run.exitCode: ', exitCode)

      const rubyParams = [
        path.join(scriptsFolder, 'stylize_as_junit.rb'),
        '-r', testfolder,
        '-o', rjunitfile
      ]

      await chmod(testfolder, '777')
      await chmod(path.join(testfolder, rresultfile), '444')

      const runj = spawn('/usr/bin/ruby', rubyParams, { cwd: testfolder })
      const junitOutput = await getOutput(runj, 'junit conversion')

      let result = null

      try {
        const result_ = await readFile(junitfile, 'utf8')
        debug('result_', result)
        result = await JUnitXMLFileToJson(this.replaceLabel(result_, nbr))

        debug('result', JSON.stringify(result, null, 2))
      } catch (err) {
        result = null
      }

      if (useValgrind) {
        try {
          let valgrind = await readFile(valgrindfile, 'utf8')
          valgrind = await ValgrindXMLFileToJson(this.replaceLabel(valgrind, nbr), contentLength)
          debug('contentLength', contentLength)
          debug('valgrind parsed', JSON.stringify(valgrind, null, 2))
          // only add valgrind results if the other tests didn't pass
          if (!result.stats) {
            result.stats = {
              errors: 0,
              failures: 0,
              tests: 0,
              time: 0,
              timestamp: 0
            }
          }
          if (valgrind.length) {
            if (result && !result.tests.length) {
              result.tests.push(...valgrind)
              result.stats.failures += valgrind.length
              result.stats.tests += valgrind.length
            } else {
              result.tests.push({
                file: undefined,
                line: NaN,
                name: 'verify_memory_leak',
                time: 0,
                placeholder: true,
                failure: {
                  stacktrace: '',
                  message: 'Validate all tests before checking memory leaks'
                }
              })
              result.stats.tests += 1
            }
          } else {
            result.tests.push({
              file: undefined,
              line: NaN,
              name: 'verify_memory_leak',
              time: 0,
              failure: undefined
            })
            result.stats.tests += 1
          }
        } catch (err) {
          debug('err', err)
        }
      }

      if (exitCode === 124) {
        debug('Timeout')
        return {
          result,
          error: 'timeout',
          stdout: this.replaceLabel(stdout, nbr),
          stderr: this.replaceLabel(stderr, nbr),
          compil: null
        }
      }

      if (exitCode === 139) {
        debug('Segmentation fault')
        return {
          result,
          error: 'segfault',
          stdout: this.replaceLabel(stdout, nbr),
          stderr: this.replaceLabel(stderr, nbr),
          compil: null
        }
      }

      if (result !== null) {
        return {
          result,
          stdout: this.replaceLabel(stdout, nbr),
          stderr: this.replaceLabel(stderr, nbr),
          compil: null
        }
      }

      debug('junit output error', junitOutput.stderr)
      debug('junit output', junitOutput.stdout)
      return {
        result: null,
        error: 'junit',
        stdout: this.replaceLabel(stdout, nbr),
        stderr: this.replaceLabel(stderr, nbr),
        compil: null
      }
    } finally {
      await Promise.all([
        chmod(testfolder, '777')
      ])
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
