import path from "node:path";
import { performance } from "node:perf_hooks";
import { promises as fsPromises } from "node:fs";

interface ScriptStatistics {
  start: number;
  end?: number;
  duration?: number;
}

/**
 * Entry point of the program.
 * The main function is immediately invoked.
 * @returns {Promise<void>}
 */
(async function main(): Promise<void> {
  console.log("Début de la conversion DSN");
  // Setup
  const scriptStatistics: ScriptStatistics = {
    start: performance.now(),
  };
  const delimiter = "S20.G00.05.001,'01'\r\n";
  const payMonthRegex = /S20.G00.05.005,'(\S+)'/;
  const siretRegex = /S21.G00.06.001,'(\S+)'/;
  const nafRegex = /S21.G00.06.002,'(\S+)'/;
  // Conversion
  try {
    const { inputFolderPath, outputFolderPath } = getScriptParameters();
    const globalDsnFileNames = await getGlobalDsnFiles({ inputFolderPath });
    await processGlobalDsnFiles({
      globalDsnFileNames,
      delimiter,
      payMonthRegex,
      siretRegex,
      nafRegex,
      inputFolderPath,
      outputFolderPath,
    });
  } catch (error) {
    console.error(error);
  } finally {
    // Teardown
    scriptStatistics.end = performance.now();
    scriptStatistics.duration =
      scriptStatistics.end ?? 0 - scriptStatistics.start;
    console.log(`Fin de la conversion en ${scriptStatistics.duration} ms`);
  }
})();

/**
 * Returns an object containing the input file and output folder paths
 *
 * @returns {Object} An object containing the input file and output folder paths
 * @throws Will throw an error if the file cannot be read
 */
function getScriptParameters(): {
  inputFolderPath: string;
  outputFolderPath: string;
} {
  console.log("- Lecture des paramètres");
  try {
    const inputFolderPath = path.normalize(process.argv[2]);
    const outputFolderPath = path.normalize(process.argv[3]);
    return { inputFolderPath, outputFolderPath };
  } catch (error) {
    throw { message: "Arguments invalides", error };
  }
}

/**
 * Asynchronously reads the contents of the specified directory and returns an array of file names.
 * @async
 * @param {Object} options - The options object
 * @param {string} options.inputFolderPath - The input folder path
 * @returns {Promise<string[]>} An array of file names
 * @throws Will throw an error if the file cannot be read.
 */
async function getGlobalDsnFiles({
  inputFolderPath,
}: {
  inputFolderPath: string;
}): Promise<string[]> {
  console.log("- Listing des fichiers");
  try {
    const files = await fsPromises.readdir(inputFolderPath);
    return files;
  } catch (error) {
    throw { message: "Impossible de lister les fichiers", error };
  }
}

/**
 * Processes the global DSN files
 * @async
 * @param {Object} options - The options object
 * @param {string[]} options.globalDsnFileNames - An array of global DSN file names
 * @param {string} options.delimiter - Delimiter used in the DSN files
 * @param {string} options.payMonthRegex - Regex used to extract the PAY_MONTH
 * @param {string} options.siretRegex - Regex used to extract the SIREN
 * @param {string} options.nafRegex - Regex used to extract the NAF
 * @param {string} options.inputFolderPath - The input folder path
 * @param {string} options.outputFolderPath - The output folder path
 * @throws Throws an error if the file cannot be written
 * @returns {Promise<void>} A promise that resolves when the file is written
 */
async function processGlobalDsnFiles({
  globalDsnFileNames,
  delimiter,
  payMonthRegex,
  siretRegex,
  nafRegex,
  inputFolderPath,
  outputFolderPath,
}: {
  globalDsnFileNames: string[];
  delimiter: string;
  payMonthRegex: RegExp;
  siretRegex: RegExp;
  nafRegex: RegExp;
  inputFolderPath: string;
  outputFolderPath: string;
}): Promise<void> {
  try {
    const limit = 1;
    let processedFiles = 0;
    for (const fileName of globalDsnFileNames) {
      if (path.extname(fileName) === ".dsn") {
        const filePath = path.join(inputFolderPath, fileName);
        const globalDsnFileParts = await splitGlobalDsnFile({
          filePath,
          delimiter,
        });
        await createMonthlyDsnFiles({
          globalDsnFileParts,
          delimiter,
          payMonthRegex,
          siretRegex,
          nafRegex,
          outputFolderPath,
        });
      }
      processedFiles++;
      if (processedFiles >= limit) break;
    }
  } catch (error) {
    throw {
      message: "Impossible de traiter les fichiers DSN globaux",
      error,
    };
  }
}

