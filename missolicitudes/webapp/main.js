sap.ui.define([
    "sap/ui/core/ComponentContainer",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/odata/v2/ODataModel"
], function (ComponentContainer, Filter, FilterOperator, ODataModel) {
    "use strict";

    /**
     * Obtiene el idioma del navegador y lo mapea al formato SFSF
     * @returns {string} Código de idioma en formato SFSF (ej: es_ES)
     */
    function getBrowserLanguage() {
        const sLang = (navigator.language || navigator.userLanguage || "en").toLowerCase();
        const mMap = {
            "es": "es_ES",
            "es-es": "es_ES",
            "ca": "ca_ES",
            "ca-es": "ca_ES",
            "en": "en_US",
            "en-us": "en_US",
            "ca_es": "ca_ES",
            "en_us": "en_US",
            "es_es": "es_ES"
        };
        return mMap[sLang] || "en_US";
    }

    /**
     * Fuerza el logout y recarga la página para obtener una nueva sesión
     * Solución para el problema de cookies expiradas que no se renuevan con reload simple
     */
    function forceLogoutAndReload() {
        console.warn("Sesión inválida detectada. Forzando logout y recarga...");
        
        // Usar XMLHttpRequest para asegurar compatibilidad y control del complete
        const xhr = new XMLHttpRequest();
        xhr.open("GET", "/logout", true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {               
                window.location.reload(true);
            }
        };
        xhr.send();
    }

    /**
     * Verifica si la respuesta es JSON válido y no HTML
     * @param {Response} response Respuesta del fetch
     * @returns {Promise<object|null>} Datos JSON o null si no es JSON válido
     */
    async function parseJsonResponse(response) {
        const contentType = response.headers.get("content-type");
              
        const sResponseText = await response.text();        
        
        if (sResponseText.trim().startsWith("<") || sResponseText.includes("<html>")) {
            console.warn("Respuesta HTML detectada (página de login). Contenido:", sResponseText.substring(0, 100));
            return null;
        }
        
        // Si no es JSON según content-type, pero tampoco es HTML, intentar parsear
        if (!contentType || !contentType.includes("application/json")) {
            console.warn("Content-Type no es JSON:", contentType);
        }
        
        try {
            return JSON.parse(sResponseText);
        } catch (error) {
            console.error("Error al parsear JSON:", error);
            return null;
        }
    }

    /**
     * Obtiene los datos del usuario actual desde la API
     * @param {number} attempt Número de intento actual
     * @param {number} maxRetries Número máximo de reintentos
     * @param {number} retryDelay Tiempo de espera entre reintentos en ms
     * @returns {Promise<object>} Datos del usuario
     */
    async function fetchCurrentUser(attempt, maxRetries, retryDelay) {
        try {
            console.log(`Intento ${attempt}/${maxRetries} - Obteniendo usuario actual...`);

            const oResponse = await fetch(
                `${sap.ui.require.toUrl("com/inetum/missolicitudes")}/user-api/currentUser`,
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    }
                }
            );

            // Caso 1: Error HTTP (401, 403)
            if (!oResponse.ok) {
                const errorMsg = `Error del servidor: ${oResponse.status} ${oResponse.statusText}`;
                console.warn(errorMsg);
                
                // Si es error de autenticación, forzar logout antes de recargar
                if (oResponse.status === 401 || oResponse.status === 403) {
                    console.error("Error de autenticación (401/403) detectado.");
                    forceLogoutAndReload();                    
                    await new Promise(() => {});
                }
                               
                if (attempt < maxRetries) {                    
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    return fetchCurrentUser(attempt + 1, maxRetries, retryDelay);
                }
                
                throw new Error(errorMsg);
            }

            // Caso 2: Respuesta OK pero contenido es HTML (página de login)
            const oUserData = await parseJsonResponse(oResponse);
            
            if (!oUserData) {
                console.error("La respuesta contiene HTML en lugar de JSON. Sesión expirada.");
                forceLogoutAndReload();
                
                await new Promise(() => {});
            }

            // Caso 3: Verificar que los datos del usuario sean válidos
            if (!oUserData.name) {
                throw new Error("Datos de usuario inválidos: falta el campo 'name'");
            }

            console.log("Usuario obtenido exitosamente:", oUserData.name);
            return oUserData;

        } catch (error) {
            console.error(`Error en intento ${attempt}/${maxRetries}:`, error.message);            
           
            if (attempt === 1 && (error.message.includes("JSON") || error.message.includes("HTML"))) {
                console.error("Error de sesión detectado. Forzando logout y recarga...");
                forceLogoutAndReload();
                await new Promise(() => {});
            }            
           
            if (attempt < maxRetries) {                
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return fetchCurrentUser(attempt + 1, maxRetries, retryDelay);
            }
            
            throw error;
        }
    }

    /**
     * Obtiene el idioma del usuario desde SuccessFactors
     * @param {string} userId ID del usuario
     * @returns {Promise<string|null>} Código de idioma del usuario o null si no se encuentra
     */
    async function fetchUserLanguageFromSFSF(userId) {
        try {
            const oDataModel = new ODataModel({
                serviceUrl: sap.ui.require.toUrl("com/inetum/missolicitudes") + "/odata/v2",
                useBatch: false,
                defaultBindingMode: "TwoWay"
            });

            return await new Promise((resolve, reject) => {
                const aFilters = [new Filter("userId", FilterOperator.EQ, userId)];
                
                oDataModel.read("/User", {
                    filters: aFilters,
                    urlParameters: {
                        "$select": "defaultLocale,userId"
                    },
                    success: (oData) => {
                        if (oData.results && oData.results.length > 0) {
                            const sLang = oData.results[0].defaultLocale;
                            if (sLang) {
                                console.log(`Idioma del usuario obtenido de SFSF: ${sLang}`);
                                resolve(sLang);
                            } else {
                                console.warn("Campo defaultLocale vacío en SFSF.");
                                resolve(null);
                            }
                        } else {
                            console.warn("Usuario no encontrado en SFSF.");
                            resolve(null);
                        }
                    },
                    error: (oError) => {
                        console.error("Error al leer datos de SFSF:", oError);
                        resolve(null); // Devolvemos null en lugar de rechazar
                    }
                });
            });
        } catch (error) {
            console.error("Error inesperado al consultar SFSF:", error);
            return null;
        }
    }

    /**
     * Función principal asíncrona que se ejecuta al iniciar la app.
     * Obtiene el usuario actual y configura el idioma de la aplicación.
     */
    async function main() {
        const MAX_RETRIES = 5;
        const RETRY_DELAY = 1000; // 1 segundo
        let sLanguage = null;
        let oUserData = null;        

        // Paso 1: Obtener datos del usuario con reintentos
        try {
            oUserData = await fetchCurrentUser(1, MAX_RETRIES, RETRY_DELAY);            
          
            sessionStorage.setItem("com:missolicitudes:userInfo", JSON.stringify(oUserData));          
            
        } catch (error) {
            console.error("No se pudo obtener el usuario después de todos los intentos.");
            console.warn("La aplicación continuará con configuración por defecto.");
        }

        // Paso 2: Obtener idioma desde SFSF (solo si se obtuvo el usuario)
        if (oUserData && oUserData.name) {
            try {
                sLanguage = await fetchUserLanguageFromSFSF(oUserData.name);
            } catch (error) {
                console.warn("No se pudo obtener el idioma desde SFSF:", error);
            }
        }

        // Paso 3: Establecer idioma (fallback al navegador si es necesario)
        if (!sLanguage) {
            sLanguage = getBrowserLanguage();            
        }
        
        sap.ui.getCore().getConfiguration().setLanguage(sLanguage);

        // Paso 4: Inicializar el componente UI5        
        new ComponentContainer({
            name: "com.inetum.missolicitudes",
            settings: {
                id: "com.inetum.missolicitudes"
            },
            async: true
        }).placeAt("content");
        
    }

    // Ejecutar la función principal con manejo de errores global
    main().catch(error => {
        console.error("Error crítico en la inicialización:", error);
        
        // Intentar cargar la aplicación de todos modos con configuración por defecto
        console.warn("Cargando aplicación con configuración por defecto...");
        
        const sLang = getBrowserLanguage();
        sap.ui.getCore().getConfiguration().setLanguage(sLang);
        
        new ComponentContainer({
            name: "com.inetum.missolicitudes",
            settings: {
                id: "com.inetum.missolicitudes"
            },
            async: true
        }).placeAt("content");
    });
});