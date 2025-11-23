// ============================================
// FILE: apis/controller/getDataFromSQLController.js
// ============================================
import { GenericDataService } from "../services/getDataFromSQL.js";
import { GenericExcelService } from "../services/generic_excel_service.js";
import { generateStyledExcel } from "../services/download-stock-report-excel/download_stocks_report_services.js";
import logger from "../common/logger.js";

export const getDataFromSQLController = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { KeyFileName, Params } = req.body;
    
    if (!KeyFileName) {
      return res.status(400).json({
        success: false,
        message: "KeyFileName is required in the request body.",
      });
    }

    logger.info(`Controller: Request received for KeyFileName=${KeyFileName}`);

    // Check if download is requested
    if (Params?.download === true) {
      logger.info(`Generating Excel for ${KeyFileName}`);
      
      // Generate Excel configuration and data
      const { data, config } = await GenericExcelService.exportToExcel(
        KeyFileName, 
        Params
      );

      // Generate and upload Excel to S3, returns response directly
      return await generateStyledExcel(
        data,
        res,
        config.headers_object,
        config.titleName,
        config.sheetName,
        config.formatKeys
      );
      
    } else {
      // Return JSON data
      const response = await GenericDataService.getDataFromSQL({ 
        KeyFileName, 
        Params 
      });

      const duration = Date.now() - startTime;
      logger.info(
        `Controller: Successfully processed ${KeyFileName} in ${duration}ms`
      );

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        ...response,
      });
    }
    
  } catch (error) {
    logger.error(`Controller Error for ${req.body?.KeyFileName}: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};