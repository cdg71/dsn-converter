import path from "node:path";
import { performance } from "node:perf_hooks";
import { promises as fsPromises } from "node:fs";
import JSZip from "jszip";
import iconv from "iconv-lite";

interface ScriptStatistics {
  start: number;
  end?: number;
  duration?: number;
}

interface MonthlyDsnFileData {
  siren: string;
  payMonth: string;
  content: string;
}

interface GroupedMonthlyDsnFilesData {
  [key: string]: MonthlyDsnFileData[];
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
    const globalDsnFilenames = await getDsnFiles({
      folderPath: inputFolderPath,
    });
    const monthlyDsnFilesData = await processGlobalDsnFiles({
      globalDsnFilenames,
      delimiter,
      payMonthRegex,
      siretRegex,
      nafRegex,
      inputFolderPath,
    });
    const groupedMonthlyDsnFilesData = await groupMonthlyDsnFilesData({
      monthlyDsnFilesData,
    });
    for (const siren in groupedMonthlyDsnFilesData) {
      const organisationData = groupedMonthlyDsnFilesData[siren];
      await writeZipfile({ outputFolderPath, siren, organisationData });
    }
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
  try {
    console.log("- Lecture des paramètres");
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
 * @param {string} options.folderPath - The folder path
 * @returns {Promise<string[]>} An array of file names
 * @throws Will throw an error if the file cannot be read.
 */
async function getDsnFiles({
  folderPath,
}: {
  folderPath: string;
}): Promise<string[]> {
  try {
    console.log("- Listing des fichiers");
    const files = await fsPromises.readdir(folderPath);
    return files;
  } catch (error) {
    throw { message: "Impossible de lister les fichiers", error };
  }
}

/**
 * Processes the global DSN files.
 * @async
 * @param {Object} options - The options object
 * @param {string[]} options.globalDsnFilenames - An array of global DSN file names
 * @param {string} options.delimiter - Delimiter used in the DSN files
 * @param {string} options.payMonthRegex - Regex used to extract the PAY_MONTH
 * @param {string} options.siretRegex - Regex used to extract the SIREN
 * @param {string} options.nafRegex - Regex used to extract the NAF
 * @param {string} options.inputFolderPath - The input folder path
 * @param {string} options.outputFolderPath - The output folder path
 * @returns {Promise<Record<string, string>>} An object containing the monthly DSN files
 * @throws Will throw an error if the file cannot be read.
 */
async function processGlobalDsnFiles({
  globalDsnFilenames,
  delimiter,
  payMonthRegex,
  siretRegex,
  nafRegex,
  inputFolderPath,
}: {
  globalDsnFilenames: string[];
  delimiter: string;
  payMonthRegex: RegExp;
  siretRegex: RegExp;
  nafRegex: RegExp;
  inputFolderPath: string;
}): Promise<MonthlyDsnFileData[]> {
  try {
    console.log("- Traitement des fichiers DSN globaux");
    const processedDsnFilesData: MonthlyDsnFileData[] = [];
    for (const fileName of globalDsnFilenames) {
      if (path.extname(fileName) === ".dsn") {
        const filePath = path.join(inputFolderPath, fileName);
        const globalDsnFileParts = await splitGlobalDsnFile({
          filePath,
          delimiter,
        });
        const res = await createMonthlyDsnFilesContent({
          globalDsnFileParts,
          delimiter,
          payMonthRegex,
          siretRegex,
          nafRegex,
        });
        processedDsnFilesData.push(...res);
      }
    }
    return processedDsnFilesData;
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
  try {
    console.log(`- Découpage du fichier '${filePath}'`);
    // const fileContents = await fsPromises.readFile(filePath, "latin1");
    const fileContents = iconv.decode(
      await fsPromises.readFile(filePath),
      "windows-1252"
    );
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
 * Creates the monthly DSN files content.
 *
 * @param {Object} options - The options object
 * @param {string[]} options.globalDsnFileParts - An array of global DSN file parts
 * @param {string} options.delimiter - Delimiter used in the DSN files
 * @param {string} options.payMonthRegex - Regex used to extract the PAY_MONTH
 * @param {string} options.siretRegex - Regex used to extract the SIREN
 * @param {string} options.nafRegex - Regex used to extract the NAF
 * @param {string} options.outputFolderPath - The output folder path
 * @throws Will throw an error if the file cannot be written
 * @returns {Promise<MonthlyDsnFileData[]>} An object containing the monthly DSN files
 */
async function createMonthlyDsnFilesContent({
  globalDsnFileParts,
  delimiter,
  payMonthRegex,
  siretRegex,
  nafRegex,
}: {
  delimiter: string;
  globalDsnFileParts: string[];
  payMonthRegex: RegExp;
  siretRegex: RegExp;
  nafRegex: RegExp;
}): Promise<MonthlyDsnFileData[]> {
  try {
    console.log("- Extraction du contenu des fichiers DSN mensuels");
    const header = globalDsnFileParts[0];
    const parts = globalDsnFileParts.slice(1);
    const monthlyDsnFilesContent: MonthlyDsnFileData[] = [];
    for (const part of parts) {
      const payMonthDsn = extractFirstCapturingGroup({
        regex: payMonthRegex,
        text: part,
      });
      const year = payMonthDsn.slice(4);
      const month = payMonthDsn.slice(2, 4);
      const day = payMonthDsn.slice(0, 2);
      const siret = extractFirstCapturingGroup({
        regex: siretRegex,
        text: part,
      });
      const naf = extractFirstCapturingGroup({
        regex: nafRegex,
        text: part,
      });
      const siren = `${siret}${naf}`;
      const payMonth = `${year}-${month}-${day}`;
      const content = [header, delimiter, part].join("");
      monthlyDsnFilesContent.push({ siren, payMonth, content });
    }
    return monthlyDsnFilesContent;
  } catch (error) {
    throw {
      message: `Impossible d'extraire le contenu d'un fichier DSN mensuel`,
      error,
    };
  }
}

/**
 * Groups the monthly DSN files data.
 * @async
 * @param {object} options - The options object
 * @param {MonthlyDsnFileData[]} options.monthlyDsnFilesData - The monthly DSN files
 * @returns {Promise<GroupedMonthlyDsnFilesData>} An object containing the grouped monthly DSN files
 * @throws Will throw an error if the file cannot be read
 */
async function groupMonthlyDsnFilesData({
  monthlyDsnFilesData,
}: {
  monthlyDsnFilesData: MonthlyDsnFileData[];
}): Promise<GroupedMonthlyDsnFilesData> {
  try {
    console.log("- Grouper les données des fichiers DSN mensuels par Siren");
    const groupedMonthlyDsnFilesData = monthlyDsnFilesData.reduce(
      (acc: GroupedMonthlyDsnFilesData, obj: MonthlyDsnFileData) => {
        const key = obj.siren;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(obj);
        return acc;
      },
      {}
    );
    return groupedMonthlyDsnFilesData;
  } catch (error) {
    throw {
      message: `Impossible de grouper les données des fichiers DSN mensuels par Siren`,
      error,
    };
  }
}

/**
 * Asynchronously writes the monthly DSN archives of an organization to a zip file.
 * @param {Object} options - The options object.
 * @param {string} options.outputFolderPath - The path to the output folder where the zip file will be saved.
 * @param {string} options.siren - The SIREN number of the organization.
 * @param {MonthlyDsnFileData[]} options.organisationData - An array of MonthlyDsnFileData objects representing the data to be written to the zip file.
 * @throws {Object} - An object containing a message and the error that caused the failure if the archives cannot be written.
 */
async function writeZipfile({
  outputFolderPath,
  siren,
  organisationData,
}: {
  outputFolderPath: string;
  siren: string;
  organisationData: MonthlyDsnFileData[];
}): Promise<void> {
  try {
    console.log(`- Ecriture de l'archive DSN de l'organisation ${siren}`);
    const archivePath = path.join(outputFolderPath, `${siren}_dsn.zip`);
    const zip = new JSZip();
    for (const dsnFile of organisationData) {
      const filename = `${siren}_${dsnFile.payMonth}.dsn`;
      //https://github.com/Stuk/jszip/issues/220
      const dsnBinary = iconv.encode(dsnFile.content, "windows-1252");
      zip.file(filename, dsnBinary, { binary: true });
    }
    const zipContent = await zip.generateAsync({ type: "uint8array" });
    await createFolderIfNotExists({ outputFolderPath });
    await fsPromises.writeFile(archivePath, zipContent);
  } catch (error) {
    throw {
      message: "Impossible d'écrire l'archive DSN d'une organisation",
      error,
    };
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
    console.log(`  - Création du dossier '${outputFolderPath}'`);
  }
}
