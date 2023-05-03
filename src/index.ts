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
  const scriptStatistics: ScriptStatistics = {
    start: performance.now(),
  };
  try {
    const { inputFolder, outputFolder } = getParameters();
    const files = await getFiles({ inputFolder });

    console.log({ inputFolder, outputFolder, length: files.length });
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
 * @throws Error if invalid arguments are provided
 * @returns {Object} Object containing the input file and output folder paths
 */
function getParameters(): { inputFolder: string; outputFolder: string } {
  console.log("- Lecture des paramètres");
  try {
    const inputFolder = path.normalize(process.argv[2]);
    const outputFolder = path.normalize(process.argv[3]);
    return { inputFolder, outputFolder };
  } catch (error) {
    throw { message: "Arguments invalides", error };
  }
}

/**
 * Asynchronously reads the contents of the specified directory and returns an array of file names.
 * @param inputFolder - The path of the folder to read.
 * @returns A promise that resolves with an array of file names.
 * @throws Object containing a message and an error property if the folder cannot be read.
 */
async function getFiles({
  inputFolder,
}: {
  inputFolder: string;
}): Promise<string[]> {
  console.log("- Lecture des fichiers");
  try {
    const files = await fsPromises.readdir(inputFolder);
    return files;
  } catch (error) {
    throw { message: "Impossible de lire les fichiers", error };
  }
}
