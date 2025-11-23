import { executeGenericSQL } from "../db/postgresDB/DAO/GenericSQL/get_data_from_scripts.js";
import logger from "../common/logger.js";

export class GenericDataService {
  /**
   * Core method to fetch data from SQL file dynamically.
   */
  static async getDataFromSQL(request) {
    try {
      const { KeyFileName, Params } = request;
    
      const data = await executeGenericSQL(KeyFileName, Params);
      
      const response = {
        page: Params.page || 0,
        size: Params.size || data.length,
        total: data[0]?.total_count || 0,
        data,
      };
      
      logger.info(
        `Service: Fetched ${data.length} rows for ${KeyFileName}, total=${response.total}`
      );
      
      return response;
    } catch (error) {
      logger.error(`Service Error in getDataFromSQL: ${error.message}`);
      throw error;
    }
  }
}