/**
 * splits the contents of a global DSN file into parts, given its file path and a delimiter.
 * @async
 * @param {object} options - The options object.
 * @param {string} options.filePath - The path of the file to read.
 * @param {string} options.delimiter - The delimiter to split the file contents on.
 * @returns {Promise<string[]>} - The parts of the DSN file.
 * @throws Will throw an error if the file cannot be read.
 */
async function splitGlobalDsnFile({
  filePath,
  delimiter,
}: {
  filePath: string;
  delimiter: string;
}): Promise<string[]> {
  console.log(`- Lecture du fichier '${filePath}'`);
  try {
    const fileContents = await fsPromises.readFile(filePath, "latin1");
    const fileParts = fileContents.split(delimiter);
    return fileParts;
  } catch (error) {
    throw {
      message: `Impossible de découper le fichier '${filePath}'`,
      error,
    };
  }
}

/**
 * Creates monthly DSN files in the output folder from one global DSN file
 *
 * @param {Object} options - The options object
 * @param {string[]} options.dsnFileParts - An array of DSN file parts
 * @param {string} options.delimiter - Delimiter used in the DSN files
 * @param {string} options.payMonthRegex - Regex used to extract the PAY_MONTH
 * @param {string} options.siretRegex - Regex used to extract the SIREN
 * @param {string} options.nafRegex - Regex used to extract the NAF
 * @param {string} options.outputFolder - The output folder path
 * @throws Throws an error if the file cannot be written
 * @returns {Promise<void>} A promise that resolves when the file is written
 */ async function createMonthlyDsnFiles({
  globalDsnFileParts,
  delimiter,
  payMonthRegex,
  siretRegex,
  nafRegex,
  outputFolderPath,
}: {
  delimiter: string;
  globalDsnFileParts: string[];
  payMonthRegex: RegExp;
  siretRegex: RegExp;
  nafRegex: RegExp;
  outputFolderPath: string;
}): Promise<void> {
  console.log("  - Création des fichiers DSN mensuels");
  try {
    const header = globalDsnFileParts[0];
    const parts = globalDsnFileParts.slice(1);
    for (const part of parts) {
      const payMonth = extractFirstCapturingGroup({
        regex: payMonthRegex,
        text: part,
      });
      const year = payMonth.slice(4);
      const month = payMonth.slice(2, 4);
      const day = payMonth.slice(0, 2);
      const siret = extractFirstCapturingGroup({
        regex: siretRegex,
        text: part,
      });
      const naf = extractFirstCapturingGroup({
        regex: nafRegex,
        text: part,
      });
      const outputfileName = `${siret}${naf}_${year}-${month}-${day}.dsn`;
      const outputFilePath = path.join(outputFolderPath, outputfileName);
      const fileContents = [header, delimiter, part].join("");
      await createFolderIfNotExists({ outputFolderPath });
      await fsPromises.writeFile(outputFilePath, fileContents, "latin1");
    }
  } catch (error) {
    throw { message: `Impossible de créer un fichier DSN mensuel`, error };
  }
}

/**
 * Extracts the first capturing group from a given string using the provided regular expression.
 * @param regex - The regular expression to use for matching.
 * @param text - The string to extract the capturing group from.
 * @returns The first capturing group if found, otherwise an empty string.
 */
function extractFirstCapturingGroup({
  regex,
  text,
}: {
  regex: RegExp;
  text: string;
}): string {
  const match = regex.exec(text);
  return match?.[1] ?? "";
}

/**
 * Creates a folder if it does not exist
 * @async
 * @param {Object} options - The options object
 * @param {string} options.outputFolderPath - The output folder path
 * @throws Throws an error if the folder cannot be created
 * @returns {Promise<void>} A promise that resolves when the folder is created
 */
async function createFolderIfNotExists({
  outputFolderPath,
}: {
  outputFolderPath: string;
}): Promise<void> {
  try {
    await fsPromises.access(outputFolderPath, fsPromises.constants.F_OK);
  } catch (error) {
    await fsPromises.mkdir(outputFolderPath, { recursive: true });
  }
}
