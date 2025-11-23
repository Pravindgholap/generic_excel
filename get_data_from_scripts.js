import path from "path";
import fs from "fs";
import pgPromise from "pg-promise";
import getPostgresPgClient from "../../postgres_pg.js";
import { CONFIG } from "../../../../../app.js";
import logger from "../../../../common/logger.js";

const { QueryFile } = pgPromise();

const getSQLFile = (fileName) => {
  const filePath = path.join(
    process.cwd(),
    "apis",
    "db",
    "postgresDB",
    "DAO",
    "SQL",
    fileName
  );
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`SQL file not found: ${fileName}`);
  }
  
  return new QueryFile(filePath, { minify: true, noWarnings: true });
};

/**
 * Executes a SQL file dynamically based on the given KeyFileName.
 * @param {string} keyFileName - SQL file name (without .sql)
 * @param {object} params - Parameters for SQL execution
 */
export const executeGenericSQL = async (keyFileName, params = {}) => {
  const fileName = `${keyFileName}.sql`;
  const db = getPostgresPgClient(CONFIG.POSTGRES);
  
  try {
    const sql = getSQLFile(fileName);
    logger.info(`Executing SQL from file: ${fileName} with params: ${JSON.stringify(params)}`);
    
    const result = await db.any(sql, params);
    logger.info(`Fetched ${result.length} rows from ${fileName}`);
    
    return result;
  } catch (error) {
    logger.error(`DAO Error in ${keyFileName}: ${error.message}`);
    throw error;
  }
};