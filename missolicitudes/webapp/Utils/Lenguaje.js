sap.ui.define([], function () {
    "use strict";
    
    var sLang = sap.ui.getCore().getConfiguration().getLanguage().toLowerCase();
    
    var mMap = {
        "es": "_es_ES",
        "es-es": "_es_ES",
        "es_es": "_es_ES",
        "ca": "_ca_ES", 
        "ca-es": "_ca_ES",
        "ca_es": "_ca_ES",
        "en": "_en_US",
        "en-us": "_en_US",
        "en_us": "_en_US"
    };
    
    var sSufijo = mMap[sLang] || "_en_US"; 
    return {
        /**
         * Obtiene el nombre del campo concatenado con el sufijo del idioma
         * @param {string} sNombreBase - Nombre base del campo (ej: "cust_etiqueta")
         * @returns {string} - Nombre completo del campo (ej: "cust_etiqueta_es_ES")
         */
        obtenerNombreConcatenado: function (sNombreBase) {
            return sNombreBase + sSufijo;
        },
        
        /**
         * Obtiene el valor localizado con fallback automático
         * @param {object} oData - Objeto con los datos
         * @param {string} sFieldBase - Nombre base del campo (ej: "cust_etiqueta")
         * @returns {string} Valor localizado o fallback
         */
        obtenerValorLocalizado: function (oData, sFieldBase) {
            if (!oData) {
                return "";
            }
                  
            var sLocalizedField = this.obtenerNombreConcatenado(sFieldBase);
            if (oData[sLocalizedField]) {
                return oData[sLocalizedField];
            }
                   
            if (oData[sFieldBase + "_localized"]) {
                return oData[sFieldBase + "_localized"];
            }
                
            if (oData[sFieldBase + "_defaultValue"]) {
                return oData[sFieldBase + "_defaultValue"];
            }
                     
            if (oData[sFieldBase + "_en_US"]) {
                return oData[sFieldBase + "_en_US"];
            }
                        
            if (oData[sFieldBase]) {
                return oData[sFieldBase];
            }            
            
            return "";
        }        
    
    };
});