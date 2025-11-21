sap.ui.define([
], function () {
    "use strict";    
    return {
        
        /**
         * Crear datos en SuccessFactors
         * @param {string} sEntity - Nombre de la entidad (ej: "/cust_INETUM_SOL_C_0001")
         * @param {object} oService - Modelo OData del servicio
         * @param {object} oDataToSend - Datos a crear
         * @returns {Promise} Promise con la respuesta
         */
        createDataERP: function (sEntity, oService, oDataToSend) {
            return new Promise((resolve, reject) => {      
                
                oService.create(sEntity, oDataToSend, {
                    success: (data, response) => {                     
                        resolve({ data, response });
                    },
                    error: (error) => {                    
                        reject(error);
                    }
                });
            });
        },

        /**
         * Leer datos de SuccessFactors
         * @param {string} sEntity - Nombre de la entidad
         * @param {object} oService - Modelo OData del servicio
         * @param {array} aFilter - Array de filtros UI5
         * @param {object} oParam - Parámetros adicionales {bParam: boolean, oParameter: object}
         * @returns {Promise} Promise con la respuesta
         */
        readDataERP: function (sEntity, oService, aFilter = [], oParam = { bParam: false, oParameter: undefined }) {
            return new Promise((resolve, reject) => {
                oService.read(sEntity, {
                    filters: aFilter,
                    urlParameters: oParam.bParam ? oParam.oParameter : {},
                    success: (data, response) => {                 
                        resolve({ data, response });
                    },
                    error: (error) => {                    
                        reject(error);
                    }
                });
            });
        },

        /**
         * Actualizar datos en SuccessFactors
         * @param {string} sEntity - Ruta completa con claves (ej: "/cust_INETUM_SOL_C_0001(externalCode=123)")
         * @param {object} oService - Modelo OData del servicio
         * @param {object} oDataToUpdate - Datos a actualizar
         * @returns {Promise} Promise con la respuesta
         */
        // updateDataERP: function (sEntity, oService, oDataToUpdate) {
        //     return new Promise((resolve, reject) => {     
        //         oService.update(sEntity, oDataToUpdate, {
        //             success: (data, response) => {                       
        //                 resolve({ data, response });
        //             },
        //             error: (error) => {                      
        //                 reject(error);
        //             }
        //         });
        //     });
        // },

        updateDataERP: function (sEntity, oService, oDataToUpdate) {
            return new Promise((resolve, reject) => {     
                oService.update(sEntity, oDataToUpdate, {
                    success: (oData, oResponse) => {                       
                        // Si no hay payload (204), devolvemos un objeto vacío
                        resolve({ data: oData || {}, response: oResponse });
                    },
                    error: (oError) => {                      
                        reject(oError);
                    }
                });
            });
        },

        /**
         * Eliminar datos de SuccessFactors
         * @param {string} sEntity - Ruta completa con claves
         * @param {object} oService - Modelo OData del servicio
         * @returns {Promise} Promise con la respuesta
         */
        deleteDataERP: function (sEntity, oService) {
            return new Promise((resolve, reject) => {                           
                oService.remove(sEntity, {
                    success: (data, response) => {                      
                        resolve({ data, response });
                    },
                    error: (error) => {                      
                        reject(error);
                    }
                });
            });
        },
       
    };
});