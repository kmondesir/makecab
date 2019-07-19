import path = require('path');
import tl = require('vsts-task-lib/task');
import fs = require('fs');

var repoRoot: string = tl.getVariable('System.DefaultWorkingDirectory');

var rootFolderOrFile: string = makeAbsolute(path.normalize(tl.getPathInput('rootFolderOrFile', true, false).trim()));
var includeRootFolder: boolean = tl.getBoolInput('includeRootFolder', true);

var verbose: boolean = tl.getBoolInput('verbose', false);
var quiet: boolean = tl.getBoolInput('quiet', false);

tl.debug('repoRoot: ' + repoRoot);

var win = tl.osType().match(/^Win/);
tl.debug('win: ' + win);

// Makecab location

var winMakeCabLocation: string = path.join(__dirname, '7zip/7z.exe');

function getMakeCabLocation(): string {
  return winMakeCabLocation;
}

function ddfheader(name: string, destination: string): string {
  //Cab files require a directive file, see 'http://msdn.microsoft.com/en-us/library/bb417343.aspx#dir_file_syntax' for more info
  var output: string = ";*** MSDN Sample Source Code MakeCAB Directive file example" + "\n\r"
    + ";" + "\n\r" 
    + ".OPTION EXPLICIT" + "\n\r" + "\n\r"
    + ".Set CabinetNameTemplate=" + name + ".cab" + "\n\r" + ";" 
    + ".Set DiskDirectory1=" + destination + "\n\r" + ";"
    + ".Set MaxDiskSize=0" + "\n\r" + ";"
    + ".Set Cabinet=on" + "\n\r" + ";"
    + ".Set Compress=off" + "\n\r" + ";"
    + ".Set RptFileName=" + "setup.rpt" + "\n\r" + ";"
    + ".Set InfFileName=" + "setup.inf" + "\n\r" + ";"
  return output; 
}

function findFiles(): string[] {
  if (includeRootFolder) {
    return [path.basename(rootFolderOrFile)];
  } else {
    var fullPaths: string[] = tl.ls('-A', [rootFolderOrFile]);
    var baseNames: string[] = [];
    for (var i = 0; i < fullPaths.length; i++) {
      baseNames[i] = path.basename(fullPaths[i]);
    }
    return baseNames;
  }
}

function makeAbsolute(normalizedPath: string): string {
  tl.debug('makeAbsolute:' + normalizedPath);

  var result = normalizedPath;
  if (!path.isAbsolute(normalizedPath)) {
    result = path.join(repoRoot, normalizedPath);
    tl.debug('Relative file path: ' + normalizedPath + ' resolving to: ' + result);
  }
  return result;
}

function createFileList(files: string[]): string {
  const tempDirectory: string = tl.getVariable('Agent.TempDirectory');
  const fileName: string = Math.random().toString(36).replace('0.', '');
  const file: string = path.resolve(tempDirectory, fileName);

  try {
    fs.writeFileSync(
      file,
      files.reduce((prev, cur) => prev + cur + "\n", ""),
      { encoding: "utf8" });
  }
  catch (error) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }

    throw error;
  }

  return file;
}

function getOptions() {
  var dirName: string;
  if (includeRootFolder) {
    dirName = path.dirname(rootFolderOrFile);
    tl.debug("cwd (include root folder)= " + dirName);
    return { cwd: dirName };
  } else {
    var stats: tl.FsStats = tl.stats(rootFolderOrFile);
    if (stats.isFile()) {
      dirName = path.dirname(rootFolderOrFile);
    } else {
      dirName = rootFolderOrFile;
    }
    tl.debug("cwd (exclude root folder)= " + dirName);
    return { cwd: dirName };
  }
}

function makeCab(archive: string, compression: string, files: string[]) {
  tl.debug('Creating archive with 7-zip: ' + archive);
  var sevenZip = tl.createToolRunner(getSevenZipLocation());
  sevenZip.arg('a');
  sevenZip.arg('-t' + compression);
  if (verbose) {
    // Set highest logging level
    sevenZip.arg('-bb3');
  }
  sevenZip.arg(archive);

  const fileList: string = createFileList(files);
  sevenZip.arg('@' + fileList);

  return handleExecResult(sevenZip.execSync(getOptions()), archive);
}



function handleExecResult(execResult, archive) {
  if (execResult.code != tl.TaskResult.Succeeded) {
    tl.debug('execResult: ' + JSON.stringify(execResult));
    failTask(tl.loc('ArchiveCreationFailedWithError', archive, execResult.code, execResult.stdout, execResult.stderr, execResult.error));
  }
}

function failTask(message: string) {
  throw new FailTaskError(message);
}

export class FailTaskError extends Error {
}